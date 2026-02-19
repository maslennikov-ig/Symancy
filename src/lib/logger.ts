const formatArgs = (prefix: string, message: string, data?: unknown): unknown[] =>
  data !== undefined ? [`${prefix} ${message}`, data] : [`${prefix} ${message}`];

export function createLogger(module: string) {
  const prefix = `[${module}]`;
  return {
    error: (message: string, data?: unknown) => {
      console.error(...formatArgs(prefix, message, data));
    },
    warn: (message: string, data?: unknown) => {
      console.warn(...formatArgs(prefix, message, data));
    },
    info: (message: string, data?: unknown) => {
      if (import.meta.env.DEV) {
        console.info(...formatArgs(prefix, message, data));
      }
    },
    debug: (message: string, data?: unknown) => {
      if (import.meta.env.DEV) {
        console.debug(...formatArgs(prefix, message, data));
      }
    },
  };
}
