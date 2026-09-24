import type { Executor } from "@drizz/helpers/executor.helper";
import { products } from "@drizz/models/products.model";
import { seed } from "drizzle-seed";
import { PRODUCT_NAMES } from "./products.data";

export class ProductsSeeder {
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
