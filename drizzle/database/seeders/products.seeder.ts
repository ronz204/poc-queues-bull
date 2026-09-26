import type { Executor } from "@db/helpers/executor.helper";
import type { Seeder } from "@db/helpers/seeder.helper";
import { products } from "@db/models/products.model";
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
