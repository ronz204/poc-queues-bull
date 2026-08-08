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
  };

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
  };
};
