import IORedis from "ioredis";

let connection: IORedis | null = null;

export function redisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  return url || null;
}

export function isRedisConfigured(): boolean {
  return Boolean(redisUrl());
}

/** Shared ioredis connection for BullMQ (lazy). */
export function getRedisConnection(): IORedis {
  const url = redisUrl();
  if (!url) {
    throw new Error(
      "REDIS_URL chưa được cấu hình. Chạy Redis (docker compose) hoặc đặt REDIS_URL.",
    );
  }
  if (!connection) {
    connection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
}

export async function closeRedisConnection() {
  if (connection) {
    await connection.quit().catch(() => undefined);
    connection = null;
  }
}
