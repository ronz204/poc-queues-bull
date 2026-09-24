import { generateId } from "@drizz/database/helpers/column.helper";
import { reports } from "@drizz/database/helpers/existing.helper";
import * as pg from "drizzle-orm/pg-core";
import { reportDefinitions } from "./report-definitions.model";

export const executionTriggerType = reports.enum("execution_trigger_type", ["cron", "manual"]);

export const executionStatus = reports.enum("execution_status", [
	"pending",
	"running",
	"succeeded",
	"failed",
]);

export const reportExecutions = reports.table(
	"report_executions",
	{
		id: pg.uuid("id").primaryKey().$defaultFn(generateId),
		reportDefinitionId: pg.uuid("report_definition_id").notNull(),
		reportDefinitionVersion: pg.integer("report_definition_version").notNull(),
		triggerType: executionTriggerType("trigger_type").notNull(),
		scheduledFor: pg.timestamp("scheduled_for", { withTimezone: true }).notNull(),
		status: executionStatus("status").notNull().default("pending"),
		workerId: pg.text("worker_id"),
		fencingToken: pg.bigint("fencing_token", { mode: "number" }),
		result: pg.jsonb("result"),
		errorMessage: pg.text("error_message"),
		startedAt: pg.timestamp("started_at", { withTimezone: true }),
		finishedAt: pg.timestamp("finished_at", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		pg
			.uniqueIndex("report_executions_idempotency_idx")
			.on(
				table.reportDefinitionId,
				table.reportDefinitionVersion,
				table.triggerType,
				table.scheduledFor,
			),
		pg
			.foreignKey({
				name: "report_executions_report_definition_id_fk",
				columns: [table.reportDefinitionId],
				foreignColumns: [reportDefinitions.id],
			})
			.onDelete("restrict")
			.onUpdate("restrict"),
	],
);
