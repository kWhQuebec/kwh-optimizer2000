type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) in LEVELS
    ? (process.env.LOG_LEVEL as LogLevel)
    : "info";

interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

function createLogger(context: string): Logger {
  const minLevel = LEVELS[LOG_LEVEL];

  function log(level: LogLevel, message: string, args: unknown[]): void {
    if (LEVELS[level] < minLevel) return;
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`;
    const fn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;
    if (args.length > 0) {
      fn(prefix, message, ...args);
    } else {
      fn(prefix, message);
    }
  }

  return {
    debug: (message: string, ...args: unknown[]) =>
      log("debug", message, args),
    info: (message: string, ...args: unknown[]) => log("info", message, args),
    warn: (message: string, ...args: unknown[]) => log("warn", message, args),
    error: (message: string, ...args: unknown[]) =>
      log("error", message, args),
  };
}

export { createLogger, type Logger };
