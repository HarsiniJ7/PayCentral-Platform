/**
 * Minimal structured JSON logger.
 *
 * For a PoC this size, pulling in Winston/Pino added more dependency surface
 * than value over a ~40 line wrapper that already gives us: log levels,
 * structured JSON (so it's queryable if shipped to Azure Monitor / ELK / Loki),
 * and a single choke point to redact sensitive fields. Documented as a
 * "swap for Pino + a transport in prod" in the README, same spirit as the
 * hand-rolled rate limiter in index.ts.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: Level = (process.env.LOG_LEVEL as Level) || "info";

// Field names we never want to accidentally log (defense in depth - callers
// shouldn't pass these, but this stops a copy/paste mistake reaching stdout).
const REDACT_KEYS = new Set(["password", "passwordHash", "token", "authorization", "secret"]);

function redact(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : v;
  }
  return out;
}

function write(level: Level, message: string, meta: Record<string, unknown> = {}) {
  if (LEVELS[level] < LEVELS[MIN_LEVEL]) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: "paycentral-api",
    ...redact(meta),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};

/** Express middleware: structured request log with latency + correlation id. */
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export interface RequestWithId extends Request {
  requestId?: string;
}

export function requestLogger(req: RequestWithId, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  req.requestId = req.headers["x-request-id"]?.toString() || randomUUID();
  res.setHeader("x-request-id", req.requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.info("request_completed", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  });

  next();
}
