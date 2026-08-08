import { env } from "@env";
import { Elysia } from "elysia";

import { ScalarsPlugin } from "@plugins/scalars.plugin";
import { OriginsPlugin } from "@plugins/origins.plugin";
import { OrdersPlugin } from "@http/orders.plugin";
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
