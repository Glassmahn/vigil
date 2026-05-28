const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

function formatLog(level: LogLevel, module: string, message: string, meta?: any): string {
  const ts = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${ts}] [${level.toUpperCase()}] [${module}] ${message}${metaStr}`;
}

export const logger = {
  debug: (module: string, message: string, meta?: any) => console.debug(formatLog("debug", module, message, meta)),
  info: (module: string, message: string, meta?: any) => console.info(formatLog("info", module, message, meta)),
  warn: (module: string, message: string, meta?: any) => console.warn(formatLog("warn", module, message, meta)),
  error: (module: string, message: string, meta?: any) => console.error(formatLog("error", module, message, meta)),
};
