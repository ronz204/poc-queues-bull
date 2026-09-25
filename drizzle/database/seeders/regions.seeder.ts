import type { Executor } from "@drizz/database/helpers/executor.helper";
import { regions } from "@drizz/database/models/regions.model";
import type { Seeder } from "@drizz/seed.runner";
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
