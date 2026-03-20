import type { Redis } from 'ioredis';
import type { Campaign, CampaignStatus } from '../types.js';

const CAMPAIGN_PREFIX = 'campaign:';
const CAMPAIGN_IDS_KEY = 'campaign:ids';
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function createCampaignStore(redis: Redis) {
  return {
    async create(campaign: Campaign): Promise<void> {
      const key = `${CAMPAIGN_PREFIX}${campaign.id}`;
      await redis.set(key, JSON.stringify(campaign), 'EX', TTL_SECONDS);
      await redis.sadd(CAMPAIGN_IDS_KEY, campaign.id);
    },

    async get(id: string): Promise<Campaign | null> {
      const key = `${CAMPAIGN_PREFIX}${id}`;
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as Campaign) : null;
    },

    async list(): Promise<Campaign[]> {
      const ids = await redis.smembers(CAMPAIGN_IDS_KEY);
      const campaigns: Campaign[] = [];
      for (const id of ids) {
        const c = await this.get(id);
        if (c) campaigns.push(c);
      }
      return campaigns.sort((a, b) => b.createdAt - a.createdAt);
    },

    async updateStatus(id: string, status: CampaignStatus): Promise<void> {
      const existing = await this.get(id);
      if (!existing) return;
      const updated: Campaign = { ...existing, status };
      const key = `${CAMPAIGN_PREFIX}${id}`;
      await redis.set(key, JSON.stringify(updated), 'EX', TTL_SECONDS);
    },

    async exists(id: string): Promise<boolean> {
      const key = `${CAMPAIGN_PREFIX}${id}`;
      const raw = await redis.get(key);
      return raw != null;
    },
  };
}

export type CampaignStore = ReturnType<typeof createCampaignStore>;
