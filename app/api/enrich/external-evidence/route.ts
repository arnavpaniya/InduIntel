import { NextRequest, NextResponse } from 'next/server';
import { runExternalEvidenceStep } from '@/lib/enrichment/steps';

/** Thin wrapper — implementation lives in lib/enrichment/steps.ts */
export async function POST(request: NextRequest) {
  try {
    const { item_id } = await request.json();
    if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 });
    const result = await runExternalEvidenceStep(item_id);
    return NextResponse.json(
      { success: result.success, ...(result.data as object ?? {}), error: result.error ?? null },
      { status: 200 },
    );
  } catch (error) {
    // Never crash the enrichment pipeline on external-evidence failure
    return NextResponse.json({
      success: false,
      error: 'External evidence enrichment error',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
