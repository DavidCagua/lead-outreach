import { Queue } from 'bullmq';
import { getRedis } from './connection.js';

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
};

let leadProcessingQueue: Queue | null = null;
let outreachQueue: Queue | null = null;

export function getLeadProcessingQueue(): Queue {
  if (!leadProcessingQueue) {
    leadProcessingQueue = new Queue('lead-processing', {
      connection: getRedis() as any,
      defaultJobOptions,
    });
  }
  return leadProcessingQueue;
}

export function getOutreachQueue(): Queue {
  if (!outreachQueue) {
    outreachQueue = new Queue('outreach', {
      connection: getRedis() as any,
      defaultJobOptions,
    });
  }
  return outreachQueue;
}
