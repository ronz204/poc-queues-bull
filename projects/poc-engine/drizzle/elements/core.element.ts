import { index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";
import { schemas, enums } from "./help.element";
import { generateId } from "@customs/helpers/column.helper";

export const orders = schemas.core.table("orders", {
    id: uuid("id").primaryKey().$defaultFn(generateId),
    status: enums.orderStatus("status").notNull().default("pending"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("orders_status_idx").on(table.status),
    index("orders_pending_created_at_idx").on(table.createdAt).where(sql`${table.status} = 'pending'`),
  ],
);

export const orderEvents = schemas.core.table("order_events", {
    id: uuid("id").primaryKey().$defaultFn(generateId),
    orderId: uuid("order_id").notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    detail: jsonb("detail").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("order_events_order_id_created_at_idx").on(table.orderId, table.createdAt)],
);
