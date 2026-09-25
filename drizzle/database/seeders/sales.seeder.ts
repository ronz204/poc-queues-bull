import type { Executor } from "@drizz/database/helpers/executor.helper";
import { products } from "@drizz/database/models/products.model";
import { regions } from "@drizz/database/models/regions.model";
import { transactions } from "@drizz/database/models/transactions.model";
import type { Seeder } from "@drizz/seed.runner";
import { seed } from "drizzle-seed";

const TRANSACTION_COUNT = 5_000;
const OCCURRED_AT_WINDOW_DAYS = 90;

export class SalesSeeder implements Seeder {
	readonly name = "transactions";

	async run(db: Executor) {
		const productIds = (await db.select({ id: products.id }).from(products)).map((row) => row.id);
		const regionIds = (await db.select({ id: regions.id }).from(regions)).map((row) => row.id);

		const now = new Date();
		const windowStart = new Date(now.getTime() - OCCURRED_AT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

		await seed(db, { transactions }).refine((funcs) => ({
			transactions: {
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
