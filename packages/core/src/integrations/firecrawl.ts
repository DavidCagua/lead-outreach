import FirecrawlApp from '@mendable/firecrawl-js';

const CRAWL_LIMIT = 10;
const CRAWL_POLL_INTERVAL = 2;
const RATE_LIMIT_MAX_RETRIES = 5;

/** Parse "retry after Xs" from Firecrawl 429 error message. Returns ms to wait, or 10000 default. */
function parseRetryAfterMs(error: unknown): number {
  const msg = error instanceof Error ? error.message : String(error);
  const match = msg.match(/retry\s+after\s+(\d+)\s*s/i);
  if (match) return parseInt(match[1], 10) * 1000;
  return 10000; // default 10s
}

function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('429') || msg.toLowerCase().includes('rate limit');
}

async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < RATE_LIMIT_MAX_RETRIES && isRateLimitError(err)) {
        const waitMs = parseRetryAfterMs(err);
        console.warn(`[firecrawl] Rate limited (429), waiting ${waitMs / 1000}s before retry ${attempt + 1}/${RATE_LIMIT_MAX_RETRIES}`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export function createFirecrawlClient(apiKey: string) {
  const firecrawl = new FirecrawlApp({
    apiKey: apiKey || process.env.FIRECRAWL_API_KEY || '',
  });

  return {
    /**
     * Crawl a website (multiple pages) for richer, higher-confidence content.
     * Uses Firecrawl crawl API - better results than single-page scrape.
     * Retries on 429 rate limit (waits per API "retry after Xs" hint).
     */
    async crawl(url: string): Promise<string> {
      return withRateLimitRetry(async () => {
      const result = (await firecrawl.crawlUrl(url, {
        limit: CRAWL_LIMIT,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
        },
      }, CRAWL_POLL_INTERVAL)) as {
        success?: boolean;
        error?: string;
        status?: string;
        data?: Array<{ markdown?: string; html?: string }>;
      };

      if (result.error || !result.success) {
        throw new Error(result.error ?? 'Firecrawl crawl failed');
      }

      const data = result.data ?? [];
      const parts = data
        .map((doc) => doc.markdown ?? doc.html ?? '')
        .filter((s) => s && s.trim().length > 0);

      const content = parts.join('\n\n---\n\n').trim();
      if (!content || content.length < 50) {
        throw new Error(`Firecrawl crawl returned insufficient content (${content.length} chars)`);
      }

      return content;
      });
    },

    /** @deprecated Use crawl() for better results. Kept for fallback. */
    async scrape(url: string): Promise<string> {
      return withRateLimitRetry(async () => {
      const result = await firecrawl.scrapeUrl(url, {
        formats: ['markdown'],
        onlyMainContent: true,
      }) as { success?: boolean; error?: string; markdown?: string; html?: string };

      if (result.error || !result.success) {
        throw new Error(result.error ?? 'Firecrawl scrape failed');
      }

      const content = result.markdown ?? result.html ?? '';
      if (!content || content.trim().length < 50) {
        throw new Error('Firecrawl returned no content');
      }

      return content;
      });
    },
  };
}

export type FirecrawlClient = ReturnType<typeof createFirecrawlClient>;
