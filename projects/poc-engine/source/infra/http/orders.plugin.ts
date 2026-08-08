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

  readonly router;

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
  };
};
