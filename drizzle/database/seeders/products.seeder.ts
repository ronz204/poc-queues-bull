import type { Db } from "@drizz/dal/drizzle.client";
import { products } from "@drizz/database/models/products.model";
import { seed } from "drizzle-seed";
import { PRODUCT_NAMES } from "./products.data";

export class ProductsSeeder {
	readonly name = "products";

	run(db: Db) {
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
