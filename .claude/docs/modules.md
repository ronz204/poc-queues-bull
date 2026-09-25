# Modules

Per-component functional reference for the hexagonal architecture's own layers. Why these layers exist and how they map to the stack lives in `structure.md`, not here. Most of this is not implemented yet — it describes the intended design each component must conform to once built.

---

## Domain layer

**Purpose.** Owns every business rule and invariant. Has no dependency on any infrastructure library — nothing here imports a database driver, a cache client, or a queue client.

**Flow.**
1. The report definition aggregate root enforces its own invariants on every state change: a syntactically valid cron expression, a version number that only ever increases, and no two active definitions sharing a name.
2. The report execution entity represents one concrete run of a report definition — its lifecycle moves through pending, running, and a terminal succeeded/failed state.
3. The report snapshot value object represents the computed result of one execution — immutable once produced.
4. A state-changing operation on an aggregate produces a new instance and returns the domain event it raises alongside it, rather than mutating in place or publishing anything itself. A report definition raises one event per lifecycle change — created, changed (config edit), archived — and a report execution raises one when it succeeds and one when it fails.

**Data shape.** Conceptually, the aggregate root carries its identity, its aggregation type, grouping dimension, time window, cron expression, and version; the execution entity carries its own identity, the definition version it ran under, its trigger type, timing, status, and result; the snapshot value object carries the computed aggregate result plus the fencing token that produced it. This is the conceptual shape only — the concrete persisted representation is a separate, storage-specific concern.

**Dependencies.** Depended on by the Application layer; depends on nothing else.

## Application layer

**Purpose.** Orchestrates use cases by calling the domain layer and the ports below. Contains no business logic of its own — every rule it might otherwise duplicate belongs in the domain layer instead.

**Flow.** The use cases this layer exposes:
1. Create a report definition — validates the requested config against the domain layer's invariants, persists it, and records the definition-created event.
2. Edit a report definition — bumps its version, persists the change, and records the definition-changed event; the reschedule and cache orphaning react to that event rather than being called directly here.
3. Archive a report definition — persists the terminal archived status and records the definition-archived event, which removes its recurring job.
4. List report definitions with their status — last execution, next scheduled run, last success/failure.
5. Get a report's current result — reads from the cache port first; on a miss, triggers a synchronous recomputation rather than returning nothing.
6. Force a manual recomputation — goes through the same locking mechanism as the automatic cron trigger, so a manual and an automatic recomputation of the same report can never run concurrently.
7. View a report's execution history for debugging/observability — duration, success/failure, and which worker ran it.
8. Ingest a sale transaction — the entry point for the simulated continuous data feed.

Every use case that changes an aggregate writes the aggregate and its domain event in the same transactional run: the event goes into the owning bounded context's outbox, never onto a live bus (see Domain event delivery below).

**Data shape.** Each use case is one handler class — the entry service a transactional run resolves — whose input and output are declared once as runtime validation schemas, with their static types inferred from those schemas. The schemas validate shape only (types, formats, presence); business invariants stay in the domain layer, so the same rule is never checked in two places.

**HTTP entry.** A use case reachable over HTTP carries its own HTTP-framework plugin beside its handler, and each bounded context composes its use cases' plugins into one plugin the api process mounts. This is a deliberate exception to "only adapters import infrastructure libraries": it keeps a use case's route, schemas, and handler together. The exception stays confined to those plugin files — handlers and schemas never depend on the HTTP framework, and the bounded context's public surface doesn't re-export plugins, so the worker process can use the same handlers without loading any HTTP code. A use case triggered only from the worker has no plugin.

**Dependencies.** Depends on the Domain layer and on the Ports below, plus the HTTP framework in its plugins only; nothing here calls back into an adapter.

## Ports

**Purpose.** The interfaces the Application layer depends on instead of a concrete infrastructure library. Each port is declared by the domain sub-slice it serves and has exactly one adapter implementing it, which is what lets the application layer stay ignorant of which concrete technology backs a capability.

**Flow.** One port per concern:
1. A report-definition store and a report-execution store — persist and load each aggregate.
2. An outbox store — append a domain event to the owning bounded context's outbox, inside the caller's transaction. Declared once in the shared kernel, since every bounded context that emits events uses the same shape.
3. A job scheduler port — register or remove the recurring recomputation job for a report definition, under a deterministic job identity.
4. A distributed lock port — acquire and release a lock scoped to one report, with a fencing token issued on each successful acquisition.
5. A report-snapshot cache port — read and write the cached, versioned report result, rejecting a write whose fencing token is older than the one already stored.

**Placement criterion.** A port lives in the domain layer because it speaks the domain's language (a report, a version, a fencing token), not a technology's. An interface that speaks a technology's vocabulary (connections, queue options, scripts) and is consumed only by other adapters is not a port: it lives beside the adapters that use it, and nothing in the domain or application layer imports it. If a port's signature starts needing technology vocabulary, the abstraction is cut wrong and splits into a domain port plus an adapter-internal contract.

**Dependencies.** Depended on by the Application layer; implemented by the Adapters below.

## Adapters

**Purpose.** The only layer allowed to import a concrete infrastructure library, apart from the application layer's HTTP plugins. Translates between a port's interface and the real technology behind it.

**Flow.**
1. The persistence adapters implement the definition, execution, and outbox stores against the relational datastore, always through the transaction of the run that resolved them.
2. The cache/lock adapters implement the cache port and the distributed lock port against in-memory stores.
3. The job-queue adapter implements the scheduler port against a recurring-job queue technology that supports deterministic job identity.
4. The outbox relay and the event consumers — see Domain event delivery below.

**Data shape.** Adapter-specific request/response and query shapes stay local to each adapter — none of them leak into the Application layer's schemas.

**Dependencies.** Each adapter depends on (implements) exactly one port; technology-specific contracts shared between adapters stay inside this layer.

## Domain event delivery

**Purpose.** Delivers each domain event to whatever reacts to it (rescheduling, cache overwrite) exactly as reliably as the aggregate write that produced it, without a two-system write inside the use case — the database and the queue can't share one transaction, so publishing directly from a use case either publishes an event whose write later rolls back, or loses the event when the process dies between the commit and the publish.

**Flow.**
1. **Write side.** The use case appends the event to its bounded context's outbox table in the same transaction as the aggregate change: both commit, or neither does.
2. **Relay.** A polling relay in the worker process claims pending outbox rows in creation order, with row-level skip-locking so several worker instances claim disjoint batches. For each row it enqueues one job per consumer on a domain-events queue, with a job identity derived from the outbox row and the consumer, then marks the row published. The relay runs no reaction logic itself; retries, backoff, and failure handling belong to the queue.
3. **Consumers.** One queue processor per reaction. Delivery is at-least-once — a relay crash between enqueueing and marking re-enqueues the row, and job-identity deduplication only holds while the earlier job still exists — so every consumer must be idempotent and must not depend on event order.
4. **Scheduler consumer.** Reconciles instead of applying the event: it treats any definition event as "definition X changed", reads the definition's current state from the datastore, applies it to the scheduler (active means a job with the current cron; archived means no job), then re-reads and repeats if the desired state changed meanwhile. The last write therefore always matches the datastore, whatever order or duplication events arrive in.
5. **Cache consumer.** Overwrites the current version's snapshot on an execution-succeeded event, guarded by the fencing token; the store's own atomic token check discards out-of-order or stale writes. A definition change needs no cache consumer — the old version's key is orphaned passively.

**Data shape.** An outbox row carries the event type, the aggregate identity it concerns, the serialized event payload, when it occurred, and when it was published (empty while pending).

**Dependencies.** Written by the Application layer through the outbox store; read by the relay; consumed by processors that depend on the scheduler and cache ports.
