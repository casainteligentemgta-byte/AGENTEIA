import fs from "fs";
import path from "path";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import * as Sentry from "@sentry/node";

const SENSITIVE_KEYS = /password|token|secret|authorization|cookie|api[_-]?key/i;

function redactMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.test(key)) {
      out[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = redactMeta(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Logger estructurado Winston + rotación diaria + Sentry opcional.
 */
export class Logger {
  private readonly logger: winston.Logger;
  private sentryEnabled = false;

  constructor() {
    const logsDir = path.join(process.cwd(), "logs");
    let canWriteLogs = true;
    try {
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      fs.accessSync(logsDir, fs.constants.W_OK);
    } catch {
      canWriteLogs = false;
    }

    const level = process.env.LOG_LEVEL ?? "info";
    const isDev = process.env.NODE_ENV !== "production";

    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.printf(({ level: lvl, message, timestamp, ...meta }) => {
        const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
        return `${timestamp} ${lvl}: ${message}${rest}`;
      })
    );

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: isDev ? consoleFormat : winston.format.json(),
      }),
    ];

    if (canWriteLogs) {
      transports.push(
        new winston.transports.File({
          filename: path.join(logsDir, "error.log"),
          level: "error",
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: path.join(logsDir, "combined.log"),
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
        }),
        new DailyRotateFile({
          filename: path.join(logsDir, "app-%DATE%.log"),
          datePattern: "YYYY-MM-DD",
          maxSize: "10m",
          maxFiles: "14d",
        })
      );
    }

    this.logger = winston.createLogger({
      level,
      defaultMeta: { service: "smartimport" },
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports,
    });

    const dsn = process.env.SENTRY_DSN?.trim();
    if (dsn) {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV ?? "development",
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      });
      this.sentryEnabled = true;
      this.logger.info("Sentry habilitado");
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, redactMeta(meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, redactMeta(meta));
  }

  error(
    message: string,
    error?: Error,
    meta?: Record<string, unknown>
  ): void {
    const payload = redactMeta({
      error: error?.message,
      stack: error?.stack,
      ...meta,
    });
    this.logger.error(message, payload);
    if (this.sentryEnabled && error) {
      Sentry.captureException(error, { extra: payload });
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, redactMeta(meta));
  }
}

export const logger = new Logger();
