import { z } from "zod";

const envSchema = z.object({
  // ==========================================
  // Service
  // ==========================================
  APP_NAME: z.string().min(1),
  APP_VERSION: z.string().min(1),
  APP_PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // ==========================================
  // Redis
  // ==========================================
  REDIS_QUEUE_URL: z.url(),
  REDIS_CACHE_URL: z.url(),

  // ==========================================
  // PostgreSQL
  // ==========================================
  POSTGRES_CONNECTION: z.url(),
  POSTGRES_USERNAME: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),

  // ==========================================
  // CORS
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
