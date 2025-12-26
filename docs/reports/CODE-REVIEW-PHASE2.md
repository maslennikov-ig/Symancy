# Code Review Report: Symancy Backend (Phase 2)

**Generated**: 2025-12-25
**Reviewer**: Claude Code (Automated Code Review)
**Project**: Symancy Telegram Bot Backend
**Technology Stack**: Node.js 22, TypeScript 5.8.3, Fastify 5.x, grammY 1.38.4, pg-boss 12.5.4, LangChain.js
**Total Lines of Code**: ~1,248 (excluding node_modules)

---

## Executive Summary

This code review analyzed the entire `symancy-backend` project focusing on bugs, type safety, security, best practices, performance, and code quality. The codebase is **well-structured** with excellent TypeScript strict mode configuration and good separation of concerns. However, several **critical** and **medium** priority issues were identified that should be addressed before production deployment.

### Key Findings

- **Critical Issues**: 5 (must fix before production)
- **High Priority Issues**: 8 (should fix soon)
- **Medium Priority Issues**: 12 (fix before Phase 3+)
- **Low Priority Issues**: 7 (nice to have)

### Overall Assessment

**Code Quality**: ⭐⭐⭐⭐ (4/5) - Well-written with good patterns
**Type Safety**: ⭐⭐⭐⭐⭐ (5/5) - Excellent strict TypeScript usage
**Security**: ⭐⭐⭐ (3/5) - Some critical security gaps identified
**Error Handling**: ⭐⭐⭐ (3/5) - Inconsistent error handling patterns
**Performance**: ⭐⭐⭐⭐ (4/5) - Good, but some optimization opportunities

---

## Critical Issues (MUST FIX)

### 1. **Race Condition in Credit Refund Operation**

**File**: `src/modules/credits/service.ts`
**Lines**: 60-86
**Severity**: 🔴 CRITICAL

**Description**: The `refundCredits` function has a race condition between read and write operations. Two concurrent refund operations could result in incorrect credit balances.

```typescript
// Current code (PROBLEMATIC)
export async function refundCredits(
  telegramUserId: number,
  amount = 1
): Promise<boolean> {
  // First get current credits
  const { data: currentData, error: fetchError } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("telegram_user_id", telegramUserId)
    .single();

  // Then increment (RACE CONDITION HERE)
  const { error } = await supabase
    .from("user_credits")
    .update({ credits: currentData.credits + amount })
    .eq("telegram_user_id", telegramUserId);
}
```

**Impact**:
- Data corruption in credit balances
- Users could lose credits or gain unearned credits
- Financial impact if credits are purchased

**Suggested Fix**:
```typescript
// Use database RPC function for atomic increment (like consumeCredits)
export async function refundCredits(
  telegramUserId: number,
  amount = 1
): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("refund_credits", {
    p_telegram_user_id: telegramUserId,
    p_amount: amount,
  });

  if (error) {
    logger.error({ telegramUserId, amount, error }, "Failed to refund credits");
    return false;
  }

  logger.info({ telegramUserId, amount, newBalance: data }, "Credits refunded");
  return true;
}
```

**Required Action**: Create database function `refund_credits` that performs atomic increment using PostgreSQL `UPDATE ... SET credits = credits + $1`.

---

### 2. **Missing Error Handling in Middleware Can Crash Bot**

**File**: `src/modules/router/middleware.ts`
**Lines**: 27-66, 74-102
**Severity**: 🔴 CRITICAL

**Description**: The `loadProfile` and `loadUserState` middleware functions don't catch database errors. If Supabase is down or times out, the entire bot request will fail with an unhandled promise rejection.

```typescript
// Current code (PROBLEMATIC)
export async function loadProfile(ctx: BotContext, next: NextFunction): Promise<void> {
  const telegramUserId = ctx.from?.id;
  // ...

  // This can throw unhandled errors if database is down
  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .single();

  // No try-catch wrapper!
}
```

**Impact**:
- Bot becomes unresponsive when database has issues
- Users see no response, poor UX
- Errors aren't logged properly

**Suggested Fix**:
```typescript
export async function loadProfile(ctx: BotContext, next: NextFunction): Promise<void> {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    logger.warn("No user ID in context");
    return next();
  }

  try {
    const supabase = getSupabase();

    let { data: profile, error: selectError } = await supabase
      .from("profiles")
      .select("*")
      .eq("telegram_user_id", telegramUserId)
      .single();

    if (selectError && selectError.code !== "PGRST116") {
      // PGRST116 = not found, which is expected for new users
      logger.error({ error: selectError, telegramUserId }, "Failed to load profile");
      // Continue with undefined profile - bot can still function
      return next();
    }

    // Create profile if doesn't exist
    if (!profile) {
      const { data: newProfile, error } = await supabase
        .from("profiles")
        .insert({
          telegram_user_id: telegramUserId,
          name: ctx.from.username || ctx.from.first_name || null,
          language_code: ctx.from.language_code || "ru",
        })
        .select()
        .single();

      if (error) {
        logger.error({ error, telegramUserId }, "Failed to create profile");
        // Continue without profile
      } else {
        profile = newProfile;
        logger.info({ telegramUserId }, "Created new profile");
      }
    }

    ctx.profile = profile as Profile;
    return next();
  } catch (error) {
    // Catch all unexpected errors
    logger.error({ error, telegramUserId }, "Unexpected error in loadProfile middleware");
    return next(); // Continue processing to avoid bot freeze
  }
}
```

**Required Action**: Wrap all database operations in try-catch blocks in both `loadProfile` and `loadUserState` middleware.

---

### 3. **Unvalidated File ID Could Enable DoS Attack**

**File**: `src/modules/router/index.ts`
**Lines**: 56-98
**Severity**: 🔴 CRITICAL

**Description**: The photo handler doesn't validate the file size before queueing the job. Telegram allows up to 10MB photos, which could overwhelm the vision API or cause memory issues.

```typescript
// Current code (PROBLEMATIC)
bot.on("message:photo", async (ctx: BotContext) => {
  // ...
  const photo = photos[photos.length - 1]; // Largest photo

  // No size validation!
  const jobData: PhotoAnalysisJobData = {
    telegramUserId: ctx.from.id,
    chatId: ctx.chat.id,
    messageId: loadingMessage.message_id,
    fileId: photo.file_id, // Could be 10MB file
    persona: "arina",
  };

  await sendJob(QUEUE_ANALYZE_PHOTO, jobData);
});
```

**Impact**:
- Users can upload massive images (up to 10MB)
- Vision API could reject or charge extra for large files
- Memory issues in image processing
- Potential DoS by flooding with large images

**Suggested Fix**:
```typescript
bot.on("message:photo", async (ctx: BotContext) => {
  logger.info({ telegramUserId: ctx.from?.id }, "Received photo");

  // Check maintenance mode
  if (await isMaintenanceMode()) {
    await ctx.reply("Бот находится на обслуживании. Попробуйте позже.");
    return;
  }

  // Type guards
  if (!ctx.message?.photo || !ctx.chat || !ctx.from) {
    logger.warn("Invalid photo message context");
    return;
  }

  const photos = ctx.message.photo;
  if (!photos || photos.length === 0) {
    logger.warn("No photo in message");
    return;
  }

  const photo = photos[photos.length - 1];
  if (!photo) {
    logger.warn("Photo is undefined");
    return;
  }

  // VALIDATE FILE SIZE
  if (photo.file_size && photo.file_size > TELEGRAM_PHOTO_SIZE_LIMIT) {
    await ctx.reply("Изображение слишком большое. Максимальный размер: 10MB.");
    logger.warn({ telegramUserId: ctx.from.id, fileSize: photo.file_size }, "Photo too large");
    return;
  }

  // Check credits BEFORE queueing job
  if (!(await hasCredits(ctx.from.id, 1))) {
    await ctx.reply("У вас недостаточно кредитов. Купите дополнительные кредиты.");
    return;
  }

  const loadingMessage = await ctx.reply("Смотрю в гущу...");

  const jobData: PhotoAnalysisJobData = {
    telegramUserId: ctx.from.id,
    chatId: ctx.chat.id,
    messageId: loadingMessage.message_id,
    fileId: photo.file_id,
    persona: "arina",
  };

  const jobId = await sendJob(QUEUE_ANALYZE_PHOTO, jobData);
  logger.info({ jobId, telegramUserId: ctx.from.id }, "Photo analysis job queued");
});
```

**Required Action**: Add file size validation and credit check before queueing photo analysis jobs.

---

### 4. **PostgresSaver Resource Leak**

**File**: `src/core/langchain/checkpointer.ts`
**Lines**: 49-55
**Severity**: 🔴 CRITICAL

**Description**: The `closeCheckpointer` function doesn't actually close the PostgreSQL connection pool used by PostgresSaver. The comment acknowledges this but doesn't provide a solution.

```typescript
// Current code (PROBLEMATIC)
export async function closeCheckpointer(): Promise<void> {
  if (_checkpointer) {
    // PostgresSaver doesn't expose explicit close method
    // Connection cleanup is handled by PostgreSQL pool
    _checkpointer = null; // Just nulls the reference, doesn't close connections!
  }
}
```

**Impact**:
- Database connections leak during graceful shutdown
- PostgreSQL max_connections could be exhausted
- Application hangs on shutdown waiting for connections to close
- Resource waste in production

**Suggested Fix**:

Check if PostgresSaver has an internal pool that can be closed:

```typescript
export async function closeCheckpointer(): Promise<void> {
  if (_checkpointer) {
    try {
      // PostgresSaver internally uses a pool - try to access and close it
      // Check the library source code for the actual property name
      if ((_checkpointer as any).pool) {
        await (_checkpointer as any).pool.end();
        getLogger().child({ module: "langchain" }).info("PostgresSaver pool closed");
      }
    } catch (error) {
      getLogger().child({ module: "langchain" }).warn(
        { error },
        "Failed to close PostgresSaver pool (may not have exposed method)"
      );
    } finally {
      _checkpointer = null;
    }
  }
}
```

**Alternative**: Use the same pool as `src/core/database.ts` by passing it to PostgresSaver constructor if supported, then rely on database.ts cleanup.

**Required Action**: Investigate PostgresSaver internal pool and implement proper cleanup or share pool with database.ts.

---

### 5. **Router Not Initialized in app.ts**

**File**: `src/app.ts`
**Lines**: 23-47
**Severity**: 🔴 CRITICAL

**Description**: The `setupRouter()` function from `src/modules/router/index.ts` is never called in the main application startup. This means **the bot has no handlers registered** and won't respond to any messages.

```typescript
// Current code (PROBLEMATIC)
async function startApi() {
  const env = getEnv();

  const fastify = Fastify({
    logger: false,
  });

  fastify.get("/health", async () => { /* ... */ });
  fastify.post("/webhook/telegram", createWebhookHandler()); // Handler exists but bot has no routes!

  await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
  // setupRouter() is NEVER CALLED!
  return fastify;
}
```

**Impact**:
- **Bot is completely non-functional**
- Webhook receives updates but bot doesn't process them
- No error is thrown, making it a silent failure

**Suggested Fix**:
```typescript
async function startApi() {
  const env = getEnv();

  const fastify = Fastify({
    logger: false,
  });

  // Setup bot handlers BEFORE starting server
  setupRouter();
  logger.info("Bot router initialized");

  fastify.get("/health", async () => {
    return {
      status: "ok",
      version: process.env.npm_package_version || "0.1.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  fastify.post("/webhook/telegram", createWebhookHandler());

  await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info({ port: env.PORT }, "API server listening");

  return fastify;
}
```

**Required Action**: Call `setupRouter()` during API startup. Import statement also missing: add `import { setupRouter } from "./modules/router/index.js";`

---

## High Priority Issues (SHOULD FIX)

### 6. **Missing Input Validation on Text Messages**

**File**: `src/modules/router/index.ts`
**Lines**: 100-136
**Severity**: 🟠 HIGH

**Description**: Text message handler doesn't validate message length or sanitize input before queueing. Long messages could cause issues downstream.

**Suggested Fix**:
```typescript
bot.on("message:text", async (ctx: BotContext) => {
  if (!ctx.message?.text || !ctx.chat || !ctx.from || !ctx.message) {
    logger.warn("Invalid text message context");
    return;
  }

  const text = ctx.message.text;

  // Skip commands
  if (text.startsWith("/")) {
    return;
  }

  // VALIDATE MESSAGE LENGTH
  if (text.length > 4000) {
    await ctx.reply("Сообщение слишком длинное. Максимум 4000 символов.");
    return;
  }

  // SANITIZE: Remove null bytes and control characters
  const sanitizedText = text.replace(/\x00/g, "").replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  if (sanitizedText.trim().length === 0) {
    logger.warn({ telegramUserId: ctx.from.id }, "Empty message after sanitization");
    return;
  }

  logger.info({ telegramUserId: ctx.from.id }, "Received text message");

  if (await isMaintenanceMode()) {
    await ctx.reply("Бот находится на обслуживании. Попробуйте позже.");
    return;
  }

  // Check credits
  if (!(await hasCredits(ctx.from.id, 1))) {
    await ctx.reply("У вас недостаточно кредитов.");
    return;
  }

  await ctx.replyWithChatAction("typing");

  const jobData: ChatReplyJobData = {
    telegramUserId: ctx.from.id,
    chatId: ctx.chat.id,
    messageId: ctx.message.message_id,
    text: sanitizedText,
  };

  const jobId = await sendJob(QUEUE_CHAT_REPLY, jobData);
  logger.info({ jobId, telegramUserId: ctx.from.id }, "Chat reply job queued");
});
```

---

### 7. **No Retry Logic in Image Download**

**File**: `src/utils/image-processor.ts`
**Lines**: 18-49
**Severity**: 🟠 HIGH

**Description**: `downloadAndResize` doesn't retry on network failures. A temporary network glitch will fail the entire photo analysis.

**Suggested Fix**:
```typescript
import { RETRY_ATTEMPTS, RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS } from "../config/constants.js";

async function fetchWithRetry(url: string, retries = RETRY_ATTEMPTS): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }

      // Don't retry 4xx errors (invalid URL, etc.)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Retry 5xx errors
      if (attempt < retries) {
        const delay = Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, attempt), RETRY_MAX_DELAY_MS);
        logger.warn({ attempt, delay, status: response.status }, "Retrying image download");
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      const delay = Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, attempt), RETRY_MAX_DELAY_MS);
      logger.warn({ attempt, delay, error }, "Retrying image download after error");
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(`Failed to download image after ${retries} retries`);
}

export async function downloadAndResize(url: string): Promise<Buffer> {
  try {
    logger.debug("Downloading image", { url });

    const response = await fetchWithRetry(url);
    const buffer = Buffer.from(await response.arrayBuffer());

    // ... rest of processing
  } catch (error) {
    logger.error("Image processing failed", { error, url });
    throw error;
  }
}
```

---

### 8. **Typing Indicator Not Stopped on Error**

**File**: `src/utils/typing-indicator.ts`
**Lines**: 73-86
**Severity**: 🟠 HIGH

**Description**: If the callback throws an error, the typing indicator is stopped (due to finally block), but the error isn't logged in this utility. Caller needs to handle errors.

**Current Implementation**: Actually OK due to finally block, but should document this behavior.

**Suggested Enhancement**:
```typescript
/**
 * Execute callback while showing typing indicator
 *
 * @param api - Grammy API instance
 * @param chatId - Telegram chat ID
 * @param callback - Async callback to execute
 * @returns Result of callback
 * @throws Re-throws any error from callback after stopping typing indicator
 */
export async function withTyping<T>(
  api: Api,
  chatId: number,
  callback: () => Promise<T>
): Promise<T> {
  const indicator = new TypingIndicator(api, chatId);
  indicator.start();

  try {
    return await callback();
  } catch (error) {
    // Log the error before re-throwing
    logger.error({ error, chatId }, "Error during typing indicator callback");
    throw error;
  } finally {
    indicator.stop();
  }
}
```

---

### 9. **No Rate Limiting on Message Handlers**

**File**: `src/modules/router/index.ts`
**Lines**: 56-136
**Severity**: 🟠 HIGH

**Description**: Bot handlers don't implement rate limiting. Users can flood the bot with requests, exhausting queue capacity and credits.

**Impact**:
- Users can spam the bot
- Queue fills up with jobs from single user
- No protection against abuse

**Suggested Fix**: Implement rate limiting middleware using in-memory cache or Redis:

```typescript
// New file: src/modules/router/rate-limit.ts
import { BotContext } from "./middleware.js";
import { NextFunction } from "grammy";
import { getLogger } from "../../core/logger.js";

const logger = getLogger().child({ module: "rate-limit" });

// Simple in-memory rate limiter (use Redis for distributed systems)
const rateLimitMap = new Map<number, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute

export async function rateLimit(ctx: BotContext, next: NextFunction): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    return next();
  }

  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || userLimit.resetAt < now) {
    // Reset window
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    logger.warn({ userId }, "Rate limit exceeded");
    await ctx.reply("Слишком много запросов. Подождите минуту.");
    return; // Don't call next()
  }

  userLimit.count++;
  return next();
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, limit] of rateLimitMap.entries()) {
    if (limit.resetAt < now) {
      rateLimitMap.delete(userId);
    }
  }
}, 5 * 60 * 1000);
```

Then add to router:
```typescript
import { rateLimit } from "./rate-limit.js";

export function setupRouter(): void {
  const bot = getBot();

  bot.use(loadProfile);
  bot.use(loadUserState);
  bot.use(checkBanned);
  bot.use(rateLimit); // ADD THIS

  // ... rest of handlers
}
```

---

### 10. **Missing Health Check for Database and Queue**

**File**: `src/app.ts`
**Lines**: 30-38
**Severity**: 🟠 HIGH

**Description**: Health check endpoint only returns `200 OK` but doesn't verify database or queue connectivity.

**Suggested Fix**:
```typescript
fastify.get("/health", async (request, reply) => {
  const health = {
    status: "ok",
    version: process.env.npm_package_version || "0.1.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks: {
      database: "unknown",
      queue: "unknown",
      bot: "unknown",
    },
  };

  // Check database
  try {
    const pool = getPool();
    const result = await pool.query("SELECT 1 as ping");
    health.checks.database = result.rows[0]?.ping === 1 ? "ok" : "error";
  } catch (error) {
    health.checks.database = "error";
    health.status = "degraded";
  }

  // Check queue
  try {
    const boss = await getQueue();
    // pg-boss doesn't have a ping method, but we can check if it's started
    health.checks.queue = boss ? "ok" : "error";
  } catch (error) {
    health.checks.queue = "error";
    health.status = "degraded";
  }

  // Check bot
  try {
    const botInfo = await getBotInfo();
    health.checks.bot = botInfo.username ? "ok" : "error";
  } catch (error) {
    health.checks.bot = "error";
    health.status = "degraded";
  }

  // Set HTTP status based on health
  if (health.status === "error") {
    reply.status(503);
  } else if (health.status === "degraded") {
    reply.status(200); // Still return 200 for degraded to avoid restarts
  }

  return health;
});
```

---

### 11. **Logger Uses Wrong Signature in Some Places**

**File**: `src/core/logger.ts`
**Lines**: 67-75
**Severity**: 🟠 HIGH

**Description**: The convenience logger exports use a non-standard signature `(msg, obj?)` which is backwards from Pino's standard `(obj, msg)`. This can cause confusion and bugs.

**Current Code**:
```typescript
export const logger = {
  trace: (msg: string, obj?: object) => getLogger().trace(obj, msg), // Backwards!
  debug: (msg: string, obj?: object) => getLogger().debug(obj, msg),
  // ...
};
```

**Issue**: Pino's standard is `logger.info({ userId: 123 }, "User logged in")` but this export forces `logger.info("User logged in", { userId: 123 })`.

**Impact**:
- Inconsistent with Pino conventions
- Hard to spot bugs where arguments are swapped
- Code is less maintainable

**Suggested Fix**: Either:

**Option A**: Remove convenience exports and use Pino directly:
```typescript
// Remove the convenience exports
// Use getLogger() everywhere with standard Pino signature
const logger = getLogger();
logger.info({ userId: 123 }, "User logged in");
```

**Option B**: Keep convenience exports but document clearly:
```typescript
/**
 * Convenience logger with reversed signature (message-first)
 * NOTE: This differs from standard Pino which uses (obj, msg) signature
 *
 * @deprecated Consider using getLogger() with standard Pino signature
 */
export const logger = {
  trace: (msg: string, obj?: object) => getLogger().trace(obj, msg),
  // ... rest
};
```

**Recommendation**: Remove convenience exports and use Pino directly for consistency.

---

### 12. **Singleton Pattern Without Thread Safety**

**File**: Multiple files (database.ts, queue.ts, telegram.ts, logger.ts, etc.)
**Severity**: 🟠 HIGH

**Description**: All singleton factories check `if (!_instance)` without any locking mechanism. In Node.js this is usually fine due to single-threaded event loop, but could cause issues with worker threads or during rapid concurrent initialization.

**Example**:
```typescript
let _pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!_pool) { // Race condition possible
    _pool = new Pool({ /* ... */ });
  }
  return _pool;
}
```

**Impact**: Low in practice (Node.js is single-threaded for most operations), but could cause double-initialization in edge cases.

**Suggested Fix**: Use a Promise-based initialization guard:

```typescript
let _pool: pg.Pool | null = null;
let _poolPromise: Promise<pg.Pool> | null = null;

export function getPool(): pg.Pool {
  if (_pool) {
    return _pool;
  }

  if (!_poolPromise) {
    _poolPromise = initPool();
  }

  throw new Error("Pool not initialized. Call await initPool() first.");
}

async function initPool(): Promise<pg.Pool> {
  if (_pool) return _pool;

  const env = getEnv();
  _pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  _pool.on("error", (err) => {
    getLogger().child({ module: "database" }).error({ err }, "PostgreSQL pool error");
  });

  getLogger().child({ module: "database" }).info("PostgreSQL pool initialized");
  return _pool;
}
```

**Recommendation**: Document that factories should be called only after app initialization, or make them async.

---

### 13. **No Graceful Shutdown for Bot Webhook**

**File**: `src/app.ts`
**Lines**: 78-91
**Severity**: 🟠 HIGH

**Description**: Shutdown handler doesn't delete the webhook. If the app crashes and restarts, the webhook might still point to the old URL or the webhook might be in an inconsistent state.

**Suggested Fix**:
```typescript
async function shutdown(fastify?: Awaited<ReturnType<typeof Fastify>>) {
  logger.info("Shutting down...");

  // Delete webhook to prevent message loss
  try {
    await deleteWebhook();
    logger.info("Webhook deleted");
  } catch (error) {
    logger.warn({ error }, "Failed to delete webhook during shutdown");
  }

  if (fastify) {
    await fastify.close();
  }

  await stopQueue();
  await closeCheckpointer();
  await closeDatabase();

  logger.info("Shutdown complete");
  process.exit(0);
}
```

---

## Medium Priority Issues (FIX BEFORE PHASE 3+)

### 14. **No Validation in Config Service**

**File**: `src/modules/config/service.ts`
**Lines**: 17-44
**Severity**: 🟡 MEDIUM

**Description**: `getConfig` doesn't validate the type of `data.value` returned from database. If someone manually edits the database and stores wrong type, it will cause runtime errors.

**Suggested Fix**:
```typescript
import { z } from "zod";

export async function getConfig<T>(
  key: string,
  defaultValue: T,
  schema?: z.ZodSchema<T>
): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("system_config")
    .select("value")
    .eq("key", key)
    .single();

  if (error || !data) {
    logger.debug({ key, defaultValue }, "Config not found, using default");
    return defaultValue;
  }

  // Validate if schema provided
  if (schema) {
    const result = schema.safeParse(data.value);
    if (!result.success) {
      logger.warn({ key, value: data.value, errors: result.error.issues }, "Invalid config value, using default");
      return defaultValue;
    }

    cache.set(key, {
      value: result.data,
      expiresAt: Date.now() + CONFIG_CACHE_TTL_SECONDS * 1000,
    });

    return result.data;
  }

  cache.set(key, {
    value: data.value,
    expiresAt: Date.now() + CONFIG_CACHE_TTL_SECONDS * 1000,
  });

  return data.value as T;
}

// Usage:
export async function isMaintenanceMode(): Promise<boolean> {
  return getConfig("maintenance_mode", false, z.boolean());
}
```

---

### 15. **Queue Worker Error Handling Too Aggressive**

**File**: `src/core/queue.ts`
**Lines**: 112-141
**Severity**: 🟡 MEDIUM

**Description**: Worker error handler re-throws errors, which causes pg-boss to retry. For some errors (like invalid data), retrying won't help and will waste resources.

**Suggested Fix**:
```typescript
export async function registerWorker<T extends object = object>(
  queueName: string,
  handler: (job: Job<T>) => Promise<void>,
  options?: WorkOptions
): Promise<string> {
  const boss = await getQueue();
  const logger = getLogger().child({ module: "queue", queue: queueName });

  const workerId = await boss.work<T>(
    queueName,
    options || {},
    async (jobs) => {
      const jobArray = Array.isArray(jobs) ? jobs : [jobs];
      for (const job of jobArray) {
        logger.info({ jobId: job.id }, "Processing job");
        try {
          await handler(job);
          logger.info({ jobId: job.id }, "Job completed");
        } catch (error) {
          logger.error({ jobId: job.id, error }, "Job failed");

          // Check if error is retryable
          if (error instanceof Error) {
            // Don't retry validation errors, only network/temporary errors
            if (error.message.includes("validation") ||
                error.message.includes("invalid") ||
                error.name === "ZodError") {
              logger.warn({ jobId: job.id }, "Non-retryable error, marking as failed");
              // Don't throw - pg-boss will mark as complete (failed)
              return;
            }
          }

          throw error; // Retry for other errors
        }
      }
    }
  );

  logger.info({ workerId }, "Worker registered");
  return workerId;
}
```

---

### 16. **Missing Null Checks in Detector**

**File**: `src/modules/router/detector.ts`
**Lines**: 13-39
**Severity**: 🟡 MEDIUM

**Description**: `detectMessageType` accesses `message.photo` without checking if `message.photo` is defined. While unlikely, this could throw if Telegram API changes.

**Suggested Fix**:
```typescript
export function detectMessageType(ctx: Context): MessageType {
  const message = ctx.message;

  if (!message) {
    if (ctx.callbackQuery) {
      return "callback";
    }
    return "unknown";
  }

  // Check for photo (with proper null checking)
  if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
    return "photo";
  }

  // Check for command
  if (message.text && message.text.startsWith("/")) {
    return "command";
  }

  // Check for text
  if (message.text && message.text.trim().length > 0) {
    return "text";
  }

  return "unknown";
}
```

---

### 17. **HTML Formatter Doesn't Handle All Special Cases**

**File**: `src/utils/html-formatter.ts`
**Lines**: 14-19
**Severity**: 🟡 MEDIUM

**Description**: `escapeHtml` only escapes `&`, `<`, `>` but misses quotes which can break HTML attributes in links.

**Suggested Fix**:
```typescript
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

---

### 18. **Message Splitter Could Break HTML Tags**

**File**: `src/utils/message-splitter.ts`
**Lines**: 18-43
**Severity**: 🟡 MEDIUM

**Description**: `splitMessage` doesn't account for HTML tags. If a message contains `<b>long text...</b>`, splitting in the middle will create unclosed tags.

**Impact**: Telegram will reject malformed HTML, causing message send failures.

**Suggested Fix**: This is complex - either:
1. Strip HTML before splitting and re-apply formatting
2. Use a proper HTML parser to track tag stack
3. Document that HTML messages should not be split (caller responsibility)

**Recommendation**: Add warning in JSDoc:
```typescript
/**
 * Split long message into chunks that respect Telegram's 4096 limit
 *
 * WARNING: This function is NOT HTML-aware. If your message contains HTML tags,
 * splitting may break tag boundaries. Consider:
 * 1. Keeping messages under TELEGRAM_SAFE_LIMIT when using HTML
 * 2. Stripping HTML before splitting
 * 3. Using plain text messages for long content
 *
 * @param text - Plain text to split (no HTML)
 * @param maxLength - Maximum length per chunk (default: TELEGRAM_SAFE_LIMIT)
 * @returns Array of message chunks
 */
export function splitMessage(text: string, maxLength = TELEGRAM_SAFE_LIMIT): string[] {
  // ... existing implementation
}
```

---

### 19. **No Database Connection Pooling Configuration**

**File**: `src/core/database.ts`
**Lines**: 39-57
**Severity**: 🟡 MEDIUM

**Description**: Pool settings are hardcoded. For production, these should be configurable via environment variables.

**Suggested Fix**:
```typescript
// In src/config/env.ts
const EnvSchema = z.object({
  // ... existing fields

  // Database Pool Settings
  DB_POOL_MAX: z.coerce.number().min(1).max(100).default(20),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().min(1000).default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().min(100).default(2000),
});

// In src/core/database.ts
export function getPool(): pg.Pool {
  if (!_pool) {
    const env = getEnv();
    _pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DB_POOL_MAX,
      idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT_MS,
    });

    _pool.on("error", (err) => {
      getLogger().child({ module: "database" }).error({ err }, "PostgreSQL pool error");
    });

    getLogger().child({ module: "database" }).info("PostgreSQL pool initialized");
  }
  return _pool;
}
```

---

### 20. **Typing Indicator Uses trace Level for Errors**

**File**: `src/utils/typing-indicator.ts`
**Lines**: 57-62
**Severity**: 🟡 MEDIUM

**Description**: Failed typing actions are logged at `trace` level and errors are ignored. This makes debugging difficult if typing indicators are consistently failing.

**Suggested Fix**:
```typescript
private sendTyping(): void {
  this.api.sendChatAction(this.chatId, "typing").catch((error) => {
    // Log at debug level with error details
    logger.debug({ error, chatId: this.chatId }, "Failed to send typing action");

    // If it's a permissions error, log at warn level
    if (error.message && error.message.includes("chat not found")) {
      logger.warn({ chatId: this.chatId }, "Chat not found for typing indicator");
    }
  });
}
```

---

### 21. **Constants Use British vs American Spelling Inconsistently**

**File**: `src/config/constants.ts`
**Lines**: Multiple
**Severity**: 🟡 MEDIUM

**Description**: Minor naming inconsistency - some constants use `ANALYSE` (British) in comments while code uses `ANALYZE` (American). Not a bug but reduces maintainability.

**Suggested Fix**: Standardize on American English spelling throughout:
- `analyze` (not `analyse`)
- `color` (not `colour`)

---

### 22. **Image Processor Doesn't Validate Input URL**

**File**: `src/utils/image-processor.ts`
**Lines**: 18-24
**Severity**: 🟡 MEDIUM

**Description**: `downloadAndResize` accepts any URL string without validation. This could be exploited for SSRF attacks or cause errors with invalid URLs.

**Suggested Fix**:
```typescript
export async function downloadAndResize(url: string): Promise<Buffer> {
  try {
    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL: ${url}`);
    }

    // Only allow HTTPS from Telegram API
    if (parsedUrl.protocol !== "https:") {
      throw new Error(`Only HTTPS URLs allowed, got: ${parsedUrl.protocol}`);
    }

    // Only allow Telegram domains
    if (!parsedUrl.hostname.endsWith(".telegram.org")) {
      throw new Error(`Only Telegram URLs allowed, got: ${parsedUrl.hostname}`);
    }

    logger.debug("Downloading image", { url });

    const response = await fetch(url);
    // ... rest of implementation
  } catch (error) {
    logger.error("Image processing failed", { error, url });
    throw error;
  }
}
```

---

### 23. **Environment Variables Expose Supabase URL**

**File**: `.env.example`
**Lines**: 18
**Severity**: 🟡 MEDIUM

**Description**: The `.env.example` file contains the actual Supabase project URL (`johspxgvkbrysxhilmbg.supabase.co`). While the URL itself isn't a secret, it's better practice to use placeholders.

**Suggested Fix**:
```bash
# Before:
SUPABASE_URL=https://johspxgvkbrysxhilmbg.supabase.co

# After:
SUPABASE_URL=https://your-project-ref.supabase.co
```

---

### 24. **Missing JSDoc for Public APIs**

**File**: Multiple files
**Severity**: 🟡 MEDIUM

**Description**: Many public functions lack JSDoc comments. While some have good inline comments, JSDoc is important for TypeScript IntelliSense and auto-generated documentation.

**Files Needing JSDoc**:
- `src/modules/credits/service.ts` - All exported functions
- `src/modules/config/service.ts` - `setConfig`, `clearConfigCache`
- `src/core/queue.ts` - `sendJob`, `registerWorker`
- `src/core/telegram.ts` - All exported functions

**Example**:
```typescript
/**
 * Check if user has enough credits for an operation
 *
 * @param telegramUserId - Telegram user ID
 * @param amount - Number of credits required (default: 1)
 * @returns Promise resolving to true if user has sufficient credits
 *
 * @example
 * ```typescript
 * const canProceed = await hasCredits(123456, 2);
 * if (!canProceed) {
 *   await ctx.reply("Insufficient credits");
 * }
 * ```
 */
export async function hasCredits(telegramUserId: number, amount = 1): Promise<boolean> {
  // ... implementation
}
```

---

### 25. **No Telemetry or Metrics Collection**

**File**: N/A
**Severity**: 🟡 MEDIUM

**Description**: The application has no metrics collection (request count, job queue depth, error rates, response times). This makes it hard to monitor production health.

**Suggested Fix**: Add Prometheus metrics or similar:

```typescript
// New file: src/core/metrics.ts
import { register, Counter, Histogram, Gauge } from "prom-client";

// Request counters
export const telegramMessagesReceived = new Counter({
  name: "telegram_messages_received_total",
  help: "Total number of messages received from Telegram",
  labelNames: ["type"], // photo, text, command, callback
});

export const jobsQueued = new Counter({
  name: "jobs_queued_total",
  help: "Total number of jobs queued",
  labelNames: ["queue"],
});

export const jobsFailed = new Counter({
  name: "jobs_failed_total",
  help: "Total number of jobs failed",
  labelNames: ["queue"],
});

// Gauges
export const activeConnections = new Gauge({
  name: "database_active_connections",
  help: "Number of active database connections",
});

// Histograms
export const jobDuration = new Histogram({
  name: "job_duration_seconds",
  help: "Job processing duration",
  labelNames: ["queue"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

// Metrics endpoint
export function setupMetricsEndpoint(fastify: FastifyInstance) {
  fastify.get("/metrics", async () => {
    return register.metrics();
  });
}
```

Then use in handlers:
```typescript
bot.on("message:photo", async (ctx) => {
  telegramMessagesReceived.inc({ type: "photo" });
  // ... rest of handler
});
```

---

## Low Priority Issues (NICE TO HAVE)

### 26. **TypeScript Paths Not Optimized for Production**

**File**: `tsconfig.json`
**Lines**: 32-41
**Severity**: 🟢 LOW

**Description**: Path aliases like `@/config/*` are defined but not used consistently in imports. Some files use relative paths `../../config/env.js` while others could use `@/config/env.js`.

**Suggested Fix**: Either:
1. Use path aliases consistently throughout
2. Remove path aliases if not using them

**Note**: Requires `tsconfig-paths` or build tool configuration to work at runtime.

---

### 27. **No Error Codes for Structured Error Handling**

**File**: Multiple
**Severity**: 🟢 LOW

**Description**: Errors are thrown as plain strings or Error objects. For better error handling, consider using error codes.

**Suggested Enhancement**:
```typescript
// New file: src/core/errors.ts
export enum ErrorCode {
  INSUFFICIENT_CREDITS = "INSUFFICIENT_CREDITS",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INVALID_IMAGE = "INVALID_IMAGE",
  DATABASE_ERROR = "DATABASE_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Usage:
if (!(await hasCredits(userId, 1))) {
  throw new AppError(
    ErrorCode.INSUFFICIENT_CREDITS,
    "User has insufficient credits",
    { userId, required: 1 }
  );
}
```

---

### 28. **No Structured Logging Context**

**File**: Multiple
**Severity**: 🟢 LOW

**Description**: Logs don't consistently include structured context like `requestId`, `telegramUserId`, `jobId`. This makes log aggregation and debugging harder.

**Suggested Enhancement**: Use child loggers consistently:

```typescript
// In middleware
export async function loadProfile(ctx: BotContext, next: NextFunction): Promise<void> {
  const telegramUserId = ctx.from?.id;

  // Create child logger for this request
  const requestLogger = logger.child({
    requestId: crypto.randomUUID(),
    telegramUserId
  });

  ctx.logger = requestLogger; // Attach to context

  requestLogger.debug("Loading profile");
  // ... rest of middleware
}
```

---

### 29. **Constants Could Be Enums for Type Safety**

**File**: `src/config/constants.ts`
**Severity**: 🟢 LOW

**Description**: Queue names and model names are exported as const strings. Using enums would provide better type safety and autocomplete.

**Suggested Enhancement**:
```typescript
// Instead of:
export const QUEUE_ANALYZE_PHOTO = "analyze-photo";
export const QUEUE_CHAT_REPLY = "chat-reply";

// Use enum:
export enum QueueName {
  ANALYZE_PHOTO = "analyze-photo",
  CHAT_REPLY = "chat-reply",
  SEND_MESSAGE = "send-message",
}

// Usage:
await sendJob(QueueName.ANALYZE_PHOTO, data);
```

---

### 30. **Image Format Hardcoded**

**File**: `src/config/constants.ts`, `src/utils/image-processor.ts`
**Severity**: 🟢 LOW

**Description**: Image format is hardcoded as `webp`. For flexibility, this could be an environment variable or config option.

**Suggested Enhancement**: Add to environment config:
```typescript
IMAGE_FORMAT: z.enum(["webp", "jpeg", "png"]).default("webp"),
IMAGE_QUALITY: z.coerce.number().min(1).max(100).default(85),
```

---

### 31. **No Version Endpoint**

**File**: `src/app.ts`
**Severity**: 🟢 LOW

**Description**: Health check includes version, but a dedicated `/version` endpoint would be useful for deployment tracking.

**Suggested Enhancement**:
```typescript
fastify.get("/version", async () => {
  return {
    version: process.env.npm_package_version || "0.1.0",
    nodeVersion: process.version,
    gitCommit: process.env.GIT_COMMIT || "unknown",
    buildDate: process.env.BUILD_DATE || "unknown",
  };
});
```

---

### 32. **Unused Imports in Index Files**

**File**: `src/types/index.ts`, `src/core/langchain/index.ts`
**Severity**: 🟢 LOW

**Description**: Barrel export files re-export types/functions but some may be unused. Run `pnpm lint` to check for unused exports.

**Suggested Fix**: Enable `noUnusedLocals` in tsconfig (already enabled) and fix any warnings.

---

## Best Practices & Recommendations

### ✅ What's Done Well

1. **Excellent TypeScript Configuration**: Strict mode with all null checks enabled
2. **Good Separation of Concerns**: Clear module structure (core, modules, utils, types)
3. **Structured Logging**: Using Pino with JSON output for production
4. **Environment Validation**: Zod schema validation for all env vars
5. **Singleton Pattern**: Consistent use of singletons for resources
6. **Type Definitions**: Comprehensive TypeScript types for all entities
7. **Graceful Shutdown**: Proper cleanup handlers for SIGTERM/SIGINT

### 🔄 Architecture Improvements

1. **Add Dependency Injection**: Instead of singletons everywhere, consider DI container for testing
2. **Separate API and Worker**: Run as two separate processes in production
3. **Add Request Context**: Use AsyncLocalStorage for request-scoped logging
4. **Implement Circuit Breaker**: For external API calls (OpenRouter, Telegram)
5. **Add Monitoring**: Prometheus metrics, health checks, distributed tracing

### 🧪 Testing Recommendations

1. **Unit Tests**: Add tests for utility functions (message-splitter, html-formatter, detector)
2. **Integration Tests**: Test database operations and queue workers
3. **E2E Tests**: Test bot handlers with mocked Telegram updates
4. **Test Coverage**: Aim for >80% coverage on core business logic

### 📦 Deployment Checklist

- [ ] Fix all 5 critical issues
- [ ] Fix high-priority issues (especially router initialization)
- [ ] Add rate limiting
- [ ] Implement proper error monitoring (Sentry, etc.)
- [ ] Set up log aggregation (Loki, CloudWatch, etc.)
- [ ] Configure database backups
- [ ] Set up CI/CD with type-check and build validation
- [ ] Create production environment variables
- [ ] Test webhook in staging environment
- [ ] Document deployment process

### 🔐 Security Hardening

1. **Secrets Management**: Use AWS Secrets Manager or Vault instead of .env files
2. **Network Security**: Run behind firewall, only expose webhooks
3. **Input Validation**: Add Zod schemas for all job payloads
4. **SQL Injection**: Using Supabase client (safe), but verify raw queries if added
5. **Rate Limiting**: Implement at both application and infrastructure level
6. **Audit Logging**: Log all credit transactions and admin actions

### 📊 Performance Optimization

1. **Database Indexing**: Ensure indexes on `telegram_user_id` in all tables
2. **Connection Pooling**: Already implemented, but monitor pool metrics
3. **Caching**: Already has config cache, consider adding user profile cache
4. **Queue Concurrency**: Tune pg-boss worker concurrency for optimal throughput
5. **Image Optimization**: Already using Sharp with good settings

---

## Summary Statistics

| Category | Count | % of Total |
|----------|-------|------------|
| Critical Issues | 5 | 15.6% |
| High Priority | 8 | 25.0% |
| Medium Priority | 12 | 37.5% |
| Low Priority | 7 | 21.9% |
| **Total Issues** | **32** | **100%** |

### Issues by Category

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Bugs | 3 | 2 | 2 | 0 |
| Security | 1 | 1 | 2 | 0 |
| Type Safety | 0 | 1 | 1 | 1 |
| Error Handling | 1 | 2 | 1 | 0 |
| Performance | 0 | 1 | 1 | 0 |
| Code Quality | 0 | 1 | 5 | 6 |

---

## Next Steps

### Immediate Actions (Before Any Testing)

1. **Fix Critical #5**: Initialize router in `app.ts` - **Bot is non-functional without this**
2. **Fix Critical #1**: Implement atomic credit refund using database RPC
3. **Fix Critical #2**: Add try-catch to middleware functions
4. **Fix Critical #3**: Add file size and credit validation to photo handler
5. **Fix Critical #4**: Properly close PostgresSaver connections

### Before Phase 3 Development

1. Address all high-priority issues (especially rate limiting)
2. Add comprehensive error handling throughout
3. Implement health checks for all dependencies
4. Set up monitoring and alerting

### Before Production Deployment

1. Fix all critical and high-priority issues
2. Address medium-priority issues (especially security-related)
3. Add tests for core business logic
4. Set up proper secrets management
5. Configure production logging and monitoring
6. Perform security audit
7. Load test the system with realistic traffic

---

## Conclusion

The symancy-backend codebase demonstrates **strong engineering practices** with excellent TypeScript usage, clean architecture, and good separation of concerns. However, several **critical issues must be addressed** before the bot can function in production, most notably:

1. Router not being initialized (bot won't respond to messages)
2. Race condition in credit refunds (data integrity)
3. Missing error handling in middleware (stability)
4. Missing input validation (security)
5. Resource leaks in checkpointer (memory)

Once these critical issues are resolved, the codebase will be in excellent shape for Phase 3+ development. The architecture is solid and well-positioned for scaling to production workloads.

**Recommendation**: **DO NOT DEPLOY** until at minimum the 5 critical issues are resolved. The bot is currently non-functional due to missing router initialization.

---

**Report Generated**: 2025-12-25
**Review Completed**: Yes
**Code Changes Made**: None (analysis only)
