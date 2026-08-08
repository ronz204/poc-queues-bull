# process-order queue — implementation plan

Implementation plan for `projects/poc-engine/deltas/worker-queues.spec.md`. One-off plan for this slice — not a durable doc, safe to delete once implemented.

## Layering

Confirmed with the existing empty scaffolding (`source/core/queues`, `source/app/order-processor`, `source/infra/queues`, `source/infra/plugins`):

| Layer | Responsibility | Depends on |
|---|---|---|
| `core` | Ports (interfaces), domain types, domain errors. Framework-agnostic — no BullMQ, no Elysia, no Drizzle imports. | nothing internal |
| `app` | Application services, split into one **handler class per use case** (`CreateOrderHandler`, `ProcessOrderHandler`). Pure orchestration, no vendor SDK calls. | `core` only |
| `infra` | Concrete adapters: BullMQ (`infra/queues`), Elysia HTTP (`infra/http`, `infra/plugins`), Drizzle (`drizzle/*`). Implements `core` ports. | `core`, vendor SDKs |
| `cmd` | Composition root. The only place that constructs concrete classes and wires them together. Two entrypoints: `service.boot.ts` (api), `worker.boot.ts` (worker). | everything |

Persistence stays without a port for this slice (confirmed) — the handlers call Drizzle directly. Only the queue gets a `core` port + `infra` adapter split, since that's this slice's actual learning target.

**Conventions locked in for this plan:**

- **Classes, not function factories.** Every unit that needs constructing (a handler, an adapter, a plugin) is a class instantiated with `new`, not a `createX()` function returning a closure. Matches the `BullmqOrderQueue`/`Drizzler` shape already used in this project.
- **One named `*Props` interface per class constructor**, never an inline anonymous object type or positional args. Every class that needs wiring takes exactly one `props` parameter typed by its own interface (e.g. `CreateOrderHandlerProps`), stored on `this`. Keeps every constructor's dependency list self-documenting and grep-able by name.
- **`app/order-processor` splits into one handler class per method** — `CreateOrderHandler` and `ProcessOrderHandler`, each with a single, simply-named `handle()` method. The class name already says what it does, so the method doesn't have to (`handle`, not `handleCreateOrder`/`createOrder`). This also means each entrypoint only wires the one handler it actually needs (`service.boot.ts` never touches `ProcessOrderHandler`, `worker.boot.ts` never touches `CreateOrderHandler`) — Interface Segregation for free.

## New file tree

```
projects/poc-engine/
├── source/
│   ├── core/
│   │   ├── orders/
│   │   │   └── order.types.ts              # NEW — fake order payload: zod schema + type
│   │   └── queues/
│   │       ├── order-queue.port.ts         # NEW — OrderQueuePort + ProcessOrderJobData
│   │       └── queue.errors.ts             # NEW — QueueEnqueueError
│   ├── app/
│   │   └── order-processor/
│   │       ├── create-order.handler.ts     # NEW — CreateOrderHandler
│   │       └── process-order.handler.ts    # NEW — ProcessOrderHandler
│   ├── infra/
│   │   ├── queues/
│   │   │   ├── process-order.queue.ts      # NEW — BullmqOrderQueue (producer)
│   │   │   └── process-order.worker.ts     # NEW — ProcessOrderWorker (consumer)
│   │   ├── http/
│   │   │   └── orders.plugin.ts            # NEW — OrdersPlugin (POST/GET routes)
│   │   └── plugins/                        # existing, untouched
│   └── cmd/
│       ├── deps.wiring.ts                  # NEW — shared redis connection, db, orderQueue
│       ├── service.boot.ts                 # EDIT — wire OrdersPlugin
│       └── worker.boot.ts                  # NEW — worker entrypoint
├── drizzle/
│   └── customs/
│       └── drizzler.ts                     # EDIT — finish the class, export db + Database type
├── tsconfig.json                           # EDIT — add @core/* and @app/* aliases
└── package.json                            # EDIT — add bullmq, ioredis; dev:api / dev:worker scripts
```

`infra/http` is a new folder, split out from `infra/plugins` — `infra/plugins` stays for cross-cutting Elysia plugins (CORS, OpenAPI), `infra/http` holds domain routes. Mixing `orders.plugin.ts` into `infra/plugins` alongside CORS/OpenAPI would put two different reasons-to-change in one folder.

## Step 0 — config changes

`tsconfig.json` — add two aliases, matching the pattern already used for every other layer:

```jsonc
"@core/*": ["./source/core/*"],
"@app/*": ["./source/app/*"],
```

`package.json` — add dependencies and dev scripts:

```jsonc
"dependencies": {
  // ...existing...
  "bullmq": "^5",
  "ioredis": "^5"
},
"scripts": {
  "drizz:migrate": "bunx --bun drizzle-kit migrate",
  "dev:api": "bun --watch source/cmd/service.boot.ts",
  "dev:worker": "bun --watch source/cmd/worker.boot.ts"
}
```

## Step 1 — `core/orders/order.types.ts`

The fake order payload shape — reused by the `POST /orders` body, the job data, and the worker's runtime re-validation. One source of truth for this shape (see spec Risks: the type doesn't survive the API→worker process hop, so it gets re-validated, not re-defined). No class here — this is a value shape, not a unit with dependencies to wire.

```ts
import { z } from "zod";

export const orderPayloadSchema = z.object({
  customerName: z.string().min(1),
  items: z.array(
    z.object({
      sku: z.string().min(1),
      quantity: z.number().int().positive(),
    }),
  ).min(1),
  amount: z.number().positive(),
});

export type OrderPayload = z.infer<typeof orderPayloadSchema>;
```

## Step 2 — `core/queues/order-queue.port.ts`

The port both handlers and the infra adapter depend on, plus the job's own data contract (queue-specific, so it lives next to the port rather than in `core/orders`). A port stays an `interface`, not a class — there's nothing to construct.

```ts
import { z } from "zod";

import { orderPayloadSchema } from "@core/orders/order.types";

export const processOrderJobSchema = z.object({
  orderId: z.string().uuid(),
  payload: orderPayloadSchema,
});

export type ProcessOrderJobData = z.infer<typeof processOrderJobSchema>;

export interface OrderQueuePort {
  enqueueProcessOrder(job: ProcessOrderJobData): Promise<void>;
}
```

## Step 3 — `core/queues/queue.errors.ts`

Anti-corruption boundary: the handlers should only ever see this, never a raw ioredis/BullMQ error.

```ts
export class QueueEnqueueError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "QueueEnqueueError";
  }
}
```

## Step 4 — finish `drizzle/customs/drizzler.ts`

Currently a stub — the client is built but never stored or turned into a Drizzle instance. Completing it with the same props-interface convention as everything else:

```ts
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "@elements/core.element";

export interface DrizzlerProps {
  url: string;
}

export class Drizzler {
  readonly db: ReturnType<typeof drizzle<typeof schema>>;

  constructor(props: DrizzlerProps) {
    const client = postgres(props.url, { prepare: false });
    this.db = drizzle(client, { schema });
  }
}

export type Database = Drizzler["db"];
```

## Step 5 — `infra/queues/process-order.queue.ts`

The producer-side adapter — implements `OrderQueuePort` with BullMQ. Owns the queue name constant (single source of truth, imported by the worker file too).

```ts
import { Queue } from "bullmq";
import type { Redis } from "ioredis";

import type { OrderQueuePort, ProcessOrderJobData } from "@core/queues/order-queue.port";
import { QueueEnqueueError } from "@core/queues/queue.errors";

export const PROCESS_ORDER_QUEUE_NAME = "process-order";

export interface BullmqOrderQueueProps {
  connection: Redis;
}

export class BullmqOrderQueue implements OrderQueuePort {
  private readonly queue: Queue<ProcessOrderJobData>;

  constructor(props: BullmqOrderQueueProps) {
    this.queue = new Queue<ProcessOrderJobData>(PROCESS_ORDER_QUEUE_NAME, {
      connection: props.connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }

  async enqueueProcessOrder(job: ProcessOrderJobData): Promise<void> {
    try {
      await this.queue.add(PROCESS_ORDER_QUEUE_NAME, job);
    } catch (cause) {
      throw new QueueEnqueueError(
        `Failed to enqueue process-order job for order ${job.orderId}`,
        { cause },
      );
    }
  }
}
```

`removeOnFail: false` is deliberate: with no dead-letter queue yet (phase 3), a failed job needs to stay inspectable in BullMQ itself rather than disappearing. `enqueueProcessOrder` keeps the name the port contract gives it — it's implementing an interface, not a handler, so it doesn't get the "simple method name" treatment.

## Step 6 — `app/order-processor/create-order.handler.ts`

```ts
import type { Database } from "@customs/drizzler";
import { orders, orderEvents } from "@elements/core.element";
import type { OrderPayload } from "@core/orders/order.types";
import type { OrderQueuePort } from "@core/queues/order-queue.port";

export interface CreateOrderHandlerProps {
  db: Database;
  orderQueue: OrderQueuePort;
}

export class CreateOrderHandler {
  private readonly db: Database;
  private readonly orderQueue: OrderQueuePort;

  constructor(props: CreateOrderHandlerProps) {
    this.db = props.db;
    this.orderQueue = props.orderQueue;
  }

  async handle(payload: OrderPayload): Promise<{ id: string; status: "pending" }> {
    const order = await this.db.transaction(async (tx) => {
      const [inserted] = await tx.insert(orders).values({ payload }).returning();
      await tx.insert(orderEvents).values({
        orderId: inserted!.id,
        eventType: "order_created",
        detail: {},
      });
      return inserted!;
    });

    // NOTE: enqueue happens after the DB commit — see plan notes below for the
    // known gap this leaves (enqueue failure ⇒ order stuck in pending).
    await this.orderQueue.enqueueProcessOrder({ orderId: order.id, payload });

    return { id: order.id, status: "pending" };
  }
}
```

## Step 7 — `app/order-processor/process-order.handler.ts`

Only needs `db` — it never talks to the queue, so its `Props` interface stays narrower than `CreateOrderHandler`'s (Interface Segregation in practice, not just in principle).

```ts
import { eq } from "drizzle-orm";

import type { Database } from "@customs/drizzler";
import { orders, orderEvents } from "@elements/core.element";
import type { ProcessOrderJobData } from "@core/queues/order-queue.port";

export interface ProcessOrderHandlerProps {
  db: Database;
}

const SIMULATED_PROCESSING_DELAY_MS = 2000;

export class ProcessOrderHandler {
  private readonly db: Database;

  constructor(props: ProcessOrderHandlerProps) {
    this.db = props.db;
  }

  async handle(job: ProcessOrderJobData): Promise<void> {
    await this.db
      .update(orders)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(orders.id, job.orderId));

    try {
      await new Promise((resolve) => setTimeout(resolve, SIMULATED_PROCESSING_DELAY_MS));

      await this.db.transaction(async (tx) => {
        await tx
          .update(orders)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(orders.id, job.orderId));
        await tx.insert(orderEvents).values({
          orderId: job.orderId,
          eventType: "order_completed",
          detail: {},
        });
      });
    } catch (cause) {
      await this.db.transaction(async (tx) => {
        await tx
          .update(orders)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(orders.id, job.orderId));
        await tx.insert(orderEvents).values({
          orderId: job.orderId,
          eventType: "order_failed",
          detail: { reason: cause instanceof Error ? cause.message : String(cause) },
        });
      });
      throw cause;
    }
  }
}
```

## Step 8 — `infra/queues/process-order.worker.ts`

Wraps the BullMQ `Worker` + `QueueEvents` pair as one class. Takes the `ProcessOrderHandler` instance (not the whole app layer) as a dependency, and exposes a single `close()` so `worker.boot.ts` doesn't need to know there are two BullMQ objects underneath to drain.

```ts
import { Worker, QueueEvents } from "bullmq";
import type { Redis } from "ioredis";

import { processOrderJobSchema, type ProcessOrderJobData } from "@core/queues/order-queue.port";
import type { ProcessOrderHandler } from "@app/order-processor/process-order.handler";

import { PROCESS_ORDER_QUEUE_NAME } from "./process-order.queue";

export interface ProcessOrderWorkerProps {
  connection: Redis;
  processOrderHandler: ProcessOrderHandler;
  concurrency: number;
}

export class ProcessOrderWorker {
  private readonly worker: Worker<ProcessOrderJobData>;
  private readonly queueEvents: QueueEvents;

  constructor(props: ProcessOrderWorkerProps) {
    this.worker = new Worker<ProcessOrderJobData>(
      PROCESS_ORDER_QUEUE_NAME,
      async (job) => {
        const data = processOrderJobSchema.parse(job.data);
        console.log(`[process-order] job ${job.id} started (order ${data.orderId})`);
        await props.processOrderHandler.handle(data);
        console.log(`[process-order] job ${job.id} finished (order ${data.orderId})`);
      },
      { connection: props.connection, concurrency: props.concurrency },
    );

    this.queueEvents = new QueueEvents(PROCESS_ORDER_QUEUE_NAME, { connection: props.connection });
    this.queueEvents.on("completed", ({ jobId }) => {
      console.log(`[process-order] ${jobId} completed`);
    });
    this.queueEvents.on("failed", ({ jobId, failedReason }) => {
      console.log(`[process-order] ${jobId} failed: ${failedReason}`);
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
    await this.queueEvents.close();
  }
}
```

`concurrency` stays a required field on the props interface (not a default buried in this file) so the composition root states and justifies the value explicitly, per the spec's "explicit, justified concurrency" requirement.

## Step 9 — `cmd/deps.wiring.ts`

The composition root's shared singletons — the one place `@deps` is filled in. Vendor SDK instantiation (`IORedis`) stays a plain `new IORedis(url, options)` call — the props-interface convention applies to *this project's own* classes, not to wrapping every third-party constructor.

```ts
import IORedis from "ioredis";

import { env } from "@env";
import { Drizzler } from "@customs/drizzler";
import { BullmqOrderQueue } from "@queues/process-order.queue";

export const redisConnection = new IORedis(env.REDIS_QUEUE_URL, {
  maxRetriesPerRequest: null,
});

export const db = new Drizzler({ url: env.POSTGRES_CONNECTION }).db;

export const orderQueue = new BullmqOrderQueue({ connection: redisConnection });
```

## Step 10 — `infra/http/orders.plugin.ts`

`GET /orders/:id` is a plain read, not a use case with business rules — it stays inline in the plugin rather than becoming a third handler class. Only `POST /orders` goes through `CreateOrderHandler`.

```ts
import { Elysia } from "elysia";
import { eq } from "drizzle-orm";

import type { Database } from "@customs/drizzler";
import type { CreateOrderHandler } from "@app/order-processor/create-order.handler";
import { orderPayloadSchema } from "@core/orders/order.types";
import { orders } from "@elements/core.element";

export interface OrdersPluginProps {
  createOrderHandler: CreateOrderHandler;
  db: Database;
}

export class OrdersPlugin {
  readonly router: Elysia;

  constructor(props: OrdersPluginProps) {
    this.router = new Elysia({ prefix: "/orders" })
      .post("/", async ({ body, set }) => {
        const payload = orderPayloadSchema.parse(body);
        const result = await props.createOrderHandler.handle(payload);
        set.status = 201;
        return result;
      })
      .get("/:id", async ({ params, set }) => {
        const [order] = await props.db.select().from(orders).where(eq(orders.id, params.id));
        if (!order) {
          set.status = 404;
          return { error: "Order not found" };
        }
        return order;
      });
  }
}
```

## Step 11 — wire the API entrypoint

Edit `source/cmd/service.boot.ts`:

```ts
import { env } from "@env";
import { Elysia } from "elysia";

import { ScalarsPlugin } from "@plugins/scalars.plugin";
import { OriginsPlugin } from "@plugins/origins.plugin";
import { OrdersPlugin } from "@infra/http/orders.plugin"; // or relative, see note below
import { CreateOrderHandler } from "@app/order-processor/create-order.handler";
import { db, orderQueue } from "@deps";

const createOrderHandler = new CreateOrderHandler({ db, orderQueue });
const ordersPlugin = new OrdersPlugin({ createOrderHandler, db });

const app = new Elysia({ prefix: "/api" })
  .use(OriginsPlugin)
  .use(ScalarsPlugin)
  .use(ordersPlugin.router)
  .listen(env.APP_PORT);

const url = `http://${app.server?.hostname}:${app.server?.port}`;
console.log(`🦊 Elysia is running at ${url}`);
```

Note: `infra/http` has no path alias yet (only `infra/plugins` does, via `@plugins/*`). Either add `"@http/*": ["./source/infra/http/*"]` to `tsconfig.json` alongside the other two new aliases, or import it with a relative path (`../infra/http/orders.plugin`). Recommend adding the alias for consistency with every other folder under `source/infra`, `source/core`, and `source/app`.

## Step 12 — `cmd/worker.boot.ts` (new)

```ts
import { env } from "@env";
import { redisConnection, db } from "@deps";
import { ProcessOrderHandler } from "@app/order-processor/process-order.handler";
import { ProcessOrderWorker } from "@queues/process-order.worker";

const processOrderHandler = new ProcessOrderHandler({ db });
const processOrderWorker = new ProcessOrderWorker({
  connection: redisConnection,
  processOrderHandler,
  concurrency: 1, // trivial value for phase 1 — real tuning is phase 4's job
});

console.log(`🐂 ${env.APP_NAME} worker consuming "process-order"`);

process.on("SIGTERM", async () => {
  console.log("SIGTERM received — draining active job before exit");
  await processOrderWorker.close();
  process.exit(0);
});
```

Note `worker.boot.ts` never imports `orderQueue` from `@deps` — it has no use for the producer side. `service.boot.ts` never imports `ProcessOrderHandler` — same reasoning in the other direction.

## Implementation order

1. `tsconfig.json` + `package.json` (Step 0) — nothing compiles without the aliases and deps.
2. `core/orders/order.types.ts`, `core/queues/order-queue.port.ts`, `core/queues/queue.errors.ts` (Steps 1-3) — no dependencies on anything else new.
3. `drizzle/customs/drizzler.ts` (Step 4) — needed by everything downstream that touches Postgres.
4. `infra/queues/process-order.queue.ts` (Step 5) — depends only on `core`.
5. `app/order-processor/create-order.handler.ts`, `app/order-processor/process-order.handler.ts` (Steps 6-7) — depend on `core` + `Database`.
6. `infra/queues/process-order.worker.ts` (Step 8) — depends on the queue name from Step 5 and `ProcessOrderHandler` from Step 7 (type-only import for the constructor's props type).
7. `cmd/deps.wiring.ts` (Step 9) — first point everything gets wired together.
8. `infra/http/orders.plugin.ts` (Step 10).
9. `cmd/service.boot.ts` edit + `cmd/worker.boot.ts` new (Steps 11-12).
10. Manual test per the spec's "How to test" section.

## Open decisions to confirm before implementing

- **`processing` status write**: `ProcessOrderHandler.handle` sets `orders.status = "processing"` when the worker picks up the job, with no matching `order_events` row (the spec's example event-type list has no `order_processing_started`). This wasn't explicit in the spec's acceptance criteria — flagging it here rather than silently adding scope. Drop it if you'd rather phase 1 only ever writes `pending → completed/failed`.
- **Enqueue failure after the DB commit**: `CreateOrderHandler.handle` commits the `orders`/`order_events` transaction *before* calling `enqueueProcessOrder`. If the enqueue throws (`QueueEnqueueError`), the order is already `pending` in Postgres with no job ever created — it'll sit there forever in phase 1 (no sweep exists until phase 2). The plan currently lets that error propagate to the HTTP layer as a 500, leaving the stuck `pending` row as-is. Acceptable for this phase, but worth knowing it's a real gap, not an oversight.
- **`infra/http` path alias**: needs a decision (add `@http/*` vs. relative import) before Step 11 — see the note there.
- **`GET /orders/:id` staying handler-less**: confirm you're fine with it living inline in `OrdersPlugin` rather than becoming a third handler class — it's a plain Drizzle read with no branching logic, so a dedicated handler felt like ceremony without payoff, but flagging the call since "one handler per method" was the instruction for the order processor specifically.
