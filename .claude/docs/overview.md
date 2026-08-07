# Cascade — Overview

Cascade is the working name for this repository's order-processing domain. It exists as a **learning harness for BullMQ on Redis**, not as a product — this file exists so the reasoning behind the domain shape and the phase sequencing stays explicit instead of implicit.

---

## What Cascade is

Cascade is a fake e-commerce order-processing monolith. Its only real purpose is to be a harness for mastering BullMQ on Redis, with PostgreSQL as the source of truth for business state. The domain (orders, payments, inventory) is a vehicle — it doesn't matter whether it's "real", it matters that it has the right shape to force every BullMQ feature to be exercised in a context that makes sense.

**Learning goal:** move from "I know how to call `Queue.add()`" to "I can design, debug, and operate a production queueing system" — retries, backoff, dead letter queues, rate limiting, concurrency tuning, flows with parent-child dependencies, graceful shutdown.

---

## Why the domain matters for the learning goal

There are two ways to build this kind of POC:

- **"Feature demo"**: a collection of disconnected endpoints, each showing one isolated BullMQ feature (one endpoint for retries, another for rate limiting, unrelated to each other).
- **"System with a life of its own"**: one coherent domain (orders) that grows in complexity organically, where each BullMQ feature gets introduced because the domain already needs it, not because "it's next on the list."

Cascade is the second one. This isn't a stylistic detail — it's the decision that makes the learning stick:

- No BullMQ feature is added without a use case that justifies it inside the order flow.
- Every phase leaves the domain functionally complete at its own level — there's never dead code waiting for the next phase.
- The domain doesn't change once chosen (phase 1 onward); what changes is how much BullMQ sophistication sits on top of it.

**Implication for development:** work never starts from "I want to try Flows" and then looks for a place to put it. It starts from "what's missing from the order flow I already have?", and that's what dictates which BullMQ feature enters the next phase.

---

## Phase roadmap

| Phase | Added to the domain | BullMQ concept learned |
|---|---|---|
| 0 | Setup: Redis + Postgres via Docker Compose, `api`/`worker` skeleton as separate processes, "hello world" job | `Queue`/`Worker` connection, no logic yet |
| 1 | `POST /orders` → Postgres (`pending`) → `process-order` job → worker marks `completed` | `Queue`, `Worker`, `Job`, `waiting → active → completed` lifecycle |
| 2 | Abandoned-order reminder (delayed) + periodic sweep of stale orders | Delayed jobs (`delay`), repeatable jobs (`repeat`, cron) |
| 3 | `charge-payment` fails randomly → dead letter queue of failed orders | `attempts`, `backoff` (fixed/exponential), `failed` handling |
| 4 | Load of 100+ concurrent orders, fake payment provider capped at N req/sec | Per-worker `concurrency`, per-queue `limiter` |
| 5 | Client sees order progress in real time | `job.updateProgress()`, `QueueEvents` |
| 6 | `charge-payment` + `reserve-inventory` + `send-email` run in parallel, `finalize-order` depends on all three | `FlowProducer`, parent-child jobs (`waiting-children`) |
| 7 (bonus) | A worker on one queue enqueues onto another queue; the worker process handles `SIGTERM` without losing in-flight work | Multi-queue coordination, graceful shutdown |

Each phase is meant to be an independent commit/branch, comparable to the previous one.

---

## Problems Cascade targets

| Problem | Phase | Technical shape |
|---|---|---|
| An endpoint can't block while "processing" happens | 1 | Enqueue and respond immediately with `pending` status |
| An order may need retrying without re-running everything from scratch | 2 | Delayed jobs |
| A (fake) third party fails intermittently and the order can't be lost | 3 | Retries + backoff + dead letter queue |
| A (fake) external provider has a real throughput limit | 4 | Queue-level rate limiting |
| The client needs to know which step an order is on, not just "pending/done" | 5 | Progress events |
| Several steps are independent of each other but a final step depends on all of them | 6 | Flows |
| A real domain almost never lives on a single queue | 7 | Multi-queue, graceful shutdown |

---

## Explicit non-goals

Scope is deliberately narrow — anything that doesn't serve "learn BullMQ" is noise:

- No auth, no multi-tenancy, no real users.
- No real payment integration (Stripe, etc.) — everything is simulated with a sleep plus random failure.
- No frontend — everything is operated through an HTTP client.
- No LLM or AI of any kind — doesn't serve this POC's goal.
- No real production hardening (this is never deployed for real) — but production-relevant conditions for queues *are* simulated: failures, concurrency, shutdown.

---

## Design principles guiding decisions

- **The domain is a vehicle, not the goal.** If a domain decision doesn't serve forcing a BullMQ feature, it gets simplified.
- **Incremental phases, stable domain.** The use case (orders) doesn't change from phase 1 onward; only queue sophistication gets layered on top.
- **Each feature is introduced once the domain already asks for it**, not before — so the "why" behind each BullMQ API stays anchored to a concrete problem, not an abstract definition.
- **Postgres is the source of truth for the business; Redis/BullMQ is transient orchestration.** The state that matters lives in Postgres — if Redis restarts, the system doesn't lose business truth, only work in transit.
- **API and worker are the same code, two processes.** This is intentional from phase 0 — it forces thinking about real decoupling (via Redis) instead of fake decoupling inside a single process.
