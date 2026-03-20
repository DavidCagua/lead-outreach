import OpenAI from 'openai';
import type { Extracted } from '../types.js';

export async function runExtractionAgent(
  openai: OpenAI,
  websiteContent: string
): Promise<Extracted> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an expert at analyzing healthcare clinic websites. Extract structured information for sales outreach.

Return a JSON object with these exact keys:
- services: array of strings (medical services offered)
- has_online_booking: boolean
- clinic_size: "small" | "medium" | "large"
- pain_points: array of strings (business challenges, operational gaps)
- confidence: number between 0 and 1

Be concise. Use empty arrays if nothing found.`,
      },
      {
        role: 'user',
        content: `Extract clinic information from this website content:\n\n${websiteContent.slice(0, 15000)}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty extraction response');

  const parsed = JSON.parse(raw) as Record<string, unknown>;

  return {
    services: Array.isArray(parsed.services) ? parsed.services.map(String) : [],
    has_online_booking: Boolean(parsed.has_online_booking),
    clinic_size: ['small', 'medium', 'large'].includes(String(parsed.clinic_size))
      ? (parsed.clinic_size as Extracted['clinic_size'])
      : 'medium',
    pain_points: Array.isArray(parsed.pain_points) ? parsed.pain_points.map(String) : [],
    confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
  };
}
