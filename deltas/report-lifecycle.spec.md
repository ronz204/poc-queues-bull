# Report lifecycle — Spec

> Owns a report definition's configuration lifecycle, the recurring recomputation of its result across concurrent workers, and serving that result from a versioned cache.

## Intent

A report definition is a user-created configuration describing which aggregate to compute over the sales dataset, on what recurring schedule, and grouped by which dimension. This slice owns the full lifecycle that configuration drives: defining, editing, and retiring it; recomputing its result safely no matter how many worker processes are running concurrently; and serving that result from a fast cache instead of recomputing it on every read.

## Scope

Owns:

- Report definition CRUD: create, edit (config change), list with status, archive — and the config invariants below.
- Report execution: one concrete recomputation run's lifecycle (pending, running, succeeded, failed), triggered either by the definition's own cron schedule or by a manually forced request.
- Recurring job registration and rescheduling for each active report definition, under a deterministic job identity.
- Distributed locking with a fencing token around each recomputation, so concurrent workers never compute the same report concurrently in an uncontrolled way.
- The versioned cache-aside read model for a report's current result, and both invalidation strategies it uses (passive version-in-key on a config change; active fencing-guarded overwrite on a completed execution).
- Idempotent execution identity, so a retried or redelivered recomputation job never produces a duplicate execution record.
- Recording every domain event this slice's aggregates raise in the slice's own outbox, and the consumers that react to those events (the recurring-job reconciler and the cache overwrite).

Non-goals:

- Ingesting sale transactions is owned by the sibling `sales-ingestion` slice — this slice only reads sale transactions and the product/region dimension tables to compute an aggregate; it never writes to any of them.
- The product/region dimension reference data itself is not this slice's concern, only a read dependency of it.
- Cross-report dependencies (a report computed from another report's already-computed result) are explicitly out of scope for the base system — see Deferred / Open questions.
- Authentication/authorization, multi-tenancy, a dashboard UI, and a general OLAP query surface are project-wide non-goals, restated here because this is the slice a contributor would most plausibly be tempted to grow one of them into.
- Persisting a retry/attempt counter is not this slice's concern — retry/backoff state for a failed execution lives entirely in the job queue's own per-job attempt tracking, never as a column on the execution record.
- A metrics endpoint (lock acquisitions, cache hit/miss ratio, execution durations) and a minimal read-only view of report state are project-wide stretch goals, not part of the base system this slice's contract covers.

## Contract

**Report definition — config fields (create/edit input):**

| Field | Type | Notes |
|---|---|---|
| `name` | string | Must be unique among active definitions; an archived definition's name becomes reusable. |
| `aggregationType` | enum: `sum`, `avg`, `count`, `min`, `max` | Closed vocabulary — no open-ended aggregation expression. |
| `groupBy` | enum: `product`, `region`, `day`, `week`, `month` | Closed vocabulary. |
| `windowStart` / `windowEnd` | timestamp | A fixed calendar range, not a rolling duration — changing either is a config edit like any other. |
| `cronExpression` | string | Must be syntactically valid at create/edit time. |

**Report definition — read-only/derived fields:** `id`, `version` (integer, only ever increases), `status` (`active` \| `archived`), `createdAt`, `updatedAt`, plus per-definition derived status shown on listing: last execution outcome, next scheduled run, last success/failure.

**Report execution — fields:**

| Field | Type | Notes |
|---|---|---|
| `id` | id | |
| `definitionId` | id | |
| `definitionVersion` | integer | Frozen at trigger time — see Invariants. |
| `triggerType` | enum: `cron`, `manual` | Part of the idempotency key. |
| `scheduledFor` | timestamp | The tick this execution corresponds to; part of the idempotency key. |
| `status` | enum: `pending`, `running`, `succeeded`, `failed` | Lifecycle moves forward only; `failed` may return to `pending`/`running` via a queue-driven retry of the same row. |
| `workerId` | string, nullable | Known once a worker actually starts the job. |
| `fencingToken` | integer, nullable | Recorded for audit/debugging visibility only — the correctness guarantee is enforced where the lock/token live, not by this field. |
| `result` | structured, nullable | Shape depends on `aggregationType`/`groupBy`. |
| `errorMessage` | string, nullable | |
| `startedAt` / `finishedAt` | timestamp, nullable | |

**Use cases this slice exposes:**

1. Create a report definition — validated against the config invariants below; records `definition.created`.
2. Edit a report definition — bumps `version`, persists the change, records `definition.changed`. The reschedule and the orphaning of the old version's cache key follow from that event, never from the use case directly.
3. Archive a report definition — terminal; records `definition.archived`, which removes its recurring job.
4. List report definitions with derived status (last execution, next scheduled run, last success/failure).
5. Get a report's current result — cache-first; a miss triggers a synchronous recomputation.
6. Force a manual recomputation — goes through the same lock as the automatic cron trigger.
7. View a report's execution history — duration, success/failure, which worker ran it.

**Domain events** (recorded in `reports.outbox`, delivered by the outbox relay as one domain-events queue job per consumer):

| Event | Raised by | Carries | Consumed by |
|---|---|---|---|
| `definition.created` | Create | definition id, version, cron expression | Recurring-job reconciler |
| `definition.changed` | Edit | definition id, new version, cron expression | Recurring-job reconciler (cache needs nothing: the old key is orphaned passively) |
| `definition.archived` | Archive | definition id | Recurring-job reconciler |
| `execution.succeeded` | A recomputation completing | execution id, definition id and version, snapshot (result + fencing token) | Cache overwrite, fencing-guarded |
| `execution.failed` | A recomputation failing | execution id, definition id, error message | None yet |

The recurring-job reconciler treats all three definition events alike, as "definition X changed". It never applies a payload. It reads the definition's current state and converges the recurring job to it: an active definition gets a job with its current cron expression, and an archived definition gets none.

**Coordination key shapes:**

```
lock:report:{reportId}                            # distributed lock
lock:report:{reportId}:token                      # monotonic fencing-token counter
report:snapshot:{reportId}:v{definitionVersion}    # cached, versioned result
```

**Retry configuration:** a failed execution is retried by the job queue up to 3 attempts total (1 initial + 2 retries), with exponential backoff starting at 5s. This is a queue-level job option, not a value read from `executions` — see Invariant 13.

## Invariants

1. No two active report definitions share the same `name`; an archived definition's name becomes reusable by a new active one.
2. `version` only ever increases, and is bumped on every config edit — aggregation type, grouping, window, or cron expression.
3. `cronExpression` must be syntactically valid at the moment a definition is created or edited.
4. Archiving is terminal: an archived definition can never be reactivated back to active. The only path forward is creating a new definition, optionally reusing the name it freed up.
5. A recurring job is registered under a job identity deterministically derived from the report definition's own identity: re-registering an already-registered job is a no-op/update, never a duplicate. Each definition's recurring job converges to that definition's current state in Postgres: an active definition has exactly one job with its current cron expression, and an archived one has none. The reconciler reaches this by reading the current state, applying it, and re-reading until the two match. It never applies an event's payload, so duplicated or reordered events can't leave a stale schedule behind.
6. A worker must hold the distributed lock for a report, with a valid fencing token, before writing a recomputation's result. A write presenting a fencing token older than one already recorded is rejected outright, regardless of whether the writer still believes it holds the lock.
7. A manually forced recomputation goes through the same locking mechanism as the automatic cron trigger — the two can never run concurrently against the same report.
8. Execution identity is idempotent: `(definitionId, definitionVersion, triggerType, scheduledFor)` uniquely identifies one attempt. A retry of that same attempt — including an automatic queue-driven backoff retry — updates the existing execution row rather than inserting a new one, since a second insert under an already-existing key is rejected as a duplicate. The queue's own attempt/backoff bookkeeping is never persisted on the execution row itself.
9. `definitionVersion` on an execution freezes the definition's version at trigger time. If the definition is edited between retries of the same attempt, the new version is treated as a genuinely different attempt, never a duplicate of the old one.
10. Cache invalidation follows exactly one of two strategies depending on what changed: a definition config change orphans the old cache key passively — a new version simply reads under a new key, and the old key expires on its own TTL; a completed execution overwrites the current version's key actively and immediately, guarded by the fencing-token check.
11. Reading a report's current result checks the cache first; on a miss it triggers a synchronous recomputation rather than returning an empty or absent result.
12. A cached read is servable in well under 10ms.
13. A failed execution retries automatically with backoff, driven entirely by the job queue's own retry mechanism up to that mechanism's own bounded attempt limit. Postgres never tracks the attempt count — only the execution row's current status.
14. Every domain event this slice raises is written to `reports.outbox` in the same transaction as the aggregate change that raised it. No use case publishes to a queue or calls the scheduler or cache ports in reaction to its own write, so an event exists if and only if its change committed.
15. Event delivery is at-least-once, so every consumer of this slice's events is idempotent and independent of event order. Processing an event twice, or processing an older event after a newer one, leaves the same end state as processing each once in order.

## Deferred / Open questions

- **Cross-report dependencies** (e.g. a margin report depending on a revenue report and a cost report) are out of scope for the base system. Revisiting this is tied to the stretch-goal phase being prioritized; no scaling point or threshold has been set for when that happens.

## Acceptance criteria

- A report definition can be created, edited (bumping `version`), listed with derived status, and archived through the API.
- A created report recomputes on its own configured schedule, and its result is servable from cache in well under 10ms.
- Multiple worker processes running in parallel observably never compute the same report concurrently in an uncontrolled way.
- A reproducible test or demo shows a worker that resumes after its lock has expired failing to overwrite a newer result — the fencing-token check holds.
- Editing a report definition leaves the old cached result to expire on its own TTL; new reads reflect the new version without manual intervention.
- A retried or duplicated recomputation job — including an automatic backoff retry — never produces a duplicate execution record.
- A report's execution history (duration, success/failure, which worker ran it) is viewable for debugging.
- Forcing a manual recomputation never runs concurrently with that report's own automatic cron trigger.
- Killing a process between a definition change's commit and its effect never leaves an active definition without its recurring job, or an archived one with a job; once the relay and reconciler run, the job matches the definition.
- Two rapid edits of the same definition processed concurrently, or out of order, leave its recurring job on the latest cron expression.

## Context (optional)

A worker can hold a lock, stall past its TTL for any reason (a GC pause, scheduling delay, network partition), have the lock expire and get reacquired by another worker, then resume and act as though it still holds it — a "zombie" writer, correct from its own point of view but wrong from the system's. The fencing token (Invariant 6) is what actually prevents this: it's checked again at the moment of the guarded write, against the highest token any prior writer has already used, not just carried alongside the lock as proof of possession. The lock's TTL is a liveness mechanism only, so a genuinely dead worker doesn't block a report forever — correctness comes entirely from the fencing-token check at write time.

---

Last updated: 2026-09-24.
