import { NextResponse } from 'next/server';
import { leadStore, outreachQueue } from '@/lib/core';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const leadId = body?.leadId;

    if (typeof leadId !== 'string' || !leadId) {
      return NextResponse.json(
        { error: 'leadId is required' },
        { status: 400 }
      );
    }

    const lead = await leadStore.get(leadId);
    if (!lead || lead.status !== 'completed' || !lead.score || lead.score.score < 5) {
      return NextResponse.json(
        { error: 'Lead not found or not eligible for outreach' },
        { status: 400 }
      );
    }

    const job = await outreachQueue.add('generate', { leadId });

    return NextResponse.json({
      jobId: job.id,
      message: 'Outreach regeneration enqueued',
    });
  } catch (err) {
    console.error('Outreach regenerate error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to regenerate outreach' },
      { status: 500 }
    );
  }
}
