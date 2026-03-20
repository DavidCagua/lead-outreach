import OpenAI from 'openai';
import { fallbackRefineQuery } from '../orchestrator/refinement.js';

const MAX_EXPAND_QUERIES = 3;

export interface PreviousResultsSummary {
  avgScore: number;
  goodCount: number;
  badCount: number;
  goodLeadsSummary: Array<{
    name: string;
    score: number;
    services: string[];
    painPoints: string[];
  }>;
  badLeadsSummary: Array<{ name: string; failureReason?: string }>;
  commonIssues: string[];
}

/**
 * Expand the original query into 2-3 variations for Google Places search.
 * Used for Attempt 1 only - increases recall, explores search space.
 * Returns max 3 queries, deduplicated. On LLM failure, returns [originalQuery].
 */
export async function expandQuery(
  openai: OpenAI,
  originalQuery: string
): Promise<string[]> {
  const trimmed = originalQuery.trim();
  if (!trimmed) return [originalQuery];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You generate Google Places search queries to find healthcare/dental clinics for B2B sales outreach.
Given a user query, return 2-3 alternative search phrases (synonyms, related terms, different phrasings) that would help discover more clinics.
Return JSON: { "queries": ["query1", "query2", "query3"] }
Each query must be a complete search string (e.g. "dental clinics Austin TX", "dentists Austin", "family dentistry Austin").`,
        },
        {
          role: 'user',
          content: `Generate 2-3 search query variations for: "${trimmed}"`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return [trimmed];

    const parsed = JSON.parse(raw) as { queries?: unknown };
    const queries = Array.isArray(parsed.queries)
      ? parsed.queries.map(String).filter((q) => q.trim().length > 0)
      : [];

    if (queries.length === 0) return [trimmed];

    const deduped = [...new Set(queries)].slice(0, MAX_EXPAND_QUERIES);
    return deduped.length > 0 ? deduped : [trimmed];
  } catch (err) {
    console.warn('[refinementAgent] expandQuery failed, using original:', err);
    return [trimmed];
  }
}

/**
 * Refine the search query based on previous results.
 * Used for Attempts 2-3 only - feedback-driven single query.
 * On LLM failure, uses deterministic fallbackRefineQuery.
 */
export async function refineQueryLLM(
  openai: OpenAI,
  params: {
    originalQuery: string;
    attempt: number;
    previousResultsSummary: PreviousResultsSummary;
  }
): Promise<string> {
  const { originalQuery, attempt, previousResultsSummary } = params;

  try {
    const summaryJson = JSON.stringify(previousResultsSummary, null, 2);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You help refine Google Places search queries for finding clinic leads for B2B sales outreach.
You receive a summary of previous search results: good leads (high score, useful for outreach) and bad leads (low score or failures).
Return a SINGLE refined Google Places search query that would find more clinics LIKE the good ones and AVOID patterns that produced bad leads.
Return JSON: { "query": "your single search query string" }
The query must be a complete search string suitable for Google Places text search.`,
        },
        {
          role: 'user',
          content: `Original query: "${originalQuery}"
Attempt: ${attempt}

Previous results summary:
${summaryJson}

Suggest ONE refined search query to find more high-quality clinic leads.`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return fallbackRefineQuery(originalQuery, attempt);

    const parsed = JSON.parse(raw) as { query?: unknown };
    const query =
      typeof parsed.query === 'string' && parsed.query.trim().length > 0
        ? parsed.query.trim()
        : null;

    if (query) return query;
    return fallbackRefineQuery(originalQuery, attempt);
  } catch (err) {
    console.warn('[refinementAgent] refineQueryLLM failed, using fallback:', err);
    return fallbackRefineQuery(originalQuery, attempt);
  }
}
