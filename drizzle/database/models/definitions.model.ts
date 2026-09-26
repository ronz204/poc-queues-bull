import { generateId } from "@db/helpers/column.helper";
import { reports } from "@db/helpers/existing.helper";
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

export const DEFINITIONS_ACTIVE_NAME_IDX = "definitions_active_name_idx";

export const definitionStatus = reports.enum("definition_status", ["active", "archived"]);

export const definitions = reports.table(
	"definitions",
	{
		id: pg.uuid("id").primaryKey().$defaultFn(generateId),
		name: pg.text("name").notNull(),
		aggregationType: aggregationType("aggregation_type").notNull(),
		groupBy: groupByDimension("group_by").notNull(),
		windowStart: pg.timestamp("window_start", { withTimezone: true }).notNull(),
		windowEnd: pg.timestamp("window_end", { withTimezone: true }).notNull(),
		cronExpression: pg.text("cron_expression").notNull(),
		version: pg.integer("version").notNull().default(1),
		status: definitionStatus("status").notNull().default("active"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg.timestamp("updated_at", { withTimezone: true }).notNull(),
	},
	(table) => [
		pg
			.uniqueIndex(DEFINITIONS_ACTIVE_NAME_IDX)
			.on(table.name)
			.where(sql`${table.status} = 'active'`),
	],
);
