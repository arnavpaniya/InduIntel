import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const DAILY_QUOTA_LIMIT = parseInt(process.env.DAILY_QUOTA_LIMIT || '18', 10); // Safety margin under 20
const DEFAULT_BATCH_LIMIT = 3; // Quota-safe default

async function checkAndIncrementQuota(supabase: any): Promise<{ allowed: boolean; currentCount: number }> {
  const today = new Date().toISOString().split('T')[0];
  
  // Get current count for today
  const { data: existing, error: selectError } = await supabase
    .from('gemini_usage_log')
    .select('request_count')
    .eq('request_date', today)
    .maybeSingle();
  
  if (selectError) {
    console.error('[QUOTA] Error checking quota:', selectError.message);
    return { allowed: true, currentCount: 0 }; // Fail open
  }
  
  const currentCount = existing?.request_count || 0;
  
  if (currentCount >= DAILY_QUOTA_LIMIT) {
    console.log(`[QUOTA] Daily limit reached: ${currentCount}/${DAILY_QUOTA_LIMIT}`);
    return { allowed: false, currentCount };
  }
  
  // Increment counter
  const { error: upsertError } = await supabase
    .from('gemini_usage_log')
    .upsert(
      { request_date: today, request_count: currentCount + 1 },
      { onConflict: 'request_date' }
    );
  
  if (upsertError) {
    console.error('[QUOTA] Error incrementing quota:', upsertError.message);
  }
  
  return { allowed: true, currentCount: currentCount + 1 };
}

export async function POST(request: NextRequest) {
  try {
    const { limit = DEFAULT_BATCH_LIMIT } = await request.json();
    const supabase = await createServerSupabaseClient();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    console.log('[BATCH] Starting batch enrichment with limit:', limit, 'quota limit:', DAILY_QUOTA_LIMIT);

    // Check quota before starting
    const quotaCheck = await checkAndIncrementQuota(supabaseAdmin);
    if (!quotaCheck.allowed) {
      return NextResponse.json({ 
        error: 'Daily quota exceeded', 
        quota_used: quotaCheck.currentCount,
        quota_limit: DAILY_QUOTA_LIMIT,
        processed: 0,
        skipped_due_to_quota: limit
      }, { status: 429 });
    }

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
    let quotaSkipped = 0;
    const results: any[] = [];

    for (const item of rawItems) {
      // Check quota before each item (each item = 5 requests)
      const quotaCheck = await checkAndIncrementQuota(supabaseAdmin);
      if (!quotaCheck.allowed) {
        quotaSkipped++;
        console.log(`[BATCH] Skipping ${item.mfg_part_num} due to quota limit`);
        results.push({ 
          item_id: item.id, 
          mfg_part_num: item.mfg_part_num, 
          skipped: true, 
          reason: 'quota_exceeded' 
        });
        continue;
      }

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

    const avgConfidence = results.filter(r => !r.skipped).length > 0 
      ? Math.round(totalConfidence / results.filter(r => !r.skipped).length) 
      : 0;

    const summary = {
      processed: results.filter(r => !r.skipped).length,
      enriched,
      needs_review: needsReview,
      avg_confidence: avgConfidence,
      quota_used: quotaCheck.currentCount,
      quota_limit: DAILY_QUOTA_LIMIT,
      skipped_due_to_quota: quotaSkipped,
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