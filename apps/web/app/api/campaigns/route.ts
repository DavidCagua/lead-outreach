import { NextResponse } from 'next/server';
import { campaignStore } from '@/lib/core';

export async function GET() {
  try {
    const campaigns = await campaignStore.list();
    return NextResponse.json(
      campaigns.map((c) => ({ id: c.id, query: c.query, status: c.status }))
    );
  } catch (err) {
    console.error('Get campaigns error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}
