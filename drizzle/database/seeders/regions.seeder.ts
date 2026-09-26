import type { Executor } from "@db/helpers/executor.helper";
import type { Seeder } from "@db/helpers/seeder.helper";
import { regions } from "@db/models/regions.model";
import { seed } from "drizzle-seed";
import { REGION_NAMES } from "./regions.data";

export class RegionsSeeder implements Seeder {
	readonly name = "regions";

	run(db: Executor) {
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
