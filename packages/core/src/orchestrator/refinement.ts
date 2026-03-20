import type { Lead } from '../types.js';

/** Minimum confidence to consider a lead good quality */
const MIN_CONFIDENCE = 0.6;

/** Minimum score to consider a lead good quality */
const MIN_SCORE = 9;

/** Quality signals for attempt 2 - broader, higher-quality results */
const QUALITY_SIGNALS = ['modern', 'top rated', 'cosmetic', 'advanced'];

/** Niche refinements for attempt 3 - narrower, specialist focus */
const NICHE_REFINEMENTS = [
  'cosmetic dentistry',
  'implant specialist',
  'family dental clinic',
];

/**
 * Refines the search query for iterative lead discovery.
 * Attempt 1: original query
 * Attempt 2: add quality signals
 * Attempt 3: narrow to niche
 */
export function refineQuery(originalQuery: string, attempt: number): string {
  const trimmed = originalQuery.trim();
  if (attempt === 1) return trimmed;
  if (attempt === 2) {
    const signal = QUALITY_SIGNALS[(attempt - 1) % QUALITY_SIGNALS.length];
    return `${signal} ${trimmed}`;
  }
  if (attempt >= 3) {
    const niche = NICHE_REFINEMENTS[(attempt - 1) % NICHE_REFINEMENTS.length];
    return `${niche} ${trimmed}`;
  }
  return trimmed;
}

/**
 * A lead is good quality if it has:
 * - extracted.confidence >= 0.6
 * - score.score >= 5
 * - critical fields present (services, non-empty content)
 */
export function isGoodLead(lead: Lead): boolean {
  if (!lead.extracted || !lead.score) return false;
  if (lead.extracted.confidence < MIN_CONFIDENCE) return false;
  if (lead.score.score < MIN_SCORE) return false;
  if (!lead.extracted.services?.length) return false;
  return true;
}

/**
 * A lead is low quality if it fails any good-lead criterion:
 * - extracted.confidence < 0.6
 * - score.score < 5
 * - missing services OR empty content
 */
export function isBadLead(lead: Lead): boolean {
  if (lead.status !== 'completed') return true;
  return !isGoodLead(lead);
}
