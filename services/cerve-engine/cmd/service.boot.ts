import { env } from "@env";
import { Elysia } from "elysia";

import { HealthPlugin } from "@plugins/health.plugin";
import { OriginsPlugin } from "@plugins/origins.plugin";
import { ScalarsPlugin } from "@plugins/scalars.plugin";

export const app = new Elysia({ prefix: "/api" })
  .use(HealthPlugin).use(OriginsPlugin).use(ScalarsPlugin);

const url = `http://${env.SERVICE_DOMAIN}:${env.SERVICE_PORT}`;
console.log(`🦊 Elysia is running at ${url}`);
