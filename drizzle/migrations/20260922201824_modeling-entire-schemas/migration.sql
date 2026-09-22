CREATE TYPE "reports"."aggregation_type" AS ENUM('sum', 'avg', 'count', 'min', 'max');--> statement-breakpoint
CREATE TYPE "reports"."group_by_dimension" AS ENUM('product', 'region', 'day', 'week', 'month');--> statement-breakpoint
CREATE TYPE "reports"."report_definition_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "reports"."execution_status" AS ENUM('pending', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "reports"."execution_trigger_type" AS ENUM('cron', 'manual');--> statement-breakpoint
CREATE TABLE "sales"."products" (
	"id" uuid PRIMARY KEY,
	"name" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "sales"."regions" (
	"id" uuid PRIMARY KEY,
	"name" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "reports"."report_definitions" (
	"id" uuid PRIMARY KEY,
	"name" text NOT NULL,
	"aggregation_type" "reports"."aggregation_type" NOT NULL,
	"group_by" "reports"."group_by_dimension" NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"cron_expression" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "reports"."report_definition_status" DEFAULT 'active'::"reports"."report_definition_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports"."report_executions" (
	"id" uuid PRIMARY KEY,
	"report_definition_id" uuid NOT NULL,
	"report_definition_version" integer NOT NULL,
	"trigger_type" "reports"."execution_trigger_type" NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "reports"."execution_status" DEFAULT 'pending'::"reports"."execution_status" NOT NULL,
	"worker_id" text,
	"fencing_token" bigint,
	"result" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales"."sale_transactions" (
	"id" uuid PRIMARY KEY,
	"product_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "report_definitions_active_name_idx" ON "reports"."report_definitions" ("name") WHERE "status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "report_executions_idempotency_idx" ON "reports"."report_executions" ("report_definition_id","report_definition_version","trigger_type","scheduled_for");--> statement-breakpoint
CREATE INDEX "sale_transactions_occurred_at_idx" ON "sales"."sale_transactions" ("occurred_at");--> statement-breakpoint
CREATE INDEX "sale_transactions_product_id_idx" ON "sales"."sale_transactions" ("product_id");--> statement-breakpoint
CREATE INDEX "sale_transactions_region_id_idx" ON "sales"."sale_transactions" ("region_id");--> statement-breakpoint
ALTER TABLE "reports"."report_executions" ADD CONSTRAINT "report_executions_report_definition_id_fk" FOREIGN KEY ("report_definition_id") REFERENCES "reports"."report_definitions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;--> statement-breakpoint
ALTER TABLE "sales"."sale_transactions" ADD CONSTRAINT "sale_transactions_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "sales"."products"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;--> statement-breakpoint
ALTER TABLE "sales"."sale_transactions" ADD CONSTRAINT "sale_transactions_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "sales"."regions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;