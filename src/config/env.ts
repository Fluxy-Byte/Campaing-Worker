import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(7082),

  DATABASE_URL: z.string().min(1),

  INTERNAL_API_KEY: z.string().min(1),

  RABBITMQ_URL: z.string().min(1),

  MONGO_URL: z.string().min(1),
  MONGO_DB_NAME: z.string().min(1),

  META_GRAPH_API_VERSION: z.string().default("v21.0"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
