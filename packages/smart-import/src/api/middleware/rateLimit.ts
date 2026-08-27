import type { NextFunction, Request, Response } from "express";
import rateLimit, {
  type Options,
  type RateLimitRequestHandler,
} from "express-rate-limit";
import Redis from "ioredis";
import { RedisStore } from "rate-limit-redis";
import type { AuthenticatedRequest } from "./auth";

type LimiterRequest = Request & {
  user?: AuthenticatedRequest["user"];
};

let redisClient: Redis | null = null;
let redisInitAttempted = false;

/**
 * Cliente Redis desde REDIS_HOST/REDIS_PORT (prioridad) o REDIS_URL.
 * Sin configuración, express-rate-limit usa memoria local.
 */
function getRedisClient(): Redis | null {
  if (redisInitAttempted) return redisClient;
  redisInitAttempted = true;

  const host = process.env.REDIS_HOST?.trim();
  const portRaw = process.env.REDIS_PORT?.trim();
  const url = process.env.REDIS_URL?.trim();

  try {
    if (host) {
      const port = Number(portRaw || "6379");
      redisClient = new Redis({
        host,
        port: Number.isFinite(port) ? port : 6379,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: true,
        lazyConnect: false,
      });
    } else if (url) {
      redisClient = new Redis(url, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: true,
        lazyConnect: false,
      });
    } else {
      console.warn(
        "[smart-import.rateLimit] REDIS_HOST/REDIS_PORT (o REDIS_URL) no configurados; usando memoria local"
      );
      return null;
    }

    redisClient.on("error", (err) => {
      console.warn("[smart-import.rateLimit] Redis error:", err.message);
    });
    return redisClient;
  } catch (err) {
    console.warn(
      "[smart-import.rateLimit] No se pudo crear cliente Redis:",
      err instanceof Error ? err.message : err
    );
    redisClient = null;
    return null;
  }
}

function buildStore(prefix: string): Options["store"] | undefined {
  const client = getRedisClient();
  if (!client) return undefined;

  try {
    return new RedisStore({
      prefix: `smart-import:${prefix}:`,
      // @ts-expect-error ioredis call compatible con rate-limit-redis
      sendCommand: (...args: string[]) => client.call(...args),
    });
  } catch (err) {
    console.warn(
      "[smart-import.rateLimit] RedisStore no disponible; memoria local:",
      err instanceof Error ? err.message : err
    );
    return undefined;
  }
}

export function buildRateLimitKey(req: LimiterRequest): string {
  if (req.user?.id) return `user:${req.user.id}`;
  return `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
}

export function shouldSkipImportLimit(req: LimiterRequest): boolean {
  return req.user?.role === "admin";
}

function keyGenerator(req: LimiterRequest): string {
  return buildRateLimitKey(req);
}

function skipAdmin(req: LimiterRequest): boolean {
  return shouldSkipImportLimit(req);
}

/**
 * Máximo 10 importaciones por usuario (o IP) cada 15 minutos.
 * Los admins no tienen límite.
 */
export const importLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore("import"),
  keyGenerator,
  skip: skipAdmin,
  handler: (req: LimiterRequest, res: Response) => {
    console.warn(
      "[smart-import.rateLimit] Límite de importaciones alcanzado",
      keyGenerator(req)
    );
    res.status(429).json({
      success: false,
      error:
        "Has alcanzado el límite de 10 importaciones cada 15 minutos. Espera un momento e inténtalo de nuevo.",
    });
  },
});

/**
 * Límite general de API: 100 requests por minuto por usuario/IP.
 */
export const apiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore("api"),
  keyGenerator,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: "Demasiadas solicitudes. Intenta de nuevo en un minuto.",
    });
  },
});

/** Middleware no-op útil en tests para saltar limiters reales. */
export function passthroughLimiter(
  _req: Request,
  _res: Response,
  next: NextFunction
): void {
  next();
}
