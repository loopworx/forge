import winston from "winston";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

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
