import { NextResponse } from 'next/server';
import { refinementStatusStore } from '@/lib/core';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');

    if (!campaignId) {
      return NextResponse.json(null);
    }

    const status = await refinementStatusStore.get(campaignId);
    return NextResponse.json(status);
  } catch (err) {
    console.error('Refinement status error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}
