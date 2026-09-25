# Structure

Stack choices, system topology, infrastructure, and cross-cutting patterns. The hexagonal layers themselves (domain, application, ports, adapters, domain event delivery) are covered in `modules.md`, not here. The data model lives in `database.md`.

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
| Validation | Zod | Declares each use case's input/output once, as a runtime schema whose static types are inferred from it; the same schema validates the HTTP request. Validates shape only — business invariants stay in the domain. |
| Local infra | Docker Compose | See Infrastructure below. |

## Topology

Nothing is implemented yet; this is the intended request/data flow once the base system lands. The system runs as two separate OS processes — an api process and a worker process — each started from its own entrypoint but sharing the same Application-layer use cases and ports:

```
api process:
HTTP request -> use-case HTTP plugin -> Application-layer use case
                                          |
                     +--------------------+
                     |                    |
         store ports + outbox        cache port
          (one transaction)               |
                     |              Redis (cache)
                 Postgres

worker process:
recurring job fires -> Application-layer use case
                                          |
                     +--------------------+--------------------+
                     |                    |                    |
         store ports + outbox        cache port             lock port
                     |                    |                    |
                Postgres          Redis (cache)         Redis (queues)

outbox relay (worker) -> polls Postgres outbox -> domain-events queue (Redis, queues)
domain-events consumers (worker) -> scheduler reconciler -> recurring-job queue
                                 -> cache overwrite      -> Redis (cache)
```

A recurring job fires on its own schedule inside the worker process (no inbound HTTP request involved), calls into the same Application-layer use case a manual recomputation would, and follows the same path down through the lock port and store/cache ports.

Neither process registers, updates, or removes a recurring job directly from a use case. A use case only records a domain event in the outbox within its own transaction; the relay and the domain-events consumers, both running in the worker process, carry the effect to the scheduler and the cache afterwards. The api process therefore never talks to the queue at all. The lock port and the scheduler port both resolve to the same physical Redis instance (the queues instance, see Stack above) — a separate instance from the one behind the cache port.

The process split exists because the two have different lifecycles: the api process is stateless request handling with no coordination role of its own, while several instances of the worker process are expected to run concurrently against the same report definitions — that's the situation the distributed lock and fencing token exist to arbitrate (see Cross-cutting patterns below). Keeping worker a separate process from api is what lets worker instances be started, stopped, or scaled independently, without affecting request handling.

## Infrastructure

A Postgres service and two Redis services — one for queues and locks, one for cache — each run as their own Docker Compose service definition, wrapped by a root Compose entrypoint that includes them. No hosted/remote environment exists — this is local-only infrastructure for a single developer.

The api and worker processes themselves are not containerized — both run directly on the host against that containerized infra, the same way a single combined process would have. Containerizing them is deferred rather than ruled out: nothing about the topology forces it, and it isn't needed until there's a deployment target beyond local development.

## Cross-cutting patterns

- **Workers are stateless.** All coordination state (locks, fencing tokens) lives in Redis, and all durable state (executions) lives in Postgres — never in a worker process's memory. This is what makes running several worker instances of the same process safe: any one of them can be killed and replaced without losing state or corrupting in-flight coordination.
- **Domain events are delivered at-least-once.** The outbox relay can hand the same event to the queue twice (a crash between enqueueing and marking it published), and consumers run concurrently, so every consumer is idempotent and order-independent: the scheduler consumer reconciles against the datastore's current state, and the cache consumer relies on the fencing-token check.
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

- No rate limiting, throttling, or public-network hardening — this system has no publicly reachable surface; it runs entirely on a single developer's machine, against local containerized infra.
