import type { Redis } from 'ioredis';
import type { Lead } from '../types.js';

const LEAD_PREFIX = 'lead:';
const LEAD_IDS_KEY = 'lead:ids';
const PLACE_ID_INDEX = 'place_id:';
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function createLeadStore(redis: Redis) {
  return {
    async getByPlaceId(placeId: string): Promise<Lead | null> {
      const leadId = await redis.get(`${PLACE_ID_INDEX}${placeId}`);
      return leadId ? this.get(leadId) : null;
    },

    async create(lead: Lead): Promise<void> {
      const key = `${LEAD_PREFIX}${lead.id}`;
      await redis.set(key, JSON.stringify(lead), 'EX', TTL_SECONDS);
      await redis.sadd(LEAD_IDS_KEY, lead.id);
      if (lead.place_id) {
        await redis.set(`${PLACE_ID_INDEX}${lead.place_id}`, lead.id, 'EX', TTL_SECONDS);
      }
    },

    async get(id: string): Promise<Lead | null> {
      const key = `${LEAD_PREFIX}${id}`;
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as Lead) : null;
    },

    async update(id: string, patch: Partial<Lead>): Promise<Lead | null> {
      const existing = await this.get(id);
      if (!existing) return null;

      const updated: Lead = { ...existing, ...patch };
      const key = `${LEAD_PREFIX}${id}`;
      await redis.set(key, JSON.stringify(updated), 'EX', TTL_SECONDS);
      return updated;
    },

    async list(): Promise<Lead[]> {
      const ids = await redis.smembers(LEAD_IDS_KEY);
      const leads: Lead[] = [];

      for (const id of ids) {
        const lead = await this.get(id);
        if (lead) leads.push(lead);
      }

      return leads.sort((a, b) => b.name.localeCompare(a.name));
    },

    async getAllPlaceIds(): Promise<string[]> {
      const ids = await redis.smembers(LEAD_IDS_KEY);
      const placeIds: string[] = [];
      for (const id of ids) {
        const lead = await this.get(id);
        if (lead?.place_id) placeIds.push(lead.place_id);
      }
      return placeIds;
    },
  };
}

export type LeadStore = ReturnType<typeof createLeadStore>;
