# Worker Queues — Spec

## Objective

`POST /orders` persists an order to Postgres (`status: pending`) and enqueues a `process-order` job; the worker (a separate process) picks it up, runs a simulated delay (no random failure yet), and leaves the order `completed` — exercising the full `Queue` → `Worker` → `Job` cycle (`waiting` → `active` → `completed`) through a single Redis connection shared per process.

## Scope

In scope for this slice:

- `POST /orders` — creates the order (`pending`) plus an `order_created` event, in one transaction; enqueues the `process-order` job; responds immediately, without waiting on the worker.
- `GET /orders/:id` — reads current order state from Postgres.
- One queue, `process-order`, consumed by one worker.
- A typed job definition: a job name plus a data shape known to the type system on both sides of the process boundary (see Risks for how that type is re-validated at runtime, since it doesn't survive serialization across the boundary).
- A single shared Redis connection instance per process, reused by every `Queue`/`Worker`/`QueueEvents` in that process — configured with `maxRetriesPerRequest: null`, which BullMQ requires for the Worker's blocking connections.
- `job.data` carries the order's **full payload embedded**, not just an id — a deliberate choice for this slice (see Risks for the trade-off it accepts).
- `attempts`, `backoff`, and `concurrency` are set **explicitly**, even with trivial values: `attempts: 1`, no backoff, an explicit concurrency (e.g. `1`). No real retry logic yet (that's phase 3) — the point is not leaving BullMQ's implicit default unconsidered.
- `QueueEvents` wired up already in this slice, but console-only: a listener that logs to stdout when a `process-order` job resolves `completed` or `failed`. It deliberately does **not** feed `GET /orders/:id` (that keeps reading Postgres) and is not exposed to any client — that's real live progress, which belongs to phase 5. This is an intentional deviation from the general phase roadmap (which placed `QueueEvents` at phase 5): early, minimal exposure to the mechanism was chosen on purpose for this slice, without pulling in phase 5's client-facing feature.
- Structured `SIGTERM` handling from day one: the worker process registers a handler and calls `worker.close()` to drain its active job before exiting. Not exercised under real load until phase 7 — this slice only puts the structure in place.
- If the processor throws (a bug, not a simulated failure — this slice has no random failure), the order moves to `failed` plus an `order_failed` event, in the same transaction as the update; the job itself ends up in BullMQ's `failed` state, visible through the `QueueEvents` listener. No dead-letter routing yet — that's phase 3.
- Every state transition (`pending` → `processing`/`completed`/`failed`) is persisted to Postgres together with its corresponding `order_events` row, in the same transaction — `orders` and `order_events` form one aggregate and must commit together or not at all.

Out of scope, deferred:

- Delayed jobs / repeatable jobs (abandoned-order sweep) — phase 2.
- Real retries with calibrated backoff, plus a dead-letter queue (`failed-orders`) — phase 3, once random ~15% failure is introduced on `charge-payment`.
- Concurrency tuning under real load, plus queue-level rate limiting — phase 4, once a 100+-concurrent-order load test exists.
- `job.updateProgress()` and client-facing live progress — phase 5. (`QueueEvents` already exists from this slice on, but only as internal console observability, not as a client feature.)
- `FlowProducer` / parent-child jobs — phase 6.
- Multi-queue coordination, and graceful shutdown *tested* under real `SIGTERM` with load — phase 7 (this slice only leaves the handler structure in place).

## Technical context

Stack already in place: Bun + TypeScript, Elysia for the API entrypoint, Drizzle + Postgres (the `orders`/`order_events` tables are already migrated). BullMQ over Redis is not installed or used anywhere in the code yet.

What already exists that this slice touches:

- An API entrypoint (Elysia) that currently wires a CORS plugin and an OpenAPI docs plugin — no domain routes yet. There is no worker entrypoint yet; the process only exists as a concept in the docs.
- Environment schema validated at boot (Zod), already defining the queue Redis connection string and a separate cache Redis connection string (the latter has no assigned role in any phase yet — out of scope here, don't touch it), plus the Postgres connection, app identity, and CORS settings.
- Path aliases already reserved in `tsconfig.json` with no file behind them yet: one pointing at a not-yet-created dependency-wiring module (the natural home for the shared Redis connection), and one pointing at a not-yet-created `queues` directory (the natural home for the `process-order` queue definition, its job data type, and the `Worker`/`QueueEvents` that consume it).
- The `orders` and `order_events` tables are already migrated, under a dedicated Postgres schema named `core` (not `public` — corrected in `database.md` alongside this spec). `orders` columns: `id` (uuid, app-generated, uuidv7), `status` (enum `order_status`: `pending`/`processing`/`completed`/`failed`/`cancelled`, default `pending`), `payload` (jsonb, not null), `created_at`, `updated_at`. `order_events` columns: `id`, `order_id` (FK to `orders.id`, cascade delete), `event_type` (free text), `detail` (jsonb, default `{}`), `created_at`. Existing indexes cover `orders.status`, a partial index on `orders.created_at` where `status = 'pending'`, and a composite index on `(order_id, created_at)` for `order_events`.
- `bullmq` and `ioredis` are not yet dependencies of the project — they need to be added.
- Cross-cutting BullMQ conventions this slice must follow: one `Queue` per kind of work, one shared Redis connection per process across every `Queue`/`Worker`/`QueueEvents`, typed job definitions, explicit `attempts`/`backoff` (never left at an unconsidered default), a dead-letter queue for exhausted retries (phase 3+), idempotent processors, explicit and justified concurrency, `QueueEvents` as the external listening mechanism, structured per-job logging, and graceful `SIGTERM` handling.
- The general flow pattern this project follows: the API persists the initial state, enqueues, and responds immediately; the worker consumes, simulates the work, and persists the final state; the client polls `GET /orders/:id`, with live progress arriving later. This slice deviates deliberately on the `QueueEvents` point (see Scope above).
- Domain-level conventions this slice must follow: `orders` + `order_events` form one aggregate that must commit together (a single consistency boundary, not two independent writes); a job's `data` crossing from the API process into the worker process over Redis is a boundary crossing into an external system's shape and needs an anti-corruption translation/validation step, not blind trust in a compile-time type that didn't survive serialization; failures get signaled, never swallowed.

## Implementation

1. Add `bullmq` and `ioredis` as dependencies.
2. Create the dependency-wiring module (the file the `@deps` path alias already points at): a single `IORedis` instance built from the queue Redis connection string, with `maxRetriesPerRequest: null`. Export it so every `Queue`/`Worker`/`QueueEvents` in a process reuses it — never a new connection per instance.
3. Create the `process-order` queue definition (under the directory the `@queues/*` path alias already points at): the queue name (`"process-order"`), a Zod schema plus inferred TS type for the job data (the order's full payload), and a typed `Queue` instance built on the shared connection.
4. Add the orders HTTP routes, following this project's existing convention of one Elysia plugin per concern: `POST /orders` inserts the order (`pending`) plus an `order_created` event in one transaction, enqueues the job on `process-order` with the full payload, and responds immediately with the id and status. `GET /orders/:id` reads the row from Postgres.
5. Wire the orders plugin into the API entrypoint.
6. Create the worker entrypoint (mirroring the API entrypoint's structure, as its own startup command): instantiate the `process-order` `Worker` with explicit `concurrency`, `attempts: 1`, no backoff, on the shared connection. The processor re-validates `job.data` at runtime with the same Zod schema used to validate the `POST` body (see Risks), then runs the simulated delay. On success, it updates the order to `completed` plus an `order_completed` event in one transaction; on a thrown error, it updates the order to `failed` plus an `order_failed` event in one transaction and rethrows so BullMQ marks the job `failed`. Also instantiate a `QueueEvents` on `process-order` that only logs `completed`/`failed` to the console, and register a `SIGTERM` handler that calls `worker.close()`.
7. Add dev scripts to start each entrypoint (`api`, `worker`) independently, if no equivalent pattern exists yet.

## Config / secrets

No new environment variables — the existing queue Redis connection string (already validated in the env schema) is what the dependency-wiring module uses. The existing cache Redis connection string stays untouched — it has no assigned role in any phase yet.

## Acceptance criteria

- [ ] `POST /orders` inserts an `orders` row (`pending`) plus an `order_events` row (`order_created`) in the same transaction, enqueues a `process-order` job carrying the full payload, and responds without waiting on the worker.
- [ ] `GET /orders/:id` returns current state read from Postgres, not from Redis/BullMQ.
- [ ] The worker consumes the job, simulates work with a fixed delay, and leaves the order `completed` plus an `order_completed` event (same transaction).
- [ ] If the processor throws, the order ends up `failed` plus an `order_failed` event (same transaction), and the job shows up as `failed` in BullMQ.
- [ ] A single `IORedis` connection (with `maxRetriesPerRequest: null`) is reused by the queue, the worker, and `QueueEvents` in the worker process — no per-instance connection.
- [ ] The `Worker` is created with explicit `concurrency` and `attempts: 1`, no backoff.
- [ ] A `QueueEvents` on `process-order` logs to console when a job resolves `completed` or `failed`.
- [ ] The worker process registers a `SIGTERM` handler that calls `worker.close()` before exiting.
- [ ] The worker validates `job.data` at runtime (Zod) before processing, rather than trusting the TS type alone.

## How to test

Manual, via this project's HTTP client collection, with both processes (`api` and `worker`) running:

1. `POST /orders` with a fake order payload → immediate `2xx` with `id` and `status: "pending"`, no perceptible delay.
2. `GET /orders/:id` right after → `status: "pending"` or `"processing"`.
3. `GET /orders/:id` again after the fixed simulated delay (a short constant, e.g. 2-3s) → `status: "completed"`.
4. Check the worker process's console output → the `QueueEvents` listener should have logged the job as `completed`.
5. (Manual, optional) While a job is in flight, send `SIGTERM` to the worker process → it should finish the active job before exiting, not cut it mid-processing.

## Risks / edge cases

- **Job data crosses a process boundary (API → Redis → worker) and loses its compile-time type at that hop** — the worker must re-validate `job.data` at runtime (the same Zod schema that validates the `POST` body) instead of trusting the TS type, which doesn't survive serialization. This is the anti-corruption step any external boundary requires.
- **The full order payload embedded in the job creates a second source of truth** — a deliberate choice for this slice. If the `orders` row changes between enqueue and processing (shouldn't happen in this slice, since nothing else writes the row in between, but stays open for later phases), the worker processes a potentially stale payload. A conscious trade-off, not a bug.
- **`maxRetriesPerRequest: null` is mandatory on the connection the Worker uses** — BullMQ requires it for its blocking commands. Reusing a connection meant for regular queries without that flag makes the Worker fail at startup.
- **"One shared connection" doesn't mean a single TCP socket** — BullMQ internally duplicates the base connection when it needs a blocking socket (Worker, QueueEvents). Sharing the base connection instance/configuration is what the convention asks for, not a literal single OS-level socket — worth keeping in mind so multiple underlying connections showing up in Redis isn't mistaken for a bug.
- **`attempts: 1` doesn't prevent stalled-job reprocessing** — if the worker crashes mid-job without renewing its lock, BullMQ's stalled-job mechanism can redeliver it regardless of `attempts`. This slice's processor is idempotent by nature (setting `completed` twice is a no-op), so it's harmless, but `attempts: 1` should not be read as "this job can never be reprocessed."
- **`orders` and `order_events` must commit in the same transaction** — a successful `orders` write with a failed `order_events` write (or the reverse) leaves the aggregate inconsistent and breaks history reconstruction through `order_events`.
