/**
 * Pino logger with JSON format
 * Per TZ: structured logging with pino
 */
import pino from "pino";
import { getEnv, isDevelopment } from "../config/env.js";
import { captureException } from "./sentry.js";

/**
 * Create the main logger instance
 * - Production: JSON format for log aggregation
 * - Development: Pretty printing with pino-pretty
 */
function createLogger(): pino.Logger {
  const env = getEnv();

  const baseOptions: pino.LoggerOptions = {
    level: env.LOG_LEVEL,
    base: {
      pid: process.pid,
      env: env.NODE_ENV,
    },
  };

  // In development, use pino-pretty transport
  if (isDevelopment()) {
    return pino({
      ...baseOptions,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    });
  }

  // In production, use default JSON format
  return pino(baseOptions);
}

/**
 * Main logger instance
 * Lazy initialization to allow env validation first
 */
let _logger: pino.Logger | null = null;

export function getLogger(): pino.Logger {
  if (!_logger) {
    _logger = createLogger();
  }
  return _logger;
}

/**
 * Create a child logger with additional context
 * @param bindings - Additional context to include in all log entries
 */
export function createChildLogger(bindings: pino.Bindings): pino.Logger {
  return getLogger().child(bindings);
}

/**
 * Convenience exports for common log levels
 */
export const logger = {
  trace: (msg: string, obj?: object) => getLogger().trace(obj, msg),
  debug: (msg: string, obj?: object) => getLogger().debug(obj, msg),
  info: (msg: string, obj?: object) => getLogger().info(obj, msg),
  warn: (msg: string, obj?: object) => getLogger().warn(obj, msg),
  error: (msg: string, obj?: object) => getLogger().error(obj, msg),
  fatal: (msg: string, obj?: object) => getLogger().fatal(obj, msg),
  child: createChildLogger,
};

/**
 * Log uncaught exceptions and unhandled rejections
 */
export function setupProcessErrorHandlers(): void {
  const log = getLogger();

  process.on("uncaughtException", (error) => {
    captureException(error, { source: "uncaughtException" });
    log.fatal({ err: error }, "Uncaught exception");
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    if (reason instanceof Error) {
      captureException(reason, { source: "unhandledRejection" });
    }
    log.error({ reason }, "Unhandled rejection");
  });
}
