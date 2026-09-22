import type { Db } from "@drizz/dal/drizzle.client";
import { products } from "@drizz/database/models/products.model";
import { regions } from "@drizz/database/models/regions.model";
import { saleTransactions } from "@drizz/database/models/sale-transactions.model";
import { seed } from "drizzle-seed";

const TRANSACTION_COUNT = 5_000;
const OCCURRED_AT_WINDOW_DAYS = 90;

export class SalesSeeder {
	readonly name = "sale_transactions";

	async run(db: Db) {
		const productIds = (
			await db.select({ id: products.id }).from(products)
		).map((row) => row.id);
		const regionIds = (await db.select({ id: regions.id }).from(regions)).map(
			(row) => row.id,
		);

		const now = new Date();
		const windowStart = new Date(
			now.getTime() - OCCURRED_AT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
		);

		await seed(db, { saleTransactions }).refine((funcs) => ({
			saleTransactions: {
				count: TRANSACTION_COUNT,
				columns: {
					productId: funcs.valuesFromArray({ values: productIds }),
					regionId: funcs.valuesFromArray({ values: regionIds }),
					amount: funcs.number({ minValue: 5, maxValue: 500, precision: 100 }),
					occurredAt: funcs.timestamp({ min: windowStart, max: now }),
					createdAt: false,
				},
			},
		}));
	}
}
