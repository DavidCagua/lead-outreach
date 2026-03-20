import OpenAI from 'openai';
import type { Extracted } from '../types.js';
import type { Score } from '../types.js';

export async function runScoringAgent(
  openai: OpenAI,
  extracted: Extracted,
  clinicName: string
): Promise<Score> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You score clinic leads for B2B software sales outreach. Consider: pain points, clinic size, online booking status, service diversity.

Return JSON:
- score: number 1-10 (10 = ideal lead: clear pain points, medium/large, no online booking)
- priority: "low" | "medium" | "high"
- reason: brief explanation
- confidence: number 0-1`,
      },
      {
        role: 'user',
        content: `Score this lead:\n\nClinic: ${clinicName}\n${JSON.stringify(extracted, null, 2)}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty scoring response');

  const parsed = JSON.parse(raw) as Record<string, unknown>;

  const scoreNum = typeof parsed.score === 'number'
    ? Math.max(1, Math.min(10, Math.round(parsed.score)))
    : 5;

  return {
    score: scoreNum,
    priority: ['low', 'medium', 'high'].includes(String(parsed.priority))
      ? (parsed.priority as Score['priority'])
      : 'medium',
    reason: String(parsed.reason ?? 'No reason provided'),
    confidence: typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5,
  };
}
