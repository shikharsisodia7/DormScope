/**
 * Durable cross-instance rate limiter.
 *
 * Strategy:
 *  - If REDIS_URL is set → use ioredis INCR / EXPIRE (atomic, fast).
 *  - Otherwise           → use Postgres RateLimitBucket table with upsert.
 *
 * Returns true (allow) / false (deny).
 * Falls back to allow=true on any unexpected error so a storage outage never
 * blocks legitimate traffic.
 */

import { createHash } from "crypto";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 48);
}

// ─── Redis path ──────────────────────────────────────────────────────────────

let redisClient: import("ioredis").Redis | null = null;
let redisInitialized = false;

async function getRedis(): Promise<import("ioredis").Redis | null> {
  if (redisInitialized) return redisClient;
  redisInitialized = true;
  if (!process.env.REDIS_URL) return null;
  try {
    const { default: Redis } = await import("ioredis");
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    });
    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.error("[rate-limit] Redis init failed:", err);
    redisClient = null;
    return null;
  }
}

async function redisRateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return false; // caller falls through to Postgres

  try {
    const k = `rl:${hashKey(key)}`;
    const count = await redis.incr(k);
    if (count === 1) {
      await redis.expire(k, windowSec);
    }
    return count <= limit;
  } catch (err) {
    console.error("[rate-limit] Redis error:", err);
    return true; // fail open
  }
}

// ─── Postgres path ───────────────────────────────────────────────────────────

async function postgresRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const keyHash = hashKey(key);
    const now = new Date();
    const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);

    const bucket = await prisma.rateLimitBucket.upsert({
      where: { keyHash },
      create: { keyHash, windowStart, count: 1 },
      update: {
        count: {
          // If the window has rolled over, reset to 1; otherwise increment.
          // We do this in two steps: first upsert with conditional reset, then check.
          increment: 1,
        },
      },
    });

    // If window has rolled over, reset count to 1 and allow.
    if (bucket.windowStart < windowStart) {
      await prisma.rateLimitBucket.update({
        where: { keyHash },
        data: { windowStart, count: 1 },
      });
      return true;
    }

    return bucket.count <= limit;
  } catch (err) {
    console.error("[rate-limit] Postgres error:", err);
    return true; // fail open
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Durable rate limit check.
 *
 * @param key       Unique bucket identifier (e.g. "review:ip:1.2.3.4")
 * @param limit     Max allowed requests per window
 * @param windowMs  Window size in milliseconds
 * @returns true = allowed, false = denied
 */
export async function durableRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  if (process.env.REDIS_URL) {
    // Try Redis first; returns null-ish sentinel on unavailability
    const redis = await getRedis();
    if (redis) {
      return redisRateLimit(key, limit, Math.ceil(windowMs / 1000));
    }
  }
  return postgresRateLimit(key, limit, windowMs);
}
