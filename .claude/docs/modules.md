# Cascade — Modules and Requirements

Functional specification of the domain module and the cross-cutting BullMQ requirements each phase depends on.

---

## Cross-cutting requirements (BullMQ core)

These apply to every phase from the moment they appear — they're not minor details, they're the concepts this POC exists to master, and get the same rigor as the domain itself.

### Queue and worker definition

- **One `Queue` per kind of work**, never one generic queue with a `type` field — `process-order`, `send-notification`, and `failed-orders` are separate queues from the moment they exist.
- **One shared Redis connection** across every `Queue`/`Worker`/`QueueEvents` instance in a process — never a new connection per instance.
- **Typed job definitions**: every job has a `name` and a `data` shape known to the type system, never `any`. This matters twice here: it's good practice, and it makes contract errors between the API and the worker surface at compile time instead of at runtime during a demo.

### Job reliability

- **Retries with backoff**: any job that depends on an external resource (even a fake one) defines `attempts` and `backoff` explicitly — the implicit default is never left unconsidered.
- **Dead letter queue**: jobs that exhaust their retries don't disappear — they move to a review queue via the `failed` event, never silently ignored.
- **Idempotent processors**: every processor must be safe to re-run without duplicate effects (relevant as soon as retries exist — a retried job must not charge the simulated payment twice).

### Throughput and load control

- **Per-worker concurrency**, set explicitly and justified — not "higher is better" without measuring — tested by raising/lowering the value under simulated load.
- **Queue-level rate limiting**, to simulate real external-provider throughput caps (e.g. "the fake payment provider can take 5 req/sec").

### Observability

- **Progress reporting** (`job.updateProgress()`) on any job with more than one internal step.
- **`QueueEvents`** as the listening mechanism external to the worker — lets the API (a separate process) learn about changes without coupling directly to the worker.
- **Structured per-job logging** (start, finish, failure, retry) as the primary way to debug what's happening — with no visual dashboard, queue inspection happens through the service's own status endpoints and the worker's console logs.

### Process lifecycle

- **API and worker as separate processes from phase 0** (same repo, different entrypoint) — the worker is never run embedded inside the API process, not even in development.
- **Graceful shutdown**: the worker must handle `SIGTERM` by draining its active job before exiting — exercised explicitly in phase 7, but the correct shutdown sequence is structured from day one to avoid a later refactor.

---

## Module: Order Processing

The single domain module. Everything else (notifications, abandoned-order sweep) hangs off the `order` entity.

### Flow (evolves by phase — see the phase roadmap for the full mapping)

1. `POST /orders` saves the order in Postgres with `status: pending` and enqueues a `process-order` job — the HTTP response is immediate, it never waits on the worker.
2. The `process-order` worker picks up the job and, depending on the phase, runs:
   - **Phase 1**: a fake sleep + `status: completed`.
   - **Phase 3+**: a `charge-payment` sub-step with a random failure rate (~15%), `attempts` + `backoff` configured, routed to the dead letter queue once retries are exhausted.
   - **Phase 6**: the simple job is replaced by a **Flow** — `charge-payment`, `reserve-inventory`, `send-confirmation-email` as parallel children, `finalize-order` as the parent that only runs once all three children resolve.
3. Every state change is persisted to Postgres — Postgres is always the source of truth queryable over HTTP; BullMQ is the orchestration engine, not the business state store.

### Sub-flow: abandoned orders (phase 2)

- A delayed job per order: if it hasn't moved to `confirmed` within a set window, a reminder fires.
- A repeatable (cron-like) job sweeps Postgres every minute for stale `pending` orders and cancels them.

### Sub-flow: dead letter queue (phase 3)

- A listener on `process-order`'s `failed` event moves the job (payload + failure reason) to the `failed-orders` queue.
- A separate worker on `failed-orders` simulates manual review (structured logging, no automatic action — deliberate: in a real system, a job in the DLQ doesn't reprocess itself).

### Sub-flow: notifications (phase 4/7)

- An independent `send-notification` queue, with its own `concurrency` and `limiter` — kept separate from `process-order` specifically to practice multi-queue coordination (phase 7): the `process-order` worker enqueues onto `send-notification` instead of sending the email inline.

### Validation

There's no dataset of "10-15 known-outcome cases" the way a real calculation engine would have — the equivalent here is a load-testing script that fires N concurrent orders with different failure seeds, used in every phase to observe queue behavior under stress. That replaces a business test suite: since the "business" is fake, what's actually being validated is queue behavior.

---

## Integration and risk summary

| Sub-flow | Phase introduced | BullMQ concept in focus | Biggest learning risk |
|---|---|---|---|
| Simple order | 1 | Basic `Queue`/`Worker`/`Job` | Confusing job lifecycle with business state in Postgres |
| Reminder + sweeper | 2 | Delayed + repeatable jobs | Misconfigured repeatable jobs producing duplicate/orphaned jobs |
| Payment with failure | 3 | Retries, backoff, DLQ | Miscalibrated backoff (unbounded exponential) saturating Redis under load |
| Multi-channel notifications | 4 | Concurrency, rate limiting | Confusing worker concurrency with the "provider's" real throughput |
| Live progress | 5 | Progress, `QueueEvents` | Coupling the API to worker events instead of to `QueueEvents` |
| Full checkout | 6 | `FlowProducer`, parent-child jobs | Mishandling a failed child inside a flow (parent stays stuck) |
| Multi-queue + shutdown | 7 | Cross-queue coordination, `SIGTERM` | Losing in-flight jobs by not draining before killing the process |

No sub-flow depends on a real external service — everything "external" (payments, inventory, email) is simulated with a sleep plus random failure, which keeps development unblocked and focus 100% on BullMQ.
