import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

loadEnv({ path: resolve(process.cwd(), '../../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(3001),
  APP_URL: z.string().default('http://localhost:3000'),
  DATABASE_URL: z
    .string()
    .default('postgresql://al_os_user:change_me_dev_password@localhost:5432/al_business_os'),
  BETTER_AUTH_SECRET: z
    .string()
    .min(16)
    .default('dev_secret_key_change_in_production_32chars'),
  JWT_ISSUER: z.string().default('al-business-os'),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434/v1'),
  OLLAMA_CHAT_MODEL: z.string().default('qwen2.5:7b'),
  OLLAMA_REASONING_MODEL: z.string().default('qwen2.5:14b'),
});

export type AppEnv = z.infer<typeof envSchema>;

export const appEnv: AppEnv = envSchema.parse(process.env);
