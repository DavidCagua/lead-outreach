import { Job, Worker } from 'bullmq';
import OpenAI from 'openai';
import { createRedisConnection } from './connection.js';
import { createLeadStore } from '../store/leads.js';
import { createGooglePlacesClient } from '../integrations/googlePlaces.js';
import { createFirecrawlClient } from '../integrations/firecrawl.js';
import { runExtractionAgent } from '../agents/extractionAgent.js';
import { runScoringAgent } from '../agents/scoringAgent.js';
import { runOutreachAgent } from '../agents/outreachAgent.js';
import type { Lead } from '../types.js';

function getEnv(key: string): string {
  const v = process.env[key];
  if (!v || !v.trim()) return '';
  return v.trim().replace(/^["']|["']$/g, ''); // strip surrounding quotes
}

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const GOOGLE_API_KEY = getEnv('GOOGLE_PLACES_API_KEY');
const FIRECRAWL_API_KEY = getEnv('FIRECRAWL_API_KEY');
const OPENAI_API_KEY = getEnv('OPENAI_API_KEY');

const EXTRACTION_MAX_ATTEMPTS = 2;
const EXTRACTION_MIN_CONFIDENCE = 0.6;
const MIN_SCORE_FOR_OUTREACH = 5;

export interface LeadProcessingJobData {
  leadId: string;
  campaignId: string;
}

export interface OutreachJobData {
  leadId: string;
}

async function processLeadJob(job: Job<LeadProcessingJobData>): Promise<void> {
  const { leadId, campaignId: _campaignId } = job.data;
  console.log(`[worker] Job ${job.id} picked up`, { leadId });

  const openaiKey = getEnv('OPENAI_API_KEY') || OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY is not set. Add it to your .env file and restart the worker.');
  }

  const redis = createRedisConnection({ forWorker: true });
  const leadStore = createLeadStore(redis);
  const googlePlaces = createGooglePlacesClient(GOOGLE_API_KEY);
  const firecrawl = createFirecrawlClient(FIRECRAWL_API_KEY);
  const openai = new OpenAI({ apiKey: openaiKey });

  const lead = await leadStore.get(leadId);
  if (!lead) {
    console.error(`[worker] Lead not found: ${leadId}`);
    throw new Error(`Lead not found: ${leadId}`);
  }

  const log = (step: string, detail?: string) =>
    console.log(`[${lead.name}] ${step}${detail ? `: ${detail}` : ''}`);

  log('1. Job started', `leadId=${leadId}`);
  await leadStore.update(leadId, { status: 'processing', processingPhase: 'fetching_website' });

  try {
    let website = lead.website;
    if (!website && lead.place_id) {
      log('2. Fetching Place Details for website');
      try {
        const details = await googlePlaces.getPlaceDetails(lead.place_id);
        website = details.website;
        log('2. Place Details', website ? `website=${website}` : 'no website');
      } catch (e) {
        log('2. Place Details failed', String(e));
      }
    } else if (website) {
      log('2. Website from search', website);
    }

    if (!website) {
      const reason = 'No website found in Google Places';
      log('FAILED', reason);
      await leadStore.update(leadId, {
        status: 'failed',
        processingPhase: undefined,
        extracted: undefined,
        score: undefined,
        outreach: null,
        failureReason: reason,
      });
      return;
    }

    await leadStore.update(leadId, { website });

    let content: string;
    try {
      log('3. Firecrawl crawl started', website);
      await leadStore.update(leadId, { processingPhase: 'crawling' });
      content = await firecrawl.crawl(website);
      log('3. Firecrawl done', `${content?.length ?? 0} chars`);
    } catch (scrapeErr) {
      const reason = (scrapeErr instanceof Error ? scrapeErr.message : 'Crawl failed') || 'Crawl failed';
      log('FAILED', reason);
      await leadStore.update(leadId, {
        status: 'failed',
        processingPhase: undefined,
        extracted: undefined,
        score: undefined,
        outreach: null,
        failureReason: reason,
      });
      return;
    }

    if (!content || content.length < 50) {
      const reason = `Scraped content too short (${content?.length ?? 0} chars)`;
      log('FAILED', reason);
      await leadStore.update(leadId, {
        status: 'failed',
        processingPhase: undefined,
        extracted: undefined,
        score: undefined,
        outreach: null,
        failureReason: reason,
      });
      return;
    }

    log('4. Extraction agent started');
    await leadStore.update(leadId, { processingPhase: 'extracting' });
    let extracted = await runExtractionAgent(openai, content);
    let attempts = 1;

    while (extracted.confidence < EXTRACTION_MIN_CONFIDENCE && attempts < EXTRACTION_MAX_ATTEMPTS) {
      log('4. Extraction retry', `attempt ${attempts + 1} (confidence ${extracted.confidence})`);
      extracted = await runExtractionAgent(openai, content);
      attempts++;
    }
    log('4. Extraction done', `confidence=${extracted.confidence}, services=${extracted.services.length}`);

    log('5. Scoring agent started');
    await leadStore.update(leadId, { processingPhase: 'scoring' });
    const score = await runScoringAgent(openai, extracted, lead.name);
    log('5. Scoring done', `score=${score.score} (${score.priority})`);

    await leadStore.update(leadId, {
      extracted,
      score,
      outreach: score.score >= MIN_SCORE_FOR_OUTREACH ? undefined : null,
      status: 'completed',
      processingPhase: undefined,
    });
    log('6. Completed', `score=${score.score}`);
  } catch (err) {
    const reason = (err instanceof Error ? err.message : 'Unknown error') || 'Unknown error';
    log('FAILED', reason);
    await leadStore.update(leadId, {
      status: 'failed',
      processingPhase: undefined,
      extracted: undefined,
      score: undefined,
      outreach: null,
      failureReason: reason,
    });
    // Don't rethrow - we've recorded the failure; retrying rarely helps
  } finally {
    redis.quit();
  }
}

async function processOutreachJob(job: Job<OutreachJobData>): Promise<void> {
  const { leadId } = job.data;

  const openaiKey = getEnv('OPENAI_API_KEY') || OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY is not set. Add it to your .env file and restart the worker.');
  }

  const redis = createRedisConnection({ forWorker: true });
  const leadStore = createLeadStore(redis);
  const openai = new OpenAI({ apiKey: openaiKey });

  const lead = await leadStore.get(leadId);
  if (!lead || !lead.extracted || !lead.score) {
    throw new Error(`Lead not found or not ready for outreach: ${leadId}`);
  }

  if (lead.score.score < MIN_SCORE_FOR_OUTREACH) {
    await leadStore.update(leadId, { outreach: null });
    redis.quit();
    return;
  }

  try {
    const outreach = await runOutreachAgent(openai, {
      clinic_name: lead.name,
      services: lead.extracted.services,
      pain_points: lead.extracted.pain_points,
      has_online_booking: lead.extracted.has_online_booking,
      score: lead.score.score,
    });

    await leadStore.update(leadId, { outreach });
  } finally {
    redis.quit();
  }
}

export function createLeadProcessingWorker(): Worker<LeadProcessingJobData> {
  const worker = new Worker<LeadProcessingJobData>(
    'lead-processing',
    processLeadJob,
    {
      connection: createRedisConnection({ forWorker: true }) as any,
      concurrency: 2,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    }
  );

  // When a job throws (e.g. Lead not found) before our try block, we never update the lead.
  // Mark it failed here so the UI shows a reason instead of "Reason not recorded".
  worker.on('failed', async (job, err) => {
    const leadId = job?.data?.leadId;
    if (!leadId) return;
    const conn = createRedisConnection({ forWorker: true });
    const store = createLeadStore(conn);
    const lead = await store.get(leadId);
    if (lead && (lead.status === 'pending' || lead.status === 'processing')) {
      const reason = ((err instanceof Error ? err.message : String(err)) || 'Job failed').trim() || 'Job failed';
      await store.update(leadId, {
        status: 'failed',
        processingPhase: undefined,
        extracted: undefined,
        score: undefined,
        outreach: null,
        failureReason: reason,
      });
      console.log(`[worker] Marked lead ${leadId} (${lead.name}) as failed: ${reason}`);
    }
    conn.quit();
  });

  return worker;
}

export function createOutreachWorker(): Worker<OutreachJobData> {
  return new Worker<OutreachJobData>(
    'outreach',
    processOutreachJob,
    {
      connection: createRedisConnection({ forWorker: true }) as any,
      concurrency: 5,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    }
  );
}
