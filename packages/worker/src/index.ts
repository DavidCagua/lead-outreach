import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from monorepo root (works when running from root via pnpm worker)
const rootEnv = path.resolve(__dirname, '../../..');
config({ path: path.join(rootEnv, '.env') });
config({ path: path.join(rootEnv, '.env.local') });
// Fallback: load from cwd (when running from project root)
config({ path: path.resolve(process.cwd(), '.env') });

// Validate required env vars at startup
const required = ['REDIS_URL', 'GOOGLE_PLACES_API_KEY', 'FIRECRAWL_API_KEY', 'OPENAI_API_KEY'];
const missing = required.filter((k) => !process.env[k]?.trim());
if (missing.length > 0) {
  console.warn(`⚠ Missing env vars: ${missing.join(', ')}. Add them to .env and restart.`);
}

import { createLeadProcessingWorker, createOutreachWorker, getLeadProcessingQueue } from '@ekos/core';

const redisUrl = process.env.REDIS_URL ?? '(not set)';
console.log(`[worker] REDIS_URL: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`);

const leadWorker = createLeadProcessingWorker();
const outreachWorker = createOutreachWorker();

leadWorker.on('completed', async (job) => {
  console.log(`[queue] Lead job ${job.id} completed`);
  try {
    const q = getLeadProcessingQueue();
    const counts = await q.getJobCounts();
    console.log(`[queue] Remaining: wait=${counts.waiting} active=${counts.active} delayed=${counts.delayed}`);
  } catch (_) {}
});

leadWorker.on('failed', async (job, err) => {
  console.error(`[queue] Lead job ${job?.id} failed:`, err?.message ?? err);
  try {
    const counts = await getLeadProcessingQueue().getJobCounts();
    console.log(`[queue] After fail: wait=${counts.waiting} active=${counts.active}`);
  } catch (_) {}
});

outreachWorker.on('completed', (job) => {
  console.log(`[outreach] Completed job ${job.id}`);
});

outreachWorker.on('failed', (job, err) => {
  console.error(`[outreach] Failed job ${job?.id}:`, err);
});

console.log('Workers started: lead-processing, outreach');
getLeadProcessingQueue()
  .getJobCounts()
  .then((c) => console.log(`[queue] Initial: wait=${c.waiting} active=${c.active} delayed=${c.delayed}`))
  .catch(() => {});
