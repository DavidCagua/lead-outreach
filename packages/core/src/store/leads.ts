import type { Redis } from 'ioredis';
import type { Lead } from '../types.js';

const LEAD_PREFIX = 'lead:';
const PLACE_ID_PREFIX = 'place_id:';
const CAMPAIGN_LEADS_SUFFIX = ':leads';
const CAMPAIGN_PLACE_IDS_SUFFIX = ':place_ids';
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface CampaignStats {
  total: number;
  completed: number;
  processing: number;
  failed: number;
}

export function createLeadStore(redis: Redis) {
  return {
    async getByPlaceIdInCampaign(
      placeId: string,
      campaignId: string
    ): Promise<Lead | null> {
      const leadId = await redis.get(
        `${PLACE_ID_PREFIX}${campaignId}:${placeId}`
      );
      return leadId ? this.get(leadId) : null;
    },

    async create(lead: Lead, campaignId: string): Promise<void> {
      const key = `${LEAD_PREFIX}${lead.id}`;
      const leadWithCampaign: Lead = { ...lead, campaignId };
      await redis.set(key, JSON.stringify(leadWithCampaign), 'EX', TTL_SECONDS);
      await redis.sadd(`campaign:${campaignId}${CAMPAIGN_LEADS_SUFFIX}`, lead.id);
      if (lead.place_id) {
        await redis.set(
          `${PLACE_ID_PREFIX}${campaignId}:${lead.place_id}`,
          lead.id,
          'EX',
          TTL_SECONDS
        );
        await redis.sadd(
          `campaign:${campaignId}${CAMPAIGN_PLACE_IDS_SUFFIX}`,
          lead.place_id
        );
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

    async listByCampaign(campaignId: string): Promise<Lead[]> {
      const ids = await redis.smembers(
        `campaign:${campaignId}${CAMPAIGN_LEADS_SUFFIX}`
      );
      const leads: Lead[] = [];

      for (const id of ids) {
        const lead = await this.get(id);
        if (lead) leads.push(lead);
      }

      return leads.sort((a, b) => {
        const scoreA = a.score?.score ?? 0;
        const scoreB = b.score?.score ?? 0;
        return scoreB - scoreA;
      });
    },

    async getCampaignStats(campaignId: string): Promise<CampaignStats> {
      const leads = await this.listByCampaign(campaignId);
      const stats: CampaignStats = {
        total: leads.length,
        completed: 0,
        processing: 0,
        failed: 0,
      };
      for (const l of leads) {
        if (l.status === 'completed') stats.completed++;
        else if (l.status === 'processing' || l.status === 'pending')
          stats.processing++;
        else if (l.status === 'failed') stats.failed++;
      }
      return stats;
    },

    async getAllPlaceIdsForCampaign(campaignId: string): Promise<string[]> {
      const placeIds = await redis.smembers(
        `campaign:${campaignId}${CAMPAIGN_PLACE_IDS_SUFFIX}`
      );
      return placeIds;
    },
  };
}

export type LeadStore = ReturnType<typeof createLeadStore>;
