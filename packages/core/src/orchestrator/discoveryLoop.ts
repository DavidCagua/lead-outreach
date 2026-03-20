import type { Queue } from 'bullmq';
import { v4 as uuid } from 'uuid';
import type { Lead } from '../types.js';
import type { LeadStore } from '../store/leads.js';
import type { RefinementStatusStore } from '../store/refinementStatus.js';
import type { GooglePlacesClient } from '../integrations/googlePlaces.js';
import { refineQuery, isGoodLead, isBadLead } from './refinement.js';

const MAX_ATTEMPTS = 3;
const DESIRED_GOOD_LEADS = 5;
const PLACES_PER_SEARCH = 2; // dev: set to 10 for production
const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 120_000;

export interface DiscoveryLoopDeps {
  leadStore: LeadStore;
  googlePlaces: GooglePlacesClient;
  leadProcessingQueue: Queue;
  refinementStatusStore: RefinementStatusStore;
}

/**
 * Waits for a batch of leads to finish processing (completed or failed).
 */
async function waitForLeadBatch(
  leadStore: LeadStore,
  leadIds: string[]
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    const leads = await Promise.all(leadIds.map((id) => leadStore.get(id)));
    const done = leads.every(
      (l: Lead | null) => l && (l.status === 'completed' || l.status === 'failed')
    );
    if (done) return;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  console.warn('[Refinement] Wait timeout reached for batch');
}

/**
 * Runs one search iteration: search, create leads, enqueue.
 * Returns the lead IDs that were created and enqueued.
 */
async function searchAndEnqueue(
  deps: DiscoveryLoopDeps,
  refinedQuery: string,
  excludePlaceIds: Set<string>
): Promise<string[]> {
  const { leadStore, googlePlaces, leadProcessingQueue } = deps;
  const places = await googlePlaces.textSearch(refinedQuery, PLACES_PER_SEARCH);
  const leadIds: string[] = [];

  for (const place of places) {
    if (excludePlaceIds.has(place.id)) continue;
    const existing = await leadStore.getByPlaceId(place.id);
    if (existing) {
      excludePlaceIds.add(place.id);
      continue;
    }

    const lead: Lead = {
      id: uuid(),
      name: place.name,
      address: place.address,
      website: place.website,
      place_id: place.id,
      status: 'pending',
    };

    await leadStore.create(lead);
    await leadProcessingQueue.add('process', { leadId: lead.id });
    leadIds.push(lead.id);
    excludePlaceIds.add(place.id);
  }

  return leadIds;
}

/**
 * Iterative lead discovery loop: wait for initial batch, evaluate, then refine (max 3 attempts).
 * Called in background after API has done attempt 1 and returned.
 */
export async function runLeadDiscoveryLoop(
  deps: DiscoveryLoopDeps,
  originalQuery: string,
  initialBatchLeadIds: string[]
): Promise<void> {
  const { leadStore, refinementStatusStore } = deps;
  let attempt = 1;
  let collectedGoodCount = 0;
  let batchLeadIds = initialBatchLeadIds;
  let excludePlaceIds = new Set(await leadStore.getAllPlaceIds());

  try {
    while (attempt <= MAX_ATTEMPTS && collectedGoodCount < DESIRED_GOOD_LEADS) {
      const refinedQuery = refineQuery(originalQuery, attempt);
      console.log(`[Refinement] Attempt ${attempt} → query: ${refinedQuery}`);

      await refinementStatusStore.set({
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        query: refinedQuery,
        phase: attempt === 1 && batchLeadIds.length > 0 ? 'waiting' : 'searching',
      });

      if (attempt === 1) {
        // API already did search + enqueue; we just wait for results
        if (batchLeadIds.length === 0) {
          attempt++;
          continue;
        }
      } else {
        // Attempt 2 or 3: run new search with refined query (refresh seen set)
        excludePlaceIds = new Set(await leadStore.getAllPlaceIds());
        batchLeadIds = await searchAndEnqueue(
          deps,
          refinedQuery,
          excludePlaceIds
        );

        if (batchLeadIds.length === 0) {
          console.log(
            `[Refinement] Attempt ${attempt}: no new places (all seen/deduped)`
          );
          attempt++;
          continue;
        }
      }

      await refinementStatusStore.set({
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        query: refinedQuery,
        phase: 'evaluating',
      });

      await waitForLeadBatch(leadStore, batchLeadIds);

      const leads = (
        await Promise.all(batchLeadIds.map((id) => leadStore.get(id)))
      ).filter((l: Lead | null): l is Lead => l != null);

      const goodLeads = leads.filter(isGoodLead);
      const badLeads = leads.filter(isBadLead);

      collectedGoodCount += goodLeads.length;

      console.log(
        `[Refinement] Attempt ${attempt} done: ${goodLeads.length} good, ${badLeads.length} bad (total good: ${collectedGoodCount})`
      );

      if (collectedGoodCount >= DESIRED_GOOD_LEADS) {
        console.log(
          `[Refinement] Reached ${DESIRED_GOOD_LEADS} good leads, stopping`
        );
        break;
      }

      attempt++;
    }

    if (attempt > MAX_ATTEMPTS) {
      console.log(`[Refinement] Max attempts (${MAX_ATTEMPTS}) reached`);
    }
  } catch (err) {
    console.error('[Refinement] Loop error:', err);
  } finally {
    await refinementStatusStore.clear();
  }
}
