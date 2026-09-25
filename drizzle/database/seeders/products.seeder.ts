import type { Executor } from "@drizz/database/helpers/executor.helper";
import { products } from "@drizz/database/models/products.model";
import type { Seeder } from "@drizz/seed.runner";
import { seed } from "drizzle-seed";
import { PRODUCT_NAMES } from "./products.data";

export class ProductsSeeder implements Seeder {
	readonly name = "products";

	run(db: Executor) {
		return seed(db, { products }).refine((funcs) => ({
			products: {
				count: PRODUCT_NAMES.length,
				columns: {
					name: funcs.valuesFromArray({
						values: [...PRODUCT_NAMES],
						isUnique: true,
					}),
				},
			},
		}));
	}
}
