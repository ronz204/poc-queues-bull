import { generateId } from "@drizz/database/helpers/column.helper";
import { reports } from "@drizz/database/helpers/existing.helper";
import { sql } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";

export const aggregationType = reports.enum("aggregation_type", [
	"sum",
	"avg",
	"count",
	"min",
	"max",
]);

export const groupByDimension = reports.enum("group_by_dimension", [
	"product",
	"region",
	"day",
	"week",
	"month",
]);

export const reportDefinitionStatus = reports.enum("report_definition_status", [
	"active",
	"archived",
]);

export const reportDefinitions = reports.table(
	"report_definitions",
	{
		id: pg.uuid("id").primaryKey().$defaultFn(generateId),
		name: pg.text("name").notNull(),
		aggregationType: aggregationType("aggregation_type").notNull(),
		groupBy: groupByDimension("group_by").notNull(),
		windowStart: pg.timestamp("window_start", { withTimezone: true }).notNull(),
		windowEnd: pg.timestamp("window_end", { withTimezone: true }).notNull(),
		cronExpression: pg.text("cron_expression").notNull(),
		version: pg.integer("version").notNull().default(1),
		status: reportDefinitionStatus("status").notNull().default("active"),
		createdAt: pg
			.timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull(),
	},
	(table) => [
		pg
			.uniqueIndex("report_definitions_active_name_idx")
			.on(table.name)
			.where(sql`${table.status} = 'active'`),
	],
);
