import { z } from "zod";

const envSchema = z.object({
  // ==========================================
  // ====== Service Engine
  // ==========================================
  SERVICE_NAME: z.string().min(1),
  SERVICE_VERSION: z.string().min(1),
  SERVICE_DOMAIN: z.string().min(1).default("localhost"),
  SERVICE_PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // ==========================================
  // ====== CORS Policies
  // ==========================================
  CORS_ORIGIN: z.string()
    .transform((val) => val.split(",").map((origin) => origin.trim()))
    .pipe(z.array(z.url()).min(1)),
  CORS_METHODS: z.string()
    .transform((val) => val.split(",").map((method) => method.trim()))
    .pipe(z.array(z.string().min(1)).min(1)),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
