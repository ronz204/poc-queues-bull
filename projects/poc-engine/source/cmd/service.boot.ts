import { env } from "@env";
import { Elysia } from "elysia";

import { ScalarsPlugin } from "@plugins/scalars.plugin";
import { OriginsPlugin } from "@plugins/origins.plugin";

const app = new Elysia({ prefix: "/api" })
  .use(OriginsPlugin)
  .use(ScalarsPlugin)
  .listen(env.APP_PORT);

const url = `http://${app.server?.hostname}:${app.server?.port}`;
console.log(`🦊 Elysia is running at ${url}`);
