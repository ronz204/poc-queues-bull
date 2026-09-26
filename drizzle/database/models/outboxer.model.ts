import { generateId } from "@db/helpers/column.helper";
import { reports } from "@db/helpers/existing.helper";
import { sql } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";

export const outbox = reports.table(
	"outbox",
	{
		id: pg.uuid("id").primaryKey().$defaultFn(generateId),
		eventType: pg.text("event_type").notNull(),
		aggregateId: pg.uuid("aggregate_id").notNull(),
		payload: pg.jsonb("payload").notNull(),
		occurredAt: pg.timestamp("occurred_at", { withTimezone: true }).notNull(),
		publishedAt: pg.timestamp("published_at", { withTimezone: true }),
	},
	(table) => [pg.index("outbox_pending_idx").on(table.id).where(sql`${table.publishedAt} is null`)],
);
