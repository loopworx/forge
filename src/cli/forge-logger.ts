import winston from "winston";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Logger interface — the minimal surface every forge logger must implement.
 * Used for dependency injection so modules like `AgentSessionManager` can
 * log without hard-coupling to winston. Tests inject `NOOP_LOGGER` or a
 * mock; production code injects a winston-backed logger from
 * `createForgeLogger()`.
 */
export interface Logger {
  info(msg: string, ...meta: any[]): void;
  error(msg: string, ...meta: any[]): void;
  debug(msg: string, ...meta: any[]): void;
  warn(msg: string, ...meta: any[]): void;
}

/**
 * No-op logger — all methods are silent. Used as the default when a module
 * doesn't care about logging (e.g. tests, library contexts). Safe to call
 * from any code path.
 */
export const NOOP_LOGGER: Logger = {
  info: () => {},
  error: () => {},
  debug: () => {},
  warn: () => {},
};

export function createForgeLogger(logPath: string): winston.Logger {
  mkdirSync(dirname(logPath), { recursive: true });
  return winston.createLogger({
    level: "debug",
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}] ${message}`),
    ),
    transports: [new winston.transports.File({ filename: logPath })],
  });
}
