import { index, numeric, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

export const salesSchema = pgSchema("sales");

export const products = salesSchema.table("products", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  name: text("name").notNull().unique(),
});

export const regions = salesSchema.table("regions", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  name: text("name").notNull().unique(),
});

export const saleTransactions = salesSchema.table("sale_transactions", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  productId: uuid("product_id").notNull().references(() => products.id),
  regionId: uuid("region_id").notNull().references(() => regions.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("sale_transactions_occurred_at_idx").on(t.occurredAt),
  index("sale_transactions_product_id_idx").on(t.productId),
  index("sale_transactions_region_id_idx").on(t.regionId),
]);
