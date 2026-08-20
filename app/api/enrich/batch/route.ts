import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { limit = 10 } = await request.json();
    const supabase = await createServerSupabaseClient();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    console.log('[BATCH] Starting batch enrichment with limit:', limit);

    const { data: rawItems, error } = await supabase
      .from('items')
      .select('id, mfg_part_num, status')
      .eq('status', 'raw')
      .limit(limit);

    if (error) {
      console.error('[BATCH] Error fetching raw items:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!rawItems || rawItems.length === 0) {
      console.log('[BATCH] No raw items to process');
      return NextResponse.json({ message: 'No raw items to process', summary: { processed: 0, enriched: 0, needs_review: 0, avg_confidence: 0 } });
    }

    console.log('[BATCH] Found items to process:', rawItems.map(i => i.mfg_part_num).join(', '));

    let enriched = 0;
    let needsReview = 0;
    let totalConfidence = 0;
    const results: any[] = [];

    for (const item of rawItems) {
      try {
        console.log(`[BATCH] Processing item: ${item.mfg_part_num} (${item.id})`);
        const response = await fetch(`${baseUrl}/api/enrich/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: item.id }),
        });

        const result = await response.json();
        results.push({ item_id: item.id, mfg_part_num: item.mfg_part_num, ...result });

        if (result.status === 'enriched') {
          enriched++;
        } else if (result.status === 'review') {
          needsReview++;
        }
        totalConfidence += result.confidence_score || 0;
        console.log(`[BATCH] Item ${item.mfg_part_num} result: status=${result.status}, confidence=${result.confidence_score}`);
        
        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 1000));
      } catch (error) {
        console.error(`[BATCH] Item ${item.mfg_part_num} exception:`, error);
        results.push({ item_id: item.id, mfg_part_num: item.mfg_part_num, success: false, error: String(error) });
      }
    }

    const avgConfidence = results.length > 0 ? Math.round(totalConfidence / results.length) : 0;

    const summary = {
      processed: results.length,
      enriched,
      needs_review: needsReview,
      avg_confidence: avgConfidence,
    };

    console.log('[BATCH] Summary:', JSON.stringify(summary, null, 2));

    await supabaseAdmin.from('enrichment_logs').insert({
      item_id: null,
      step: 'batch',
      status: 'success',
      input_json: { limit, item_ids: rawItems.map(i => i.id) },
      output_json: { summary, results },
      duration_ms: 0,
    });

    return NextResponse.json({ success: true, summary, results });
  } catch (error) {
    console.error('Batch enrichment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}