import { isRedisConfigured, getRedisConnection } from "../jobs/connection";

export type RateLimitHit = {
  allowed: boolean;
  count: number;
};

export type RateLimitBackend = {
  hit(key: string, limit: number, windowMs: number, now: number): Promise<RateLimitHit>;
  /** Returns true when the cooldown slot was acquired. */
  acquireCooldown(key: string, windowMs: number, now: number): Promise<boolean>;
};

type MemoryBucket = {
  count: number;
  resetAt: number;
};

type MemoryCooldown = {
  until: number;
};

export function createMemoryRateLimitBackend(): RateLimitBackend {
  const buckets = new Map<string, MemoryBucket>();
  const cooldowns = new Map<string, MemoryCooldown>();

  return {
    async hit(key, limit, windowMs, now) {
      const cur = buckets.get(key);
      if (!cur || cur.resetAt <= now) {
        const next = { count: 1, resetAt: now + windowMs };
        buckets.set(key, next);
        return { allowed: next.count <= limit, count: next.count };
      }
      cur.count += 1;
      return { allowed: cur.count <= limit, count: cur.count };
    },
    async acquireCooldown(key, windowMs, now) {
      const cur = cooldowns.get(key);
      if (cur && cur.until > now) return false;
      cooldowns.set(key, { until: now + windowMs });
      return true;
    },
  };
}

function createRedisRateLimitBackend(): RateLimitBackend {
  return {
    async hit(key, limit, windowMs, now) {
      void now;
      const redis = getRedisConnection();
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, windowMs);
      }
      return { allowed: count <= limit, count };
    },
    async acquireCooldown(key, windowMs, now) {
      void now;
      const redis = getRedisConnection();
      const ok = await redis.set(key, "1", "PX", windowMs, "NX");
      return ok === "OK";
    },
  };
}

const memoryFallback = createMemoryRateLimitBackend();

export function defaultRateLimitBackend(): RateLimitBackend {
  if (!isRedisConfigured()) return memoryFallback;
  const redis = createRedisRateLimitBackend();
  return {
    async hit(key, limit, windowMs, now) {
      try {
        return await redis.hit(key, limit, windowMs, now);
      } catch {
        return memoryFallback.hit(key, limit, windowMs, now);
      }
    },
    async acquireCooldown(key, windowMs, now) {
      try {
        return await redis.acquireCooldown(key, windowMs, now);
      } catch {
        return memoryFallback.acquireCooldown(key, windowMs, now);
      }
    },
  };
}
