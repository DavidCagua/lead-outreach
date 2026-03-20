import OpenAI from 'openai';
import {
  getRedis,
  createLeadStore,
  createRefinementStatusStore,
  getLeadProcessingQueue,
  getOutreachQueue,
  createGooglePlacesClient,
} from '@ekos/core';

const redis = getRedis();

export function createOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) throw new Error('OPENAI_API_KEY is not set');
  return new OpenAI({ apiKey: key.trim().replace(/^["']|["']$/g, '') });
}
export const leadStore = createLeadStore(redis);
export const refinementStatusStore = createRefinementStatusStore(redis);
export const leadProcessingQueue = getLeadProcessingQueue();
export const outreachQueue = getOutreachQueue();
export const googlePlaces = createGooglePlacesClient(
  process.env.GOOGLE_PLACES_API_KEY ?? ''
);
