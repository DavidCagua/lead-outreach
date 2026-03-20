import { NextResponse } from 'next/server';
import { leadStore, leadProcessingQueue } from '@/lib/core';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const leadIds = Array.isArray(body?.leadIds)
      ? body.leadIds.filter((id: unknown) => typeof id === 'string')
      : typeof body?.leadId === 'string'
        ? [body.leadId]
        : [];
    const campaignId = typeof body?.campaignId === 'string' ? body.campaignId : undefined;

    if (leadIds.length === 0) {
      return NextResponse.json(
        { error: 'leadIds or leadId required' },
        { status: 400 }
      );
    }

    const jobIds: string[] = [];

    for (const leadId of leadIds) {
      const lead = await leadStore.get(leadId);
      if (!lead) continue;
      if (campaignId && lead.campaignId !== campaignId) continue;

      // Only retry failed or pending (stuck) leads
      if (lead.status !== 'failed' && lead.status !== 'pending') continue;

      // Reset to pending so worker processes from scratch
      await leadStore.update(leadId, {
        status: 'pending',
        failureReason: undefined,
        extracted: undefined,
        score: undefined,
        outreach: undefined,
      });

      const job = await leadProcessingQueue.add('process', {
        leadId,
        campaignId: lead.campaignId,
      });
      jobIds.push(job.id ?? leadId);
    }

    return NextResponse.json({
      jobIds,
      message: `Re-enqueued ${jobIds.length} lead(s) for processing`,
    });
  } catch (err) {
    console.error('Retry leads error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Retry failed' },
      { status: 500 }
    );
  }
}
