import { env } from "@env";
import { openapi } from "@elysia/openapi";

export const ScalarsPlugin = openapi({
  path: "/docs",
  documentation: {
    info: {
      title: env.SERVICE_NAME,
      version: env.SERVICE_VERSION,
    },
  },
});
