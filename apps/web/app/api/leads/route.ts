import { NextResponse } from 'next/server';
import { leadStore } from '@/lib/core';

export async function GET() {
  try {
    const leads = await leadStore.list();
    return NextResponse.json(leads);
  } catch (err) {
    console.error('Get leads error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}
