import { env } from "@env";
import { Elysia } from "elysia";

export const HealthPlugin = new Elysia({ name: "health.plugin" })
  .get("/health", () => ({ service: env.SERVICE_NAME, status: "healthy" }));
