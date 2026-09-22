# Structure

Stack choices, system topology, infrastructure, and cross-cutting patterns. The hexagonal layers themselves (domain, application, ports, adapters, event bus) are covered in `modules.md`, not here. The data model lives in `database.md`.

---

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Runtime | Bun + TypeScript | Fast local iteration. Compatibility of the recurring-job queue client (and its Redis client dependency) with this runtime is an open risk to verify early rather than assumed — see Open architecture decisions below. |
| Queue / scheduler | BullMQ | Provides repeatable jobs with a deterministic job identity: registering an already-registered recurring job under the same identity is a no-op rather than a duplicate, which is what this project relies on for safe multi-worker scheduling. |
| Queue & lock coordination | Redis (queues instance) | Backs BullMQ's job data and the hand-rolled distributed lock with fencing tokens. Both need the same durability guarantee — persisted writes, no key eviction — since a job or a lock/fencing-token key dropped under memory pressure breaks the coordination invariant. |
| Cache | Redis (cache instance) | Backs the versioned cache-aside read model only. Configured for key eviction rather than durability: a cache miss just triggers a recompute, so losing an entry is cheap and expected. |
| Persistence | Postgres via Drizzle | System of record for report definitions and report executions. |
| API | Elysia | REST surface for CRUD, result queries, and manual recomputation. |
| Local infra | Docker Compose | See Infrastructure below. |

## Topology

Nothing is implemented yet; this is the intended request/data flow once the base system lands:

```
HTTP request -> REST API adapter -> Application-layer use case
                                          |
                     +--------------------+--------------------+
                     |                    |                    |
           repository port         cache port           scheduler port
                     |                    |                    |
                Postgres          Redis (cache)         recurring-job queue
```

A recurring job fires on its own schedule (no inbound HTTP request involved), calls into the same Application-layer use case a manual recomputation would, and follows the same path down through the lock port and repository/cache ports. The lock port and the scheduler port both resolve to the same physical Redis instance (the queues instance, see Stack above) — a separate instance from the one behind the cache port.

## Infrastructure

Nothing is provisioned yet — the repository was fully purged and this section describes the intended provisioning for the earliest build phase, not current state. The intended local layout: a Postgres service and two Redis services — one for queues and locks, one for cache — each with its own Docker Compose service definition and environment configuration, wrapped by a root Compose entrypoint and a task-runner file for bringing the whole stack up or down. No hosted/remote environment exists — this project runs entirely as local containers.

## Cross-cutting patterns

- **Workers are stateless.** All coordination state (locks, fencing tokens) lives in Redis, and all durable state (executions) lives in Postgres — never in a worker process's memory. This is what makes running several worker instances of the same process safe: any one of them can be killed and replaced without losing state or corrupting in-flight coordination.
- **Latency budget for cached reads.** A report's current result must be servable from cache in well under 10ms — a project-wide performance target for the read path, not a per-report tuning decision.
- **Redis key namespacing.** Coordination and cache keys are namespaced by report, and the cached snapshot additionally by the report definition's version. The lock keys live on the queues instance, alongside BullMQ's own job data; the snapshot key lives on the cache instance:

```
lock:report:{reportId}                            # the distributed lock itself
lock:report:{reportId}:token                      # monotonic fencing-token counter for that lock
report:snapshot:{reportId}:v{definitionVersion}   # cached, versioned report result
```

## Open architecture decisions

- **Bun runtime compatibility with the queue/cache client libraries** is unverified. If BullMQ or its underlying Redis client has friction running on Bun, that has to surface and be resolved during the scaffolding phase, before any other phase builds on top of it — resolving it depends on actually running the queue client against a real Redis instance under Bun and observing whether it behaves as it does under Node.

---

## Non-goals

- No rate limiting, throttling, or public-network hardening — this system has no publicly reachable surface; it runs entirely as local containers for a single developer.
