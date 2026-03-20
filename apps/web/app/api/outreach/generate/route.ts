import { NextResponse } from 'next/server';
import { leadStore, outreachQueue } from '@/lib/core';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const leadIds = body?.leadIds;
    const campaignId = typeof body?.campaignId === 'string' ? body.campaignId : undefined;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: 'leadIds must be a non-empty array' },
        { status: 400 }
      );
    }

    const jobIds: string[] = [];

    for (const leadId of leadIds) {
      if (typeof leadId !== 'string') continue;

      const lead = await leadStore.get(leadId);
      if (!lead || lead.status !== 'completed' || !lead.score || lead.score.score < 5) {
        continue;
      }
      if (campaignId && lead.campaignId !== campaignId) continue;

      const job = await outreachQueue.add('generate', { leadId });
      jobIds.push(job.id ?? leadId);
    }

    return NextResponse.json({
      jobIds,
      message: `Enqueued ${jobIds.length} outreach jobs`,
    });
  } catch (err) {
    console.error('Outreach generate error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate outreach' },
      { status: 500 }
    );
  }
}
