import { NextResponse } from 'next/server';
import { refinementStatusStore } from '@/lib/core';

export async function GET() {
  try {
    const status = await refinementStatusStore.get();
    return NextResponse.json(status);
  } catch (err) {
    console.error('Refinement status error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}
