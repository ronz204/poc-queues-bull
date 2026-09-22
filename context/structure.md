# Cerve — Structure

System architecture, stack choices, and cross-cutting patterns. Domain vision lives in `overview.md`; the build sequence lives in `approach.md`; mechanism explanations live in `expertise.md`.

---

## Architecture

The system follows Hexagonal Architecture combined with DDD tactical patterns:

- **Domain layer** — owns business rules; has no dependency on any infrastructure library.
  - The report definition aggregate root: its invariants are a valid cron expression, a version that only ever increases, and no two active definitions sharing a name.
  - The report execution entity: one concrete run of a report definition.
  - The report snapshot value object: the computed result of one execution.
  - Domain events: one raised when a report definition changes, one when a report execution completes successfully, one when a report execution fails.
- **Application layer** — use cases that orchestrate repositories and domain services through ports; contains no business logic of its own. Core use cases: creating a report definition, recalculating a report, and getting a report's current result.
- **Ports** — interfaces the application layer depends on, each with exactly one infrastructure implementation: a report-definition repository, a report-snapshot cache, a distributed lock, and a job scheduler.
- **Adapters** — the only layer allowed to import a concrete infrastructure library: the persistence adapter, the cache/lock adapter, the job-queue adapter, and the REST API layer.
- **Internal event bus** — connects aggregate writes to cache invalidation. Application/use-case code never talks to the cache infrastructure directly; it reacts to a domain event instead, which is what keeps the use case ignorant of caching as a concern.

See `.claude/rules/hexagonal-layering.md` for the enforced boundary rules.

## Stack

| Concern | Choice | Rationale |
|---|---|---|
| Runtime | Bun + TypeScript | Fast local iteration; compatibility of the queue client library with this runtime is an open risk to verify early rather than assumed. |
| Queue / scheduler | BullMQ | Provides repeatable jobs with deterministic job identity, which is the mechanism this project relies on for safe multi-worker scheduling (see `expertise.md`). |
| Cache / locks | Redis | Backs both the versioned cache-aside read model and the hand-rolled distributed lock with fencing tokens. |
| Persistence | Postgres via Drizzle | System of record for report definitions and report executions. |
| API | Elysia | REST surface for CRUD, result queries, and manual recomputation. |
| Local infra | Docker Compose | See layout below. |

## Local infrastructure layout

Local infra is split by service rather than kept in one compose file: a Postgres directory and a Redis directory, each owning its own compose definition and its own environment-sample file, with an optional scripts/config subdirectory for that service's provisioning needs. A root compose entrypoint and a task-runner file wrap `docker compose up` / `down` / `down -v` for the whole stack. This split is currently scaffolded (the directories and file names exist) but not yet populated with real service definitions — that lands in the scaffolding phase of the roadmap.

## Key schema

Redis keys are namespaced by report and, for the snapshot, by the report definition's version:

```
lock:report:{reportId}            # the distributed lock itself
lock:report:{reportId}:token      # monotonic fencing-token counter for that lock
report:snapshot:{reportId}:v{definitionVersion}   # cached, versioned report result
```

## Cross-cutting patterns

- **Workers are stateless.** All coordination state (locks, fencing tokens) lives in Redis, and all durable state (executions) lives in Postgres — never in a worker process's memory. This is what makes running several worker instances of the same process safe: any one of them can be killed and replaced without losing state or corrupting in-flight coordination.
- **Latency budget for cached reads.** A report's current result must be servable from cache in well under 10ms — this is a project-wide performance target for the read path, not a per-report tuning decision.
