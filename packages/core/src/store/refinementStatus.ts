import type { Redis } from 'ioredis';

const REFINEMENT_KEY_PREFIX = 'refinement:status:';
const TTL_SECONDS = 60 * 5; // 5 minutes

export type RefinementPhase = 'waiting' | 'searching' | 'evaluating';

export interface RefinementStatus {
  attempt: number;
  maxAttempts: number;
  query: string;
  phase: RefinementPhase;
}

function key(campaignId: string): string {
  return `${REFINEMENT_KEY_PREFIX}${campaignId}`;
}

export function createRefinementStatusStore(redis: Redis) {
  return {
    async get(campaignId: string): Promise<RefinementStatus | null> {
      const raw = await redis.get(key(campaignId));
      return raw ? (JSON.parse(raw) as RefinementStatus) : null;
    },

    async set(campaignId: string, status: RefinementStatus): Promise<void> {
      await redis.set(key(campaignId), JSON.stringify(status), 'EX', TTL_SECONDS);
    },

    async clear(campaignId: string): Promise<void> {
      await redis.del(key(campaignId));
    },
  };
}

export type RefinementStatusStore = ReturnType<typeof createRefinementStatusStore>;
