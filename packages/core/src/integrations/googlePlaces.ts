import type { GooglePlaceResult } from '../types.js';

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places';
const FIELD_MASK = 'places.id,places.name,places.displayName,places.formattedAddress,places.websiteUri';
const DETAILS_FIELD_MASK = 'id,displayName,formattedAddress,websiteUri';

export function createGooglePlacesClient(apiKey: string) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': FIELD_MASK,
  };

  return {
    async textSearch(query: string, limit = 10): Promise<GooglePlaceResult[]> {
      const res = await fetch(SEARCH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          textQuery: query,
          pageSize: Math.min(limit, 20),
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Google Places search failed: ${res.status} ${err}`);
      }

      const data = (await res.json()) as {
        places?: Array<{
          id?: string;
          name?: string;
          displayName?: { text?: string };
          formattedAddress?: string;
          websiteUri?: string;
        }>;
      };

      const places = data.places ?? [];
      return places.slice(0, limit).map((p) => ({
        id: p.name ?? p.id ?? '',
        name: p.displayName?.text ?? 'Unknown',
        address: p.formattedAddress ?? '',
        website: p.websiteUri,
      }));
    },

    async getPlaceDetails(placeId: string): Promise<{ website?: string }> {
      const shortId = placeId.replace(/^places\//, '');
      const url = `https://places.googleapis.com/v1/places/${shortId}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': DETAILS_FIELD_MASK,
        },
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Google Place details failed: ${res.status} ${err}`);
      }

      const data = (await res.json()) as { websiteUri?: string };
      return { website: data.websiteUri };
    },
  };
}

export type GooglePlacesClient = ReturnType<typeof createGooglePlacesClient>;
