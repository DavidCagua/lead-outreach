import type { Redis } from 'ioredis';

const REFINEMENT_KEY = 'refinement:status';
const TTL_SECONDS = 60 * 5; // 5 minutes

export type RefinementPhase = 'waiting' | 'searching' | 'evaluating';

export interface RefinementStatus {
  attempt: number;
  maxAttempts: number;
  query: string;
  phase: RefinementPhase;
}

export function createRefinementStatusStore(redis: Redis) {
  return {
    async get(): Promise<RefinementStatus | null> {
      const raw = await redis.get(REFINEMENT_KEY);
      return raw ? (JSON.parse(raw) as RefinementStatus) : null;
    },

    async set(status: RefinementStatus): Promise<void> {
      await redis.set(REFINEMENT_KEY, JSON.stringify(status), 'EX', TTL_SECONDS);
    },

    async clear(): Promise<void> {
      await redis.del(REFINEMENT_KEY);
    },
  };
}

export type RefinementStatusStore = ReturnType<typeof createRefinementStatusStore>;
