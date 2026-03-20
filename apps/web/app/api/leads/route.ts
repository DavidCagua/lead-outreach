import { NextResponse } from 'next/server';
import { leadStore, campaignStore } from '@/lib/core';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');

    if (!campaignId) {
      return NextResponse.json({
        leads: [],
        stats: { total: 0, completed: 0, processing: 0, failed: 0 },
        campaignStatus: null,
      });
    }

    const exists = await campaignStore.exists(campaignId);
    if (!exists) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    const [campaign, leads, stats] = await Promise.all([
      campaignStore.get(campaignId),
      leadStore.listByCampaign(campaignId),
      leadStore.getCampaignStats(campaignId),
    ]);

    return NextResponse.json({
      leads,
      stats,
      campaignStatus: campaign?.status ?? 'running',
    });
  } catch (err) {
    console.error('Get leads error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}
