import type { Executor } from "@drizz/helpers/executor.helper";
import { regions } from "@drizz/models/regions.model";
import { seed } from "drizzle-seed";
import { REGION_NAMES } from "./regions.data";

export class RegionsSeeder {
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
