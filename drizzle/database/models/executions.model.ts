import { generateId } from "@db/helpers/column.helper";
import { reports } from "@db/helpers/existing.helper";
import * as pg from "drizzle-orm/pg-core";
import { definitions } from "./definitions.model";

export const executionTriggerType = reports.enum("execution_trigger_type", ["cron", "manual"]);

export const executionStatus = reports.enum("execution_status", [
	"pending",
	"running",
	"succeeded",
	"failed",
]);

export const EXECUTIONS_IDEMPOTENCY_IDX = "executions_idempotency_idx";

export const executions = reports.table(
	"executions",
	{
		id: pg.uuid("id").primaryKey().$defaultFn(generateId),
		definitionId: pg.uuid("definition_id").notNull(),
		definitionVersion: pg.integer("definition_version").notNull(),
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
			.uniqueIndex(EXECUTIONS_IDEMPOTENCY_IDX)
			.on(table.definitionId, table.definitionVersion, table.triggerType, table.scheduledFor),
		pg
			.index("executions_history_idx")
			.on(table.definitionId, table.scheduledFor.desc().nullsFirst(), table.id.desc().nullsFirst()),
		pg
			.index("executions_status_history_idx")
			.on(
				table.definitionId,
				table.status,
				table.scheduledFor.desc().nullsFirst(),
				table.id.desc().nullsFirst(),
			),
		pg
			.foreignKey({
				name: "executions_definition_id_fk",
				columns: [table.definitionId],
				foreignColumns: [definitions.id],
			})
			.onDelete("restrict")
			.onUpdate("restrict"),
	],
);
