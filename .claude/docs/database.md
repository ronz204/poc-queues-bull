# Persistence — Database

The Postgres schema backing the domain's durable aggregates: the synthetic sales dataset, report definitions, and report executions. Redis-held coordination and cache state (distributed locks, fencing-token counters, the cached report snapshot) is not part of this schema — it never lands in Postgres at all.

---

## ID generation

Every primary key is a `uuid` column, but the value is generated in the application layer as a UUIDv7 (time-ordered) identifier, not by a database-side random UUID default. A monotonically-increasing key keeps new rows physically clustered at the end of the primary-key index instead of scattered across it, which matters here because `sale_transactions` and `report_executions` are both high-insert tables (a continuous synthetic feed, and one row per recomputation respectively) — a random v4 key would otherwise cause steadily worsening index bloat as either table grows.

This is unrelated to the idempotency mechanism on `report_executions` below: that mechanism dedups on a separate unique constraint over stable input fields, not on the row's own generated `id`.

## Schemas

Two Postgres schemas separate the ingested source dataset from the reporting engine's own state, mirroring a distinction the domain already draws — a sale transaction is external data the engine only reads, while a report definition/execution is the aggregate the project's own coordination mechanisms operate on:

| Schema | Holds |
|---|---|
| `sales` | `products`, `regions`, `sale_transactions` |
| `reporting` | `report_definitions`, `report_executions`, and all five enums below |

No foreign key crosses between the two schemas — every reference stays within its own schema, so the split is pure namespacing, not a source of cross-schema join complexity.

## Enums

| Enum | Values | Used by |
|---|---|---|
| `aggregation_type` | `sum`, `avg`, `count`, `min`, `max` | `report_definitions.aggregation_type` |
| `group_by_dimension` | `product`, `region`, `day`, `week`, `month` | `report_definitions.group_by` |
| `report_definition_status` | `active`, `archived` | `report_definitions.status` |
| `execution_trigger_type` | `cron`, `manual` | `report_executions.trigger_type` |
| `execution_status` | `pending`, `running`, `succeeded`, `failed` | `report_executions.status` |

The aggregation/grouping vocabulary is a closed enum rather than an open string, matching the project's bounded, non-OLAP scope — every value the domain layer can legally produce is enumerable in advance, so there's no reason to defer that validation to the application layer alone.

## Tables

### sales.products / sales.regions

```
sales.products
  id          uuid primary key
  name        text not null unique

sales.regions
  id          uuid primary key
  name        text not null unique
```

Dimension tables rather than free-text columns on the transaction row, so a product or region is one row referenced by every transaction and report grouping that touches it, instead of a string repeated and potentially misspelled across millions of rows.

### sales.sale_transactions

```
sales.sale_transactions
  id           uuid primary key
  product_id   uuid not null references sales.products(id)
  region_id    uuid not null references sales.regions(id)
  amount       numeric(12,2) not null
  occurred_at  timestamptz not null
  created_at   timestamptz not null default now()
```

`occurred_at` is the domain-meaningful event time (when the sale happened); `created_at` is purely the row's insertion time, kept separate because the synthetic feed may insert transactions out of order relative to when they occurred. Aggregation queries filter and group on `occurred_at`, `product_id`, and `region_id` — all three need an index to keep recomputation within a reasonable bound as the dataset grows.

### reporting.report_definitions

```
reporting.report_definitions
  id                uuid primary key
  name              text not null
  aggregation_type  aggregation_type not null
  group_by          group_by_dimension not null
  window_start      timestamptz not null
  window_end        timestamptz not null
  cron_expression   text not null
  version           integer not null default 1
  status            report_definition_status not null default 'active'
  created_at        timestamptz not null default now()
  updated_at        timestamptz not null
```

`version` only ever increases and is bumped on every config edit — this is the same version number the cache key encodes for passive, version-in-key invalidation. `window_start`/`window_end` are a fixed calendar range rather than a rolling duration: editing the window is itself a config edit like any other, and goes through the same version bump and cache invalidation as an aggregation-type or grouping change.

A report definition is retired by setting `status = 'archived'`, never by deleting the row — this preserves its execution history and keeps `report_executions.report_definition_id` a stable foreign key. The "no two active definitions share a name" invariant is enforced with a partial unique index:

```
create unique index report_definitions_active_name_idx
  on reporting.report_definitions (name)
  where status = 'active';
```

An archived definition's name becomes reusable by a new active one, since the constraint only ever looks at active rows.

### reporting.report_executions

```
reporting.report_executions
  id                        uuid primary key
  report_definition_id      uuid not null references reporting.report_definitions(id)
  report_definition_version integer not null
  trigger_type              execution_trigger_type not null
  scheduled_for              timestamptz not null
  status                    execution_status not null default 'pending'
  worker_id                 text
  fencing_token             bigint
  result                    jsonb
  error_message             text
  started_at                timestamptz
  finished_at                timestamptz
  created_at                timestamptz not null default now()
```

`report_definition_version` freezes the definition's version at the moment this execution was triggered, separately from the live `report_definitions.version` column, which keeps mutating. This matters for two reasons: it's an audit trail of which config an execution actually ran under, and it's part of the row's idempotency key below — if the definition is edited between a job's retries, the new version is deliberately treated as a different attempt, not a duplicate of the old one.

`worker_id`, `fencing_token`, and `error_message` are nullable because they're only known once a worker actually starts running the job (`status` moves past `pending`) — `fencing_token` is recorded here purely for audit/debugging visibility into which attempt won; the correctness guarantee itself is enforced where the lock and token counter actually live, not by this column.

`result` is a single `jsonb` column rather than a normalized per-group-key table, because its shape depends on `aggregation_type`/`group_by` and would otherwise need a different table per combination.

**Idempotent execution identity** is enforced with a unique constraint over the inputs that stay stable across a retry or redelivery of the same job:

```
create unique index report_executions_idempotency_idx
  on reporting.report_executions (report_definition_id, report_definition_version, trigger_type, scheduled_for);
```

`trigger_type` is part of the key so a manually forced recomputation never collides with that same tick's automatic cron run, while two retries of the *same* trigger (same scheduled tick, same trigger type) do collide and the retry is rejected as already-attempted rather than inserted as a second row.

---

## Non-goals

- No table for the cached report result (`report:snapshot:{reportId}:v{version}`) — that read model lives entirely in Redis and is never persisted to Postgres.
- No table for lock or fencing-token state — both are Redis-only, keyed per report, and don't have a durable Postgres counterpart.
- No cross-report dependency table (a report referencing another report's result) — this relationship is explicitly deferred at the domain level and isn't modeled here.
