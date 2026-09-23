# Sales ingestion — Spec

> Owns the continuous synthetic feed of sale-transaction events that report-lifecycle's recurring recomputation aggregates over.

## Intent

Sale transactions are the raw event stream report-lifecycle's recurring recomputation aggregates over. Without something continuously producing new transactions, every report would recompute against a static, never-changing dataset forever, which defeats the point of "recurring" recomputation. This slice owns generating and inserting synthetic sale-transaction events continuously, so reports have live-looking data to recompute against over time.

## Scope

Owns:

- Continuously generating and inserting new rows into `sales.sale_transactions`, referencing existing products/regions.
- The recurring job that drives each insertion tick, registered under a deterministic job identity — the same mechanism report-lifecycle's recurring recomputation jobs use.

Non-goals:

- Does not seed the initial historical dataset or the products/regions dimension tables. That's the existing one-shot bootstrap seeder (`drizzle/database/seeders`, run via the `drizz:seeding` script) — scaffolding/dev-tooling that populates a starting dataset to test aggregation against, not this domain capability. If that seeding infrastructure ever needs documenting, it belongs in `structure.md`/`database.md` as an infrastructure fact, not in this spec — it has no invariant of its own worth protecting as a capability contract.
- Does not use distributed locking or a fencing token, unlike report-lifecycle's recomputation path. A future contributor could assume this slice needs the same coordination mechanism since it's this project's other recurring-job slice — it doesn't: inserting a new synthetic transaction is a pure append, never an overwrite of existing state, so there is no "stale writer overwrites a newer result" hazard to guard against. Deterministic job identity alone is enough to prevent the recurring feed job itself from being registered twice.
- Does not compute or read report aggregates — this slice only ever writes to `sales.sale_transactions`.
- Does not manage the products/regions reference data lifecycle (creating, renaming, retiring one) — it only reads existing rows to reference from a generated transaction.
- Does not persist a retry/attempt counter or an idempotency key for a feed tick — see Invariants: a lost or duplicated tick has no correctness consequence, unlike a report execution.

## Contract

- The feed runs as a recurring job inside the worker process, registered under a deterministic job identity, firing on a fixed interval of 5 seconds.
- Each tick inserts a random count of new `sale_transactions` rows, between 1 and 5.
- Per generated transaction:

| Field | Generation rule |
|---|---|
| `productId` / `regionId` | Picked uniformly at random from the currently existing products/regions rows. |
| `amount` | Uniformly random within [5, 500] — matches the existing bootstrap seeder's range, so the feed doesn't visibly shift a report's aggregate distribution the moment it starts. |
| `occurredAt` | Normally the tick's current time; the generator may occasionally set it slightly earlier to simulate delayed/out-of-order delivery. |

- The feed depends on products/regions already being seeded before it starts. It does not seed them itself and does not defend against an empty products/regions table — an operational precondition, not a runtime concern this contract covers.

## Invariants

1. The feed job is registered under a job identity deterministically derived from the feed itself — not per-tick, not per-worker. Re-registering it (e.g. because multiple worker instances start up) is a no-op/update, never a duplicate registration.
2. Every inserted transaction references a `product_id`/`region_id` that actually exists at insertion time — enforced by the foreign-key constraints on `sale_transactions`, and the generator itself must only ever pick from currently-seeded rows, never invent an id.
3. No distributed lock or fencing token guards an insertion tick. Concurrent execution of two ticks (which shouldn't happen given Invariant 1, but wouldn't be a correctness violation if it somehow did) only ever appends more rows — it can never cause one writer to overwrite another's result, unlike report-lifecycle's recomputation path.
4. A failed or lost insertion tick has no correctness consequence: there is no idempotency key, no persisted retry/attempt count, and no requirement that a lost tick be retried — the next recurring tick simply fires as scheduled and inserts new synthetic rows. This is a deliberate contrast with report-lifecycle's execution idempotency requirement, since a synthetic transaction has no real-world source of truth being duplicated or lost.
5. `occurredAt` is not required to equal the row's insertion time — consistent with, not a new constraint beyond, the existing `occurred_at`/`created_at` split already in place for `sale_transactions`.

## Deferred / Open questions

- **Weighted vs. uniform-random product/region selection.** Whether the generator should weight selection to simulate realistic sales skew (some products/regions selling disproportionately more) instead of uniform-random is undecided. Revisit only if a report's aggregate output needs more realistic variation to be a meaningful demo — the current uniform-random choice was made for consistency with the existing bootstrap seeder, not as a permanent design commitment.
- **Out-of-order backdating parameters.** The exact frequency/probability and how far back the occasional out-of-order `occurredAt` backdating reaches isn't pinned to a specific number — that the behavior happens at all is settled (Contract), the precise parameters are an implementation detail to decide when this is built.

## Acceptance criteria

- With multiple worker process instances running concurrently, the feed's recurring job is observably registered exactly once, never duplicated per worker instance.
- `sale_transactions` grows continuously while the worker process runs — a manual or automated check confirms the row count increases over a several-tick window with no manual trigger.
- Every transaction the feed inserts references a `product_id`/`region_id` that exists at insertion time — the generator never attempts an id outside the currently-seeded set.
- Restarting the worker process does not produce a duplicate feed-job registration.
- An integration-level demo shows a report-lifecycle report's recomputed result changing across successive scheduled recomputations as the feed continues inserting new transactions in between them.

---

Last updated: 2026-09-22.
