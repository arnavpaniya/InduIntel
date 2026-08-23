/**
 * GET /api/usage — REAL Gemini usage status for the frontend.
 *
 * Source of truth:
 * - `gemini_usage_log.request_count` for TODAY (incremented by the batch
 *   enrichment route whenever LLM work is performed)
 * - `DAILY_QUOTA_LIMIT` env (mirrors app/api/enrich/batch/route.ts default)
 * - deterministic-completion counter derived from persisted external-evidence
 *   cache rows (identity-matched products whose needs_gemini list was empty —
 *   i.e., completed without any LLM call)
 *
 * Never fabricates numbers: when a value cannot be determined it is null and
 * the frontend renders an explicit unavailable state.
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const DAILY_QUOTA_LIMIT = parseInt(process.env.DAILY_QUOTA_LIMIT || '18', 10);

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const today = new Date().toISOString().slice(0, 10);

    // --- Real used-today count -------------------------------------------
    const { data: usageRow, error: usageError } = await supabase
      .from('gemini_usage_log')
      .select('request_count')
      .eq('request_date', today)
      .maybeSingle();

    if (usageError) {
      return NextResponse.json(
        { available: false, error: 'usage log unreadable' },
        { status: 200 },
      );
    }

    const used = typeof usageRow?.request_count === 'number' ? usageRow.request_count : 0;
    const limit = Number.isFinite(DAILY_QUOTA_LIMIT) && DAILY_QUOTA_LIMIT > 0 ? DAILY_QUOTA_LIMIT : null;
    const remaining = limit != null ? Math.max(0, limit - used) : null;
    const near_limit = remaining != null ? remaining <= Math.ceil(limit! * 0.1) : false;

    // --- Deterministic completions (Gemini calls avoided), persisted -------
    let gemini_calls_avoided: number | null = null;
    try {
      const { count } = await supabase
        .from('enrichment_logs')
        .select('id', { count: 'exact', head: true })
        .eq('step', 'external_evidence')
        .eq('status', 'success')
        .contains('output_json', { identity_match: true });
      if (typeof count === 'number') {
        // Of those, count rows whose needs_gemini array was empty -> zero-call runs
        const { data: rows } = await supabase
          .from('enrichment_logs')
          .select('output_json')
          .eq('step', 'external_evidence')
          .eq('status', 'success')
          .limit(1000);
        gemini_calls_avoided = (rows ?? []).filter(
          (r: any) =>
            r?.output_json?.identity_match === true &&
            Array.isArray(r.output_json.needs_gemini) &&
            r.output_json.needs_gemini.length === 0,
        ).length;
      }
    } catch {
      gemini_calls_avoided = null; // metric unavailable — never guessed
    }

    return NextResponse.json({
      available: true,
      date: today,
      used,
      limit,
      remaining,
      near_limit,
      gemini_calls_avoided,
    });
  } catch {
    return NextResponse.json({ available: false }, { status: 200 });
  }
}
