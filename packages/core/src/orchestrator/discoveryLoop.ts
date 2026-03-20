import type { Queue } from 'bullmq';
import type OpenAI from 'openai';
import { v4 as uuid } from 'uuid';
import type { Lead } from '../types.js';
import type { LeadStore } from '../store/leads.js';
import type { RefinementStatusStore } from '../store/refinementStatus.js';
import type { GooglePlacesClient } from '../integrations/googlePlaces.js';
import { refineQueryLLM } from '../agents/refinementAgent.js';
import type { PreviousResultsSummary } from '../agents/refinementAgent.js';
import { fallbackRefineQuery, isGoodLead, isBadLead } from './refinement.js';

const MAX_ATTEMPTS = 3;
const DESIRED_GOOD_LEADS = 3;
const PLACES_PER_QUERY = 5;
const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 120_000;

export interface DiscoveryLoopDeps {
  leadStore: LeadStore;
  googlePlaces: GooglePlacesClient;
  leadProcessingQueue: Queue;
  refinementStatusStore: RefinementStatusStore;
  openai: OpenAI;
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
 * Runs one search iteration: search each query, merge results, create leads, enqueue.
 * Dedupes by place_id across all queries. Returns the lead IDs created and enqueued.
 */
async function searchAndEnqueue(
  deps: DiscoveryLoopDeps,
  queries: string[],
  excludePlaceIds: Set<string>
): Promise<string[]> {
  const { leadStore, googlePlaces, leadProcessingQueue } = deps;
  const seenPlaceIds = new Set(excludePlaceIds);
  const allPlaces: Array<{ id: string; name: string; address: string; website?: string }> = [];

  for (const query of queries) {
    const places = await googlePlaces.textSearch(query, PLACES_PER_QUERY);
    for (const p of places) {
      if (!seenPlaceIds.has(p.id)) {
        seenPlaceIds.add(p.id);
        allPlaces.push(p);
      }
    }
  }

  const leadIds: string[] = [];
  for (const place of allPlaces) {
    const existing = await leadStore.getByPlaceId(place.id);
    if (existing) continue;

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

function buildPreviousResultsSummary(
  goodLeads: Lead[],
  badLeads: Lead[]
): PreviousResultsSummary {
  const goodLeadsSummary = goodLeads.map((l) => ({
    name: l.name,
    score: l.score?.score ?? 0,
    services: l.extracted?.services ?? [],
    painPoints: l.extracted?.pain_points ?? [],
  }));

  const badLeadsSummary = badLeads.map((l) => ({
    name: l.name,
    failureReason: l.failureReason,
  }));

  const commonIssues: string[] = [];
  for (const l of badLeads) {
    if (l.failureReason && !commonIssues.includes(l.failureReason)) {
      commonIssues.push(l.failureReason);
    }
    if (l.extracted?.confidence != null && l.extracted.confidence < 0.6) {
      if (!commonIssues.includes('low confidence')) commonIssues.push('low confidence');
    }
    if (!l.extracted?.services?.length) {
      if (!commonIssues.includes('no services')) commonIssues.push('no services');
    }
    if (l.extracted?.clinic_size === 'small') {
      if (!commonIssues.includes('small clinic')) commonIssues.push('small clinic');
    }
  }

  const scores = goodLeads
    .map((l) => l.score?.score)
    .filter((s): s is number => typeof s === 'number');
  const avgScore =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  return {
    avgScore,
    goodCount: goodLeads.length,
    badCount: badLeads.length,
    goodLeadsSummary,
    badLeadsSummary,
    commonIssues,
  };
}

/**
 * Iterative lead discovery loop: wait for initial batch, evaluate, then refine (max 3 attempts).
 * Attempt 1: Search API already ran expandQuery; loop waits. Attempts 2-3: refineQueryLLM + search.
 */
export async function runLeadDiscoveryLoop(
  deps: DiscoveryLoopDeps,
  originalQuery: string,
  initialBatchLeadIds: string[]
): Promise<void> {
  const { leadStore, refinementStatusStore, openai } = deps;
  let attempt = 1;
  let collectedGoodCount = 0;
  let batchLeadIds = initialBatchLeadIds;
  let excludePlaceIds = new Set(await leadStore.getAllPlaceIds());
  let activeQuery = originalQuery;
  let lastGoodLeads: Lead[] = [];
  let lastBadLeads: Lead[] = [];

  try {
    while (attempt <= MAX_ATTEMPTS && collectedGoodCount < DESIRED_GOOD_LEADS) {
      await refinementStatusStore.set({
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        query: activeQuery,
        phase: attempt === 1 && batchLeadIds.length > 0 ? 'waiting' : 'searching',
      });

      if (attempt === 1) {
        if (batchLeadIds.length === 0) {
          attempt++;
          continue;
        }
      } else {
        const previousResultsSummary = buildPreviousResultsSummary(
          lastGoodLeads,
          lastBadLeads
        );

        const refinedQuery = await refineQueryLLM(openai, {
          originalQuery,
          attempt,
          previousResultsSummary,
        }).catch(() => fallbackRefineQuery(originalQuery, attempt));

        activeQuery = refinedQuery;
        excludePlaceIds = new Set(await leadStore.getAllPlaceIds());
        batchLeadIds = await searchAndEnqueue(
          deps,
          [refinedQuery],
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
        query: activeQuery,
        phase: 'evaluating',
      });

      await waitForLeadBatch(leadStore, batchLeadIds);

      const leads = (
        await Promise.all(batchLeadIds.map((id) => leadStore.get(id)))
      ).filter((l: Lead | null): l is Lead => l != null);

      const goodLeads = leads.filter(isGoodLead);
      const badLeads = leads.filter(isBadLead);
      lastGoodLeads = goodLeads;
      lastBadLeads = badLeads;
      collectedGoodCount += goodLeads.length;

      console.log({
        attempt,
        query: activeQuery,
        strategy: attempt === 1 ? 'expand' : 'refine',
        resultsCount: batchLeadIds.length,
        goodLeadsCount: goodLeads.length,
        totalGood: collectedGoodCount,
      });

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
