# Database

The Postgres schema backing the domain's durable aggregates: the synthetic sales dataset, report definitions, report executions, and the outbox of domain events they raise. Redis-held coordination and cache state (distributed locks, fencing-token counters, the cached report snapshot) is not part of this schema — it never lands in Postgres at all; see the Non-goals section below.

---

## Schema

Two Postgres schemas separate the ingested source dataset from the reporting engine's own state, mirroring a distinction the domain already draws — a sale transaction is external data the engine only reads, while a report definition/execution is the aggregate the project's own coordination mechanisms operate on:

| Schema | Holds |
|---|---|
| `sales` | products, regions, sale transactions |
| `reports` | report definitions, report executions, the report-lifecycle outbox, and all five enums below |

A bounded context that emits domain events keeps its outbox table inside its own schema rather than in a shared messaging schema, so its events stay owned by the same context as the aggregates that raise them and would move with it if the context were ever split out. Today only `reports` has one; `sales` gains its own only if sale ingestion starts emitting events.

No foreign key crosses between the two schemas — every reference stays within its own schema, so the split is pure namespacing, not a source of cross-schema join complexity.

Table, index, and constraint names don't repeat the schema's noun (`reports.definitions`, not `reports.report_definitions`), because the schema already qualifies them — a prefix would only restate it.

## Access control

Two database roles split migration/seeding authority from runtime access — no row-level or per-tenant isolation beyond that, since this is a single-developer local learning project with no authentication/authorization or multi-tenancy in scope:

| Role | Privileges | Used for |
|---|---|---|
| `sampler` | Owns both schemas (`CREATE SCHEMA ... AUTHORIZATION sampler`); has `CREATE` on the database | Migrations, schema changes, and populating the synthetic sales dataset |
| `runner` | `USAGE` on both schemas; `SELECT`/`INSERT`/`UPDATE` on tables, granted automatically on every table `sampler` creates (`ALTER DEFAULT PRIVILEGES FOR ROLE sampler`) | Runtime access for the api and worker processes |

`runner` can never alter schema — no `CREATE`, no schema ownership — so a bug or bad input reaching the application can read and write rows but can't touch DDL. `sampler` is the only role migrations and dataset seeding ever run as. The default-privilege grant means `runner` automatically gets row access to any table `sampler` creates later, without a manual `GRANT` per new table.

## Data model

### ID generation

Every primary key is a `uuid` column, but the value is generated in the application layer as a UUIDv7 (time-ordered) identifier, not by a database-side random UUID default. A monotonically increasing key keeps new rows physically clustered at the end of the primary-key index instead of scattered across it, which matters because the sale-transactions and report-executions tables are both high-insert (a continuous synthetic feed, and one row per recomputation respectively) — a random v4 key would otherwise cause steadily worsening index bloat as either table grows. This is unrelated to the idempotency mechanism on report executions below: that mechanism dedups on a separate unique constraint over stable input fields, not on the row's own generated id.

### Enums

| Enum | Values | Used by |
|---|---|---|
| `aggregation_type` | `sum`, `avg`, `count`, `min`, `max` | report definitions' aggregation type |
| `group_by_dimension` | `product`, `region`, `day`, `week`, `month` | report definitions' grouping dimension |
| `definition_status` | `active`, `archived` | report definitions' status |
| `execution_trigger_type` | `cron`, `manual` | report executions' trigger type |
| `execution_status` | `pending`, `running`, `succeeded`, `failed` | report executions' status |

The aggregation/grouping vocabulary is a closed enum rather than an open string, matching the project's bounded, non-OLAP scope — every value the domain layer can legally produce is enumerable in advance, so there's no reason to defer that validation to the application layer alone.

### Tables

#### products / regions

```
sales.products
  id          uuid primary key
  name        text not null unique

sales.regions
  id          uuid primary key
  name        text not null unique
```

Dimension tables rather than free-text columns on the transaction row, so a product or region is one row referenced by every transaction and report grouping that touches it, instead of a string repeated and potentially misspelled across millions of rows.

#### transactions

```
sales.transactions
  id           uuid primary key
  product_id   uuid not null references sales.products(id)
  region_id    uuid not null references sales.regions(id)
  amount       numeric(12,2) not null
  occurred_at  timestamptz not null
  created_at   timestamptz not null default now()
```

`occurred_at` is the domain-meaningful event time (when the sale happened); `created_at` is purely the row's insertion time, kept separate because the synthetic feed may insert transactions out of order relative to when they occurred. Aggregation queries filter and group on `occurred_at`, `product_id`, and `region_id` — all three need an index to keep recomputation within a reasonable bound as the dataset grows.

#### definitions

```
reports.definitions
  id                uuid primary key
  name              text not null
  aggregation_type  aggregation_type not null
  group_by          group_by_dimension not null
  window_start      timestamptz not null
  window_end        timestamptz not null
  cron_expression   text not null
  version           integer not null default 1
  status            definition_status not null default 'active'
  created_at        timestamptz not null default now()
  updated_at        timestamptz not null
```

`version` only ever increases and is bumped on every config edit — this is the same version number the cache key encodes for passive, version-in-key cache invalidation. `window_start`/`window_end` are a fixed calendar range rather than a rolling duration: editing the window is itself a config edit like any other, and goes through the same version bump and cache invalidation as an aggregation-type or grouping change.

A report definition is retired by setting `status = 'archived'`, never by deleting the row — this preserves its execution history and keeps `executions.definition_id` a stable foreign key. The "no two active definitions share a name" invariant is enforced with a partial unique index:

```
create unique index definitions_active_name_idx
  on reports.definitions (name)
  where status = 'active';
```

An archived definition's name becomes reusable by a new active one, since the constraint only ever looks at active rows.

#### executions

```
reports.executions
  id                         uuid primary key
  definition_id       uuid not null references reports.definitions(id)
  definition_version  integer not null
  trigger_type               execution_trigger_type not null
  scheduled_for               timestamptz not null
  status                     execution_status not null default 'pending'
  worker_id                  text
  fencing_token              bigint
  result                     jsonb
  error_message              text
  started_at                 timestamptz
  finished_at                 timestamptz
  created_at                 timestamptz not null default now()
```

`definition_version` freezes the definition's version at the moment this execution was triggered, separately from the live `definitions.version` column, which keeps mutating. This matters for two reasons: it's an audit trail of which config an execution actually ran under, and it's part of the row's idempotency key below — if the definition is edited between a job's retries, the new version is deliberately treated as a different attempt, not a duplicate of the old one.

`worker_id`, `fencing_token`, and `error_message` are nullable because they're only known once a worker actually starts running the job (`status` moves past `pending`) — `fencing_token` is recorded here purely for audit/debugging visibility into which attempt won; the correctness guarantee itself is enforced where the lock and token counter actually live (Redis), not by this column.

`result` is a single `jsonb` column rather than a normalized per-group-key table, because its shape depends on `aggregation_type`/`group_by` and would otherwise need a different table per combination.

#### outbox

```
reports.outbox
  id            uuid primary key
  event_type    text not null
  aggregate_id  uuid not null
  payload       jsonb not null
  occurred_at   timestamptz not null
  published_at  timestamptz
```

A row is inserted in the same transaction as the aggregate change that raised the event, which is the whole point of the table: the event exists if and only if the change committed. `published_at` stays null until the relay has handed the row to the domain-events queue. The UUIDv7 `id` doubles as the relay's claim order, so no separate sequence column is needed.

`aggregate_id` has no foreign key: one table holds events from both report definitions and executions, and it's an informational reference for ordering and debugging, not a relationship the database must enforce.

The relay only ever scans pending rows, so a partial index keeps that scan proportional to the backlog rather than to the table's whole history:

```
create index outbox_pending_idx
  on reports.outbox (id)
  where published_at is null;
```

The relay claims a batch with `select ... where published_at is null order by id limit n for update skip locked`, so concurrent worker instances each claim a disjoint batch instead of blocking on or double-publishing the same rows.

Retention of published rows is not decided yet. `runner` has no `DELETE` privilege, so deleting published rows at runtime would require widening its grant for this table alone. The alternative is a maintenance cleanup run as `sampler`.

## Persistence invariants

- **No two active report definitions share a name** — enforced by the partial unique index above, scoped to `status = 'active'` so an archived name becomes reusable.
- **Idempotent execution identity** is enforced with a unique constraint over the inputs that stay stable across a retry or redelivery of the same job:

```
create unique index executions_idempotency_idx
  on reports.executions (definition_id, definition_version, trigger_type, scheduled_for);
```

`trigger_type` is part of the key so a manually forced recomputation never collides with that same tick's automatic cron run, while two retries of the *same* trigger (same scheduled tick, same trigger type) do collide and the retry is rejected as already-attempted rather than inserted as a second row.
- **Every domain event is written to its bounded context's outbox in the same transaction as the aggregate change that raised it** — never published outside that transaction, so an event can't exist for a rolled-back change or be lost after a committed one.
- **No foreign key crosses the `sales`/`reports` schema boundary** — every reference stays within its own schema.

## Infrastructure

Not provisioned yet. Planned: a single local Postgres instance run via Docker Compose, no hosted/remote environment, no replication or backup strategy beyond what a local learning project needs.

## Access patterns

Application code reaches Postgres through a query builder rather than raw SQL strings, and through a repository port/adapter split — the application layer never imports the query-builder library directly. Aggregation queries are expected to filter/group on the indexed `occurred_at`/`product_id`/`region_id` columns to avoid an unbounded full-table scan as the synthetic dataset grows.

### Transactional boundary

Writes run inside a transactional boundary (the *drizzler*) that owns the connection and receives an already-built DI container. It is not a classic unit of work: it knows no repositories and does no change tracking. It only delimits one run's transaction.

- The transaction executor is a DI binding that never exists on the root container. It is bound only inside the child scope the drizzler opens per run, and stores and seeders depend on it. Resolving any of them outside a run therefore fails loudly with a missing-token error. Otherwise it would silently write outside a transaction.
- The executor type is the common shape of a transaction and the root client, so an adapter can't tell which one it received.
- A run takes a DI token plus a callback and never hands out the container, so a caller can't use it as a service locator. Each run gets its own child scope, which means concurrent runs never share a transaction. If the callback throws, the transaction rolls back.
- Adapters never open their own transaction. If they did, several adapters could no longer be composed into one atomic run. The same applies to the dataset seeders, which all run inside a single run.
- Nothing that depends on the executor is registered as a singleton. A singleton would capture the transaction of the run that first built it, which is already closed by the next run.
- Resolution is synchronous, so the connection is validated with an explicit ping during bootstrap, before any run.
- Nested runs are not supported. An inner run opens an independent transaction, not a nested one, so runs are never nested.

---

## Non-goals

- No table for the cached report result (`report:snapshot:{reportId}:v{version}`) — that read model lives entirely in Redis and is never persisted to Postgres.
- No table for lock or fencing-token state — both are Redis-only, keyed per report, and don't have a durable Postgres counterpart.
- No cross-report dependency table (a report referencing another report's result) — this relationship is explicitly deferred at the domain level and isn't modeled here.
