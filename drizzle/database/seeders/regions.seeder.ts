import type { Db } from "@drizz/dal/drizzle.client";
import { regions } from "@drizz/database/models/regions.model";
import { seed } from "drizzle-seed";
import { REGION_NAMES } from "./regions.data";

export class RegionsSeeder {
	readonly name = "regions";

	run(db: Db) {
		return seed(db, { regions }).refine((funcs) => ({
			regions: {
				count: REGION_NAMES.length,
				columns: {
					name: funcs.valuesFromArray({
						values: [...REGION_NAMES],
						isUnique: true,
					}),
				},
			},
		}));
	}
}
