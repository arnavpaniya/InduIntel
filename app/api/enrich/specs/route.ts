import { NextRequest, NextResponse } from 'next/server';
import { runSpecsStep } from '@/lib/enrichment/steps';

/** Thin wrapper — implementation lives in lib/enrichment/steps.ts */
export async function POST(request: NextRequest) {
  try {
    const { item_id } = await request.json();
    if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 });
    const result = await runSpecsStep(item_id);
    return NextResponse.json(
      { success: result.success, data: result.data, cached: result.cached, error: result.error ?? null, item: result.item },
      { status: result.success ? 200 : 500 },
    );
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
