import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import {
  leadStore,
  campaignStore,
  leadProcessingQueue,
  googlePlaces,
  refinementStatusStore,
  createOpenAI,
} from '@/lib/core';
import { expandQuery, runLeadDiscoveryLoop } from '@ekos/core';
import type { Lead } from '@ekos/core';

const PLACES_PER_QUERY = 4;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = body?.query;

    if (typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'Missing or invalid query' },
        { status: 400 }
      );
    }

    const trimmedQuery = query.trim();
    const campaignId = crypto.randomUUID();

    const campaign = {
      id: campaignId,
      query: trimmedQuery,
      status: 'running' as const,
      createdAt: Date.now(),
    };
    await campaignStore.create(campaign);

    const openai = createOpenAI();
    const queries = await expandQuery(openai, trimmedQuery);
    const seenPlaceIds = new Set<string>();
    const allPlaces: Array<{ id: string; name: string; address: string; website?: string }> = [];

    for (const q of queries) {
      const places = await googlePlaces.textSearch(q, PLACES_PER_QUERY);
      for (const p of places) {
        if (!seenPlaceIds.has(p.id)) {
          seenPlaceIds.add(p.id);
          allPlaces.push(p);
        }
      }
    }

    console.log(`[search] expandQuery → ${queries.length} queries, ${allPlaces.length} places after dedupe`);

    const jobIds: string[] = [];
    const createdLeadIds: string[] = [];
    let skipped = 0;

    for (const place of allPlaces) {
      const existing = await leadStore.getByPlaceIdInCampaign(place.id, campaignId);
      if (existing) {
        skipped++;
        console.log(`[search] Skipped ${place.name} (existing lead)`);
        continue;
      }

      const lead: Lead = {
        id: uuid(),
        campaignId,
        name: place.name,
        address: place.address,
        website: place.website,
        place_id: place.id,
        status: 'pending',
      };

      await leadStore.create(lead, campaignId);
      const job = await leadProcessingQueue.add('process', {
        leadId: lead.id,
        campaignId,
      });
      jobIds.push(job.id ?? lead.id);
      createdLeadIds.push(lead.id);
      console.log(`[search] Enqueued ${place.name}`, { leadId: lead.id, jobId: job.id });
    }

    console.log(`[search] Created ${createdLeadIds.length} leads, skipped ${skipped}`);

    void runLeadDiscoveryLoop(
      {
        leadStore,
        campaignStore,
        googlePlaces,
        leadProcessingQueue,
        refinementStatusStore,
        openai,
      },
      campaignId,
      trimmedQuery,
      createdLeadIds
    );

    return NextResponse.json({
      campaignId,
      query: trimmedQuery,
      jobIds,
      message: `Enqueued ${jobIds.length} leads for processing`,
    });
  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Search failed' },
      { status: 500 }
    );
  }
}
