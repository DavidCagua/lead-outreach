import OpenAI from 'openai';
import type { Outreach } from '../types.js';

export interface OutreachInput {
  clinic_name: string;
  services: string[];
  pain_points: string[];
  has_online_booking: boolean;
  score: number;
}

export async function runOutreachAgent(
  openai: OpenAI,
  input: OutreachInput
): Promise<Outreach> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You write personalized B2B cold emails for clinic outreach. Be professional, concise, and reference their specific pain points. No generic fluff.

Return JSON:
- subject: email subject line
- body: email body (2-4 short paragraphs, personalized)`,
      },
      {
        role: 'user',
        content: `Write outreach email for:\n\n${JSON.stringify(input, null, 2)}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty outreach response');

  const parsed = JSON.parse(raw) as Record<string, unknown>;

  return {
    subject: String(parsed.subject ?? 'Partnership opportunity'),
    body: String(parsed.body ?? ''),
  };
}
