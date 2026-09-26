import { generateId } from "@db/helpers/column.helper";
import { sales } from "@db/helpers/existing.helper";
import * as pg from "drizzle-orm/pg-core";
import { products } from "./products.model";
import { regions } from "./regions.model";

export const transactions = sales.table(
	"transactions",
	{
		id: pg.uuid("id").primaryKey().$defaultFn(generateId),
		productId: pg.uuid("product_id").notNull(),
		regionId: pg.uuid("region_id").notNull(),
		amount: pg.numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
		occurredAt: pg.timestamp("occurred_at", { withTimezone: true }).notNull(),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		pg.index("transactions_occurred_at_idx").on(table.occurredAt),
		pg.index("transactions_product_id_idx").on(table.productId),
		pg.index("transactions_region_id_idx").on(table.regionId),
		pg
			.foreignKey({
				name: "transactions_product_id_fk",
				columns: [table.productId],
				foreignColumns: [products.id],
			})
			.onDelete("restrict")
			.onUpdate("restrict"),
		pg
			.foreignKey({
				name: "transactions_region_id_fk",
				columns: [table.regionId],
				foreignColumns: [regions.id],
			})
			.onDelete("restrict")
			.onUpdate("restrict"),
	],
);
