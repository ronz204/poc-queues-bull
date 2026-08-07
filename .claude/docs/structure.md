# Cascade — Structure

How the system is put together in practice: processes, data flow, queues, state storage, and configuration.

---

## Core architectural decision: one monolith, two entrypoints

Cascade isn't microservices, not even in spirit. It's **one codebase** with **two processes**: `api` and `worker`. Both share the same domain code (types, Postgres access, queue definitions) — only the entrypoint that gets run differs.

This split exists for one specific reason, and it's the actual point of the whole learning exercise: **the real decoupling between "receive the request" and "process the work" goes through Redis, not through being in the same process.** If the API and the worker ran in a single process, it would be possible to cheat (e.g. call the processor function directly) and lose the exact part this POC exists to teach.

It wasn't adopted as an architectural dogma — it's the simplest way to simulate, on a laptop, the real topology of a production system (N API replicas, M worker replicas, scaled independently).

---

## Service map

```
                       ┌─────────────┐
                       │ HTTP client │
                       └─────────────┘
                              │ HTTP
                              ▼
                       ┌─────────────┐
                       │ cascade-api │
                       │ (Elysia)    │
                       └─────────────┘
                              │ enqueues job
                              ▼
                      ┌───────────────┐
                      │ Redis (queue) │
                      │ BullMQ jobs   │
                      └───────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ cascade-worker    │
                    │ process-order     │
                    │ send-notification │
                    │ failed-orders     │
                    └───────────────────┘
                              │ simulated
                              ▼
                   ┌─────────────────────┐
                   │ "external services" │
                   │ charge-payment      │
                   │ reserve-inventory   │
                   │ send-email          │
                   └─────────────────────┘
```

**Communication principle:** there's no real external service anywhere. The "external services" in the diagram are fake functions inside `cascade-worker` itself that simulate latency and random failure, so retry/backoff/DLQ behavior can be forced without depending on anything outside the laptop.

**Not shown above:** both `cascade-api` (writing the initial `pending` state) and `cascade-worker` (writing every later state transition) talk directly to PostgreSQL — omitted from the diagram to keep the BullMQ path readable; see the pattern description below for where each write happens.

A second Redis instance (`redis-cache`) is provisioned alongside the queue Redis above — its own container, its own volume, its own connection string — but nothing in the codebase reads or writes to it yet, and no phase in the roadmap defines what it's for. Not part of the diagram above; don't treat it as part of the BullMQ orchestration path until a phase actually assigns it a role.

---

## Stack and rationale

| Layer | Choice | Why |
|---|---|---|
| Language/runtime | Bun + TypeScript | Same runtime for the API and the worker — zero context-switching between them, shared types across both processes, fast startup with no build step in dev. |
| HTTP framework | Elysia | Bun-native framework, minimal overhead — the goal isn't to learn the web framework, it's to not lose time on it. |
| Queues | BullMQ | The subject of this POC — no alternative was evaluated, it's the foundational choice. |
| Queue broker | Redis, dedicated instance | BullMQ's requirement. Own container via Docker Compose, no managed layer — a managed Redis has nothing to teach at this stage. |
| Cache | Redis, separate dedicated instance | Provisioned for a future caching need; not consumed by any code yet (see the service-map note above). |
| Database | PostgreSQL | Source of truth for business state (`orders`), kept separate from the transient orchestration in Redis — intentional, it forces thinking about what belongs on each side. |
| ORM/driver | Drizzle | End-to-end typing consistent with the rest of the Bun/TS stack; avoids hand-written raw SQL without pulling focus from the real goal. |
| HTTP client | Bruno | Plain-text, version-controlled request collection committed to the repo, used to exercise each endpoint per phase — replaces any visual queue dashboard; inspection happens through the service's own endpoints and logs. |
| Containers | Docker Compose | One compose file wiring Postgres and both Redis instances; the API and worker run directly on the host in local dev, not containerized — containerizing the app code itself isn't worth it at this stage. |
| Testing | Vitest | Used only to validate retry/backoff behavior reproducibly when that's actually needed — not the focus of this POC, no time invested in coverage. |

---

## Queues and background processing

**Why they exist:** no flow involving "processing" (even fake processing) can live inside an endpoint's request/response cycle — blocking the HTTP response to simulate a few seconds of work produces exactly the same problem a real case would (timeouts, indefinite loading), which is precisely what this is meant to teach how to avoid.

**Pattern repeated in every sub-flow of the Order Processing module:**

1. The `cascade-api` endpoint receives the request, persists the initial (`pending`) state to Postgres, enqueues a job in BullMQ, and responds immediately with the resource id and its status.
2. `cascade-worker` (a separate process, same codebase, different startup entrypoint) picks the job up from the queue.
3. The processor runs the phase-appropriate simulation (sleep plus random failure).
4. The worker updates the state in Postgres (`completed` / `error`) when it finishes.
5. The client polls `GET /orders/:id`, or — from phase 5 on — listens for progress through an endpoint that surfaces what `QueueEvents` reports.

**Jobs running through this mechanism (by phase):**
- `process-order` — the domain's core job, evolves from a simple job into a Flow.
- `abandoned-order-check` — repeatable, phase 2.
- `send-notification` — phase 4/7, its own queue.
- `failed-orders` — dead letter queue, phase 3.

**Failure handling:** a job that exhausts its retries is never silently lost — the `failed` event routes it to the DLQ with the failure reason, queryable via `GET /failed-orders` and visible in the worker's structured logs.

**Processes in development** (same repo, different startup command, not separate projects): `cascade-api` exposes the HTTP API; `cascade-worker` consumes the BullMQ queues — same codebase, its own entrypoint and its own startup command.

---

## Database schema (planned)

Not yet implemented — no tables exist in the repo yet. This describes the target shape, kept deliberately small since the rich state lives in BullMQ/Redis while a job is in flight:

- **`orders`**: `id`, `status` (`pending` / `processing` / `completed` / `failed` / `cancelled`), `payload` (jsonb), `created_at`, `updated_at`.
- **`order_events`**: append-only log of state transitions per order (`order_id`, `event_type`, `detail` jsonb, `created_at`) — queried to reconstruct "what happened" to an order without going to Redis; a simplified equivalent of an audit trail.

No auth, tenant, or real-business tables (`clients`, `products`) — fake `jsonb` payloads stand in wherever a "customer" or "product" is needed, because modeling those for real doesn't serve this POC's goal.

---

## Environments and configuration

One real environment: **local development**. No staging, no production — this is never deployed.

- **Local:** Postgres and both Redis instances run via Docker Compose, with named volumes for persistence across restarts — useful for inspecting Redis/Postgres state between learning sessions without losing everything each time.
- **Configuration:** environment variables are validated against a schema at boot rather than read ad hoc, covering app identity/port, the queue and cache Redis connection strings, the Postgres connection and credentials, and CORS settings. Each service (Postgres, the two Redis instances, the app) keeps its own env file rather than sharing one root file — real values stay untracked, a sample file with empty keys stays committed.
- **No real secrets management:** no vault, no CI secrets, no separate database roles (`migrator` vs. `app`) — that solves a team/scale problem this POC doesn't have, and adding it would pull focus from the BullMQ goal.

This level of simplicity is intentional: every hour spent on infrastructure that isn't Redis, BullMQ, or Postgres is an hour not spent on the project's actual goal.
