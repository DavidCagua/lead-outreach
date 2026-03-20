import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { leadStore, leadProcessingQueue, googlePlaces, refinementStatusStore } from '@/lib/core';
import { refineQuery, runLeadDiscoveryLoop } from '@ekos/core';
import type { Lead } from '@ekos/core';

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
    const refinedQueryAttempt1 = refineQuery(trimmedQuery, 1);
    const places = await googlePlaces.textSearch(refinedQueryAttempt1, 2);
    console.log(`[search] Google returned ${places.length} places`);
    const redisUrl = process.env.REDIS_URL ?? '(not set)';
    console.log(`[search] REDIS_URL: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`);

    const seenPlaceIds = new Set<string>();
    const jobIds: string[] = [];
    const createdLeadIds: string[] = [];
    let skipped = 0;

    for (const place of places) {
      const placeId = place.id;
      if (seenPlaceIds.has(placeId)) {
        skipped++;
        continue;
      }
      seenPlaceIds.add(placeId);

      // Skip if we already have this clinic (from a previous search)
      const existing = await leadStore.getByPlaceId(placeId);
      if (existing) {
        skipped++;
        console.log(`[search] Skipped ${place.name} (existing lead)`);
        continue;
      }

      const lead: Lead = {
        id: uuid(),
        name: place.name,
        address: place.address,
        website: place.website,
        place_id: placeId,
        status: 'pending',
      };

      await leadStore.create(lead);
      const job = await leadProcessingQueue.add('process', { leadId: lead.id });
      jobIds.push(job.id ?? lead.id);
      createdLeadIds.push(lead.id);
      console.log(`[search] Enqueued ${place.name}`, { leadId: lead.id, jobId: job.id });
    }

    console.log(`[search] Created ${jobIds.length} leads, enqueued ${jobIds.length} jobs, skipped ${skipped}`);
    console.log(`[search] Job IDs: ${jobIds.join(', ')}`);

    // Run refinement loop in background (don't block response)
    void runLeadDiscoveryLoop(
      {
        leadStore,
        googlePlaces,
        leadProcessingQueue,
        refinementStatusStore,
      },
      trimmedQuery,
      createdLeadIds
    );

    return NextResponse.json({
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
