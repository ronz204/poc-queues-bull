CREATE TABLE "core"."order_events" (
	"id" uuid PRIMARY KEY,
	"order_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"detail" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."orders" (
	"id" uuid PRIMARY KEY,
	"status" "order_status" DEFAULT 'pending'::"order_status" NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "order_events_order_id_created_at_idx" ON "core"."order_events" ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "core"."orders" ("status");--> statement-breakpoint
CREATE INDEX "orders_pending_created_at_idx" ON "core"."orders" ("created_at") WHERE "status" = 'pending';--> statement-breakpoint
ALTER TABLE "core"."order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "core"."orders"("id") ON DELETE CASCADE;