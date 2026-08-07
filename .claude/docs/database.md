# Cascade — Database Design

Design reference for Cascade's Postgres schema. Two tables total, covering the full domain of this POC — a single `public` schema. Not yet implemented: this describes the target shape, no migration has created these tables yet.

`orders` is the source of truth for the order's **current state**. `order_events` is the log of **how it got there** — queried to reconstruct an order's history without going to Redis/BullMQ, which only holds the job while it's in flight. `order_events.order_id` references `orders.id` with `ON DELETE CASCADE` — an event is meaningless without its order.

---

## Enums

```sql
CREATE TYPE order_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled'
);
```

**Why `order_status` is a native enum and `event_type` isn't:** `order_status` is a closed, stable set — the pipeline's five states don't change from phase 1 to phase 7, only what happens *inside* each state changes (adding a Flow in phase 6 doesn't add a new state to `orders`, it adds more events inside `processing`). `order_events.event_type` is deliberately left as `TEXT` instead — each new phase introduces its own event types (`payment_charged` in phase 3, `notification_queued` in phase 4/7, `flow_child_completed` in phase 6), and turning that into a native enum would mean an `ALTER TYPE` migration on almost every phase. The mechanism here is simple (a catalog table would be overkill for a list of values that isn't even validated at runtime), but the reasoning holds either way: **what grows phase by phase stays free text, what's structurally stable becomes an enum.**

---

## `orders`

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` — generated in the application layer via the project's shared UUIDv7 helper, not a database default |
| `status` | `order_status` | `NOT NULL DEFAULT 'pending'` |
| `payload` | `JSONB` | `NOT NULL` — fake order data (customer, items, amount); there are no real `customers`/`products` tables, modeling them doesn't serve this POC's goal |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

**Indexes:**
- `CREATE INDEX ON orders (status);` — the abandoned-order sweeper (phase 2) and any "active orders" view filter on `status` constantly.
- `CREATE INDEX ON orders (created_at) WHERE status = 'pending';` — partial index, built specifically for the sweeper's query (`pending` + old by `created_at`), the only recurring range query against this table.

**Note on `updated_at`:** no automatic trigger — it's set explicitly on every `UPDATE` from the worker/API code. With two tables and no ORM magic hiding the trigger, a `BEFORE UPDATE` trigger isn't worth the ceremony here.

---

## `order_events`

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` — same application-layer UUIDv7 generation as `orders.id` |
| `order_id` | `UUID` | `NOT NULL REFERENCES orders(id) ON DELETE CASCADE` |
| `event_type` | `TEXT` | `NOT NULL` — see the enum note above for why this isn't one. Values used across phases: `order_created`, `payment_charged`, `payment_failed`, `inventory_reserved`, `notification_queued`, `notification_sent`, `order_completed`, `order_failed`, `order_cancelled`, `flow_child_completed` |
| `detail` | `JSONB` | `NOT NULL DEFAULT '{}'` — free-form payload per event: retry attempt, failure reason, the associated BullMQ `job.id`, etc. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

**No `updated_at`** — append-only: an event isn't corrected, a new one that clarifies it gets added instead.

**Index:** `CREATE INDEX ON order_events (order_id, created_at);` — this table's central query: "give me this order's full history, in order."

---

## Deliberately left out

| Element | Why it doesn't apply here |
|---|---|
| A dedicated `failed_orders`/DLQ table | The dead letter queue lives in BullMQ (the `failed-orders` queue), not in Postgres — Postgres only stores the `order_failed` event in `order_events` once the worker processes it. Duplicating that state in a table would be an unnecessary second source of truth. |
| `deleted_at` / soft-delete | No order-deletion flow in the domain. |
| A catalog table for `event_type` | The value set is small and grows by development phase, not by business data — doesn't warrant a separate table, free `TEXT` is enough. |

---

## Open questions

1. **Should `payload` have its own columns (`customer_name`, `amount`) instead of plain `JSONB`?** Not for now — nothing in the POC needs to filter/aggregate on those fields at the SQL level, and keeping it `JSONB` avoids a migration every time the simulated fake data changes shape.
2. **Does `order_events.event_type` eventually need a `CHECK` against an allowed value list?** Left unvalidated on purpose for now — adding it is a one-line migration once the list stabilizes (probably after phase 6, once no new event types are being added).
