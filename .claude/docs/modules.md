# Modules

Per-component functional reference for the hexagonal architecture's own layers. Why these layers exist and how they map to the stack lives in `structure.md`, not here. None of this is implemented yet — this describes the intended design each component must conform to once built.

---

## Domain layer

**Purpose.** Owns every business rule and invariant. Has no dependency on any infrastructure library — nothing here imports a database driver, a cache client, or a queue client.

**Flow.**
1. The report definition aggregate root enforces its own invariants on every state change: a syntactically valid cron expression, a version number that only ever increases, and no two active definitions sharing a name.
2. The report execution entity represents one concrete run of a report definition — its lifecycle moves through pending, running, and a terminal succeeded/failed state.
3. The report snapshot value object represents the computed result of one execution — immutable once produced.
4. A state-changing operation on the aggregate root produces a new instance and raises a domain event rather than mutating in place: one event when a report definition's configuration changes, one when a report execution completes successfully, one when a report execution fails.

**Data shape.** Conceptually, the aggregate root carries its identity, its aggregation type, grouping dimension, time window, cron expression, and version; the execution entity carries its own identity, the definition version it ran under, its trigger type, timing, status, and result; the snapshot value object carries the computed aggregate result plus the fencing token that produced it. This is the conceptual shape only — the concrete persisted representation is a separate, storage-specific concern.

**Dependencies.** Depended on by the Application layer; depends on nothing else.

## Application layer

**Purpose.** Orchestrates use cases by calling the domain layer and the ports below. Contains no business logic of its own — every rule it might otherwise duplicate belongs in the domain layer instead.

**Flow.** The use cases this layer exposes:
1. Create a report definition — validates the requested config against the domain layer's invariants and persists it via the repository port.
2. Edit a report definition — bumps its version, persists the change, and raises the definition-changed domain event; the reschedule (if the cron expression changed) and cache orphaning both react to that event rather than being called directly here.
3. List report definitions with their status — last execution, next scheduled run, last success/failure.
4. Get a report's current result — reads from the cache port first; on a miss, triggers a synchronous recomputation rather than returning nothing.
5. Force a manual recomputation — goes through the same locking mechanism as the automatic cron trigger, so a manual and an automatic recomputation of the same report can never run concurrently.
6. View a report's execution history for debugging/observability — duration, success/failure, and which worker ran it.
7. Ingest a sale transaction — the entry point for the simulated continuous data feed.

**Data shape.** Each use case takes a plain command or query object (the fields a caller must supply) and returns a plain result object — no dependency on any adapter's request/response shape.

**Dependencies.** Depends on the Domain layer and on the Ports below; depended on by the Adapters (the REST API adapter calls into it; nothing here calls back into an adapter).

## Ports

**Purpose.** The interfaces the Application layer depends on instead of a concrete infrastructure library. Each port has exactly one adapter implementing it, which is what lets the application layer stay ignorant of which concrete technology backs a capability.

**Flow.** Four ports, one per infrastructure concern:
1. A report-definition repository port — persist and load report definitions and executions.
2. A report-snapshot cache port — read and write the cached, versioned report result.
3. A distributed lock port — acquire and release a lock scoped to one report, with a fencing token issued on each successful acquisition.
4. A job scheduler port — register, update, and deregister a recurring recomputation job for a report definition.

**Data shape.** Each port is a narrow interface: the repository port exposes save/find operations over the domain aggregates; the cache port exposes get/set keyed by report and definition version; the lock port exposes acquire/release/renew plus the current fencing token; the scheduler port exposes register/deregister keyed by a deterministic job identity.

**Dependencies.** Depended on by the Application layer; implemented by the Adapters below.

## Adapters

**Purpose.** The only layer allowed to import a concrete infrastructure library. Translates between a port's interface and the real technology behind it.

**Flow.**
1. The persistence adapter implements the repository port against the relational datastore.
2. The cache/lock adapter implements both the cache port and the distributed lock port against the same in-memory store, since both the cached snapshot and the lock/fencing-token state live there.
3. The job-queue adapter implements the scheduler port against a recurring-job queue technology that supports deterministic job identity.
4. The REST API adapter translates inbound HTTP requests into Application-layer use case calls and their results back into HTTP responses.

**Data shape.** Adapter-specific request/response and query shapes stay local to each adapter — none of them leak into the Application layer's command/query objects.

**Dependencies.** Each adapter depends on (implements) exactly one port; nothing outside the adapters layer imports an infrastructure library directly.

## Event bus

**Purpose.** Connects an aggregate write to cache invalidation without making the Application layer aware of caching as a concern — a use case reacts to a domain event instead of calling the cache port directly.

**Flow.**
1. After a use case successfully persists an aggregate change, it publishes the resulting domain event on the internal bus.
2. A cache-invalidation reactor subscribes to that event and is the only place that calls the cache port in response to a definition or execution change.
3. Which invalidation strategy the reactor applies depends on which event fired: a definition change orphans the old cache key passively (a new version reads under a new key), while an execution result overwrites the current version's key actively, guarded by the fencing token.

**Data shape.** An event carries its type, the aggregate identity it concerns, and the data needed to act on it (e.g. the new version number, or the execution's result and fencing token).

**Dependencies.** Published to by the Application layer; subscribed to by the cache-invalidation reactor, which in turn depends on the cache port.
