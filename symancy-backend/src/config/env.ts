/**
 * Environment validation with Zod 4.x
 * All environment variables are validated at startup
 */
import { z } from "zod";

/**
 * Server mode enum
 */
const ModeSchema = z.enum(["API", "WORKER", "BOTH"]);
export type Mode = z.infer<typeof ModeSchema>;

/**
 * Log level enum
 */
const LogLevelSchema = z.enum(["trace", "debug", "info", "warn", "error", "fatal"]);
export type LogLevel = z.infer<typeof LogLevelSchema>;

/**
 * Environment variables schema
 */
const EnvSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  MODE: ModeSchema.default("BOTH"),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(20),
  DATABASE_URL: z.string().startsWith("postgres"),

  // Telegram Bot
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[A-Za-z0-9_-]+$/, "Invalid Telegram bot token format"),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16, "Webhook secret must be at least 16 characters"),

  // OpenRouter (LLM API)
  OPENROUTER_API_KEY: z.string().startsWith("sk-or-"),

  // Supabase JWT (for custom Telegram user tokens)
  SUPABASE_JWT_SECRET: z.string().min(32, "JWT secret must be at least 32 characters"),

  // Optional Settings
  LOG_LEVEL: LogLevelSchema.default("info"),
  ADMIN_CHAT_ID: z.coerce.number().optional(),
  FRONTEND_URL: z.string().url().optional(),
  WEBAPP_URL: z.string().url().optional(),  // Telegram WebApp URL (e.g., https://symancy.ru/chat)

  // Webhook Configuration
  WEBHOOK_BASE_URL: z.string().url().default("https://symancy.ru"),

  // Telegram Rate Limiting
  TELEGRAM_RATE_LIMIT_MS: z.coerce.number().min(10).max(1000).default(100),

  // Photo Storage
  PHOTO_STORAGE_PATH: z.string().default("./data/photos"),

  // Database Pool Configuration
  DB_POOL_MAX: z.coerce.number().min(1).max(100).default(20),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().min(1000).default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().min(100).default(2000),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Parse and validate environment variables
 * Throws ZodError if validation fails
 */
function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`Environment validation failed:\n${formatted}`);
  }

  return result.data;
}

/**
 * Validated environment variables
 * Lazy initialization to allow for testing
 */
let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    _env = parseEnv();
  }
  return _env;
}

/**
 * Reset env cache (for testing)
 */
export function resetEnv(): void {
  _env = null;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === "development";
}

/**
 * Check if API mode is enabled
 */
export function isApiMode(): boolean {
  const mode = getEnv().MODE;
  return mode === "API" || mode === "BOTH";
}

/**
 * Check if Worker mode is enabled
 */
export function isWorkerMode(): boolean {
  const mode = getEnv().MODE;
  return mode === "WORKER" || mode === "BOTH";
}
