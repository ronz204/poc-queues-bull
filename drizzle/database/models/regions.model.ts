import { generateId } from "@db/helpers/column.helper";
import { sales } from "@db/helpers/existing.helper";
import * as pg from "drizzle-orm/pg-core";

export const regions = sales.table("regions", {
	id: pg.uuid("id").primaryKey().$defaultFn(generateId),
	name: pg.text("name").notNull().unique(),
});
