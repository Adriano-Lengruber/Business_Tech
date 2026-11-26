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
  REDIS_URL: z.string().default('redis://localhost:6379'),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('al-business-os-private'),
  S3_ACCESS_KEY: z.string().default('rustfsadmin'),
  S3_SECRET_KEY: z.string().default('change_me_s3_secret'),
  BETTER_AUTH_SECRET: z
    .string()
    .min(16)
    .default('dev_secret_key_change_in_production_32chars'),
  ENCRYPTION_KEY: z
    .string()
    .default('replace_with_64_hex_chars_aes_256_gcm_key'),
  JWT_ISSUER: z.string().default('al-business-os'),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434/v1'),
  OLLAMA_CHAT_MODEL: z.string().default('qwen2.5:7b'),
  OLLAMA_REASONING_MODEL: z.string().default('qwen2.5:14b'),
  WHISPER_BASE_URL: z.string().default('http://localhost:8000/v1'),
  WHATSAPP_PROVIDER: z.enum(['evolution', 'meta_cloud']).default('evolution'),
  EVOLUTION_API_URL: z.string().default('http://localhost:8080'),
  EVOLUTION_API_KEY: z.string().default('change_me_evolution_api_key'),
  EVOLUTION_INSTANCE: z.string().default('al-tech-main'),
  WHATSAPP_DEBOUNCE_MS: z.coerce.number().default(4000),
});

export type AppEnv = z.infer<typeof envSchema>;

export const appEnv: AppEnv = envSchema.parse(process.env);
