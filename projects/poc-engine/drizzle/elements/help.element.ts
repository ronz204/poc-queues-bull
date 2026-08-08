import { pgEnum, pgSchema } from "drizzle-orm/pg-core";
const core = pgSchema("core");

const orderStatus = pgEnum("order_status", [
  "pending", "processing", "completed",
  "failed", "cancelled",
]);


export const schemas = Object.freeze({ core });
export const enums = Object.freeze({ orderStatus });
