# Approach

The build sequencing philosophy for the reporting engine: what gets built together, in what order, and what "done" means. Domain vision lives in `overview.md`; architecture and stack live in `structure.md`/`modules.md`; the underlying mechanisms live in `expertise.md`.

---

## Technical pillars

The project exists to build these four capabilities together, because the domain genuinely needs all of them at once rather than any one being bolted on artificially:

| Pillar | What it means here |
|---|---|
| Recurring scheduling & worker coordination | Each active report definition drives a recurring recomputation job; multiple worker processes can run concurrently without two of them computing the same report at the same uncontrolled time. |
| Distributed locking with fencing tokens | A worker must hold a distributed lock before recomputing a report, and a monotonically increasing token tied to that lock protects against a worker that resumes after its lock has already expired and overwrites a newer result with a stale one. |
| Versioned cache-aside invalidation | The cached result of a report is served without touching the primary datastore when fresh, and invalidation follows two distinct strategies depending on what changed: a definition change orphans the old cache key passively, while a completed execution overwrites the current version's key actively. |
| Idempotent execution | A retried or duplicated recomputation job must not produce a duplicate execution record. |

## Functional scope

The base system must support:

- Creating a report definition: name, aggregation type, grouping dimension, time window, and a recomputation cron expression.
- Editing a report definition: any config change bumps its version, which invalidates the associated cache and reschedules the recomputation job if the cron expression changed.
- Listing report definitions along with their status: last execution, next scheduled run, and last success/failure.
- Reading a report's current result, served from cache when fresh, or forcing/awaiting a recomputation when it isn't.
- Forcing a manual recomputation of a report, respecting the locking mechanism so it can never run concurrently with that report's own automatic cron trigger.
- Viewing a report's execution history for debugging and observability: duration, success/failure, and which worker ran it.
- Simulating continuous data ingestion, so reports have live-looking data to aggregate.

## Roadmap

Work proceeds in phases, each intended to land as its own commit/branch, building the system up from a bare scheduling loop to the full coordination model:

0. **Scaffolding** — local infra (Postgres + Redis via Docker Compose), the hexagonal folder structure, and a single hardcoded report definition recomputing on a fixed interval with no lock and no cache, just to prove the job loop runs.
1. **Domain & persistence** — report definitions and report executions modeled as aggregates with their real invariants, backed by real CRUD through the API. No locks, no cache yet.
2. **Real scheduling** — one recurring job per report definition, rescheduled on cron edits, with a deterministic job identity, safe under multiple concurrently running worker processes.
3. **Distributed locking + fencing tokens** — the lock and token mechanism from the pillars table above, hand-rolled first rather than reaching for a locking library, so the mechanism itself is understood before evaluating a library alternative; demonstrated against a simulated worker-failure (zombie) scenario.
4. **Versioned cache-aside** — the cached read model, served from cache with a synchronous-compute fallback when no snapshot exists yet.
5. **Event-driven invalidation** — the two invalidation strategies above wired to their respective domain events (a definition change orphans a key passively; an execution result overwrites a key actively, guarded by the fencing token).
6. **Idempotency & hardening** — deterministic execution identity, retry handling, a synthetic data feed to keep reports computing over live-looking data, and basic observability of which worker executed what.
7. **Stretch: cross-report dependencies** — a cascading-recalculation graph across reports that depend on each other's results. Explicitly non-blocking for the base system.

## Risks

- **Bun + BullMQ/Redis-client compatibility is unverified.** If the recurring-job queue client (or its underlying Redis client) has friction running under Bun instead of Node, that has to surface during phase 0 — the entire roadmap from phase 2 onward depends on repeatable jobs working correctly on this runtime, so this risk needs resolving before it's load-bearing for anything else.

## Done criteria

The base system (through the hardening phase) is done when all of the following hold:

- A report can be created, recomputes on its own schedule, and its result is servable from cache well under 10ms.
- Multiple worker processes can run in parallel and observably never compute the same report concurrently in an uncontrolled way.
- A reproducible test or demo shows a worker that resumes after its lock has expired failing to overwrite a newer result — the fencing-token mechanism holds.
- Editing a report definition leaves the old cached result to expire on its own, with new reads reflecting the new version without manual intervention.
- A retried or duplicated recomputation job never produces a duplicate execution record.

## Stretch goals

Explicitly non-blocking for the base system:

- Cross-report dependencies with cascading invalidation.
- A metrics endpoint surfacing lock acquisitions, cache hit/miss ratio, and execution durations.
- A minimal read-only view of report state as an alternative to calling the API directly.
