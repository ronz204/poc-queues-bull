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
  };

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

    await this.orderQueue.enqueueProcessOrder({ orderId: order.id, payload });

    return { id: order.id, status: "pending" };
  };
};
