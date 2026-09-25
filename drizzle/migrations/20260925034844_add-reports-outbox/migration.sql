CREATE TABLE "reports"."outbox" (
	"id" uuid PRIMARY KEY,
	"event_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "reports"."outbox" ("id") WHERE "published_at" is null;