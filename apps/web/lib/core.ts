import {
  getRedis,
  createLeadStore,
  createRefinementStatusStore,
  getLeadProcessingQueue,
  getOutreachQueue,
  createGooglePlacesClient,
} from '@ekos/core';

const redis = getRedis();
export const leadStore = createLeadStore(redis);
export const refinementStatusStore = createRefinementStatusStore(redis);
export const leadProcessingQueue = getLeadProcessingQueue();
export const outreachQueue = getOutreachQueue();
export const googlePlaces = createGooglePlacesClient(
  process.env.GOOGLE_PLACES_API_KEY ?? ''
);
