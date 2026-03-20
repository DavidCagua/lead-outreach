import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export function createRedisConnection(opts?: { forWorker?: boolean }): Redis {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: opts?.forWorker ? null : undefined,
  });
}

let defaultConnection: Redis | null = null;

export function getRedis(): Redis {
  if (!defaultConnection) {
    defaultConnection = createRedisConnection();
  }
  return defaultConnection;
}
