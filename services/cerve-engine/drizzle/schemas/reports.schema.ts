import { sql } from "drizzle-orm";
import {
  bigint,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

export const reportingSchema = pgSchema("reporting");

export const aggregationTypeEnum = reportingSchema.enum("aggregation_type", [
  "sum",
  "avg",
  "count",
  "min",
  "max",
]);

export const groupByDimensionEnum = reportingSchema.enum("group_by_dimension", [
  "product",
  "region",
  "day",
  "week",
  "month",
]);

export const reportDefinitionStatusEnum = reportingSchema.enum("report_definition_status", [
  "active",
  "archived",
]);

export const executionTriggerTypeEnum = reportingSchema.enum("execution_trigger_type", [
  "cron",
  "manual",
]);

export const executionStatusEnum = reportingSchema.enum("execution_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

export const reportDefinitions = reportingSchema.table("report_definitions", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  name: text("name").notNull(),
  aggregationType: aggregationTypeEnum("aggregation_type").notNull(),
  groupBy: groupByDimensionEnum("group_by").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  cronExpression: text("cron_expression").notNull(),
  version: integer("version").notNull().default(1),
  status: reportDefinitionStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (t) => [
  uniqueIndex("report_definitions_active_name_idx").on(t.name).where(sql`${t.status} = 'active'`),
]);

export const reportExecutions = reportingSchema.table("report_executions", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  reportDefinitionId: uuid("report_definition_id").notNull().references(() => reportDefinitions.id),
  reportDefinitionVersion: integer("report_definition_version").notNull(),
  triggerType: executionTriggerTypeEnum("trigger_type").notNull(),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  status: executionStatusEnum("status").notNull().default("pending"),
  workerId: text("worker_id"),
  fencingToken: bigint("fencing_token", { mode: "number" }),
  result: jsonb("result"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("report_executions_idempotency_idx").on(
    t.reportDefinitionId, t.reportDefinitionVersion,
    t.triggerType, t.scheduledFor),
]);
