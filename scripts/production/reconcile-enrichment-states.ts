/**
 * Stage 6 bug-fix (BUG 2): reconcile stale enrichment states.
 *
 * Classification per item:
 *   ACTIVE          status='enriching' and updated recently (< threshold)
 *   STALE           status='enriching' but job is gone/old -> becomes FAILED
 *   VALID_ENRICHED  status='enriched' with critical fields present
 *   VALID_REVIEW    status='review'
 *   INVALID         enriched item missing critical fields (reported, only
 *                   downgraded with --apply)
 *
 * Dry-run by default. Pass --apply to write changes.
 * Never restarts AI work automatically.
 *
 * Usage:
 *   npx tsx scripts/production/reconcile-enrichment-states.ts [--apply] [--stale-minutes=10]
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const staleMinArg = process.argv.find((a) => a.startsWith('--stale-minutes='));

function parseStaleMinutes(): number {
  if (!staleMinArg) return 10;
  const v = parseInt(staleMinArg.split('=')[1], 10);
  return Number.isFinite(v) && v > 0 ? v : 10;
}

const STALE_MINUTES = parseStaleMinutes();

const CRITICAL_FIELDS = ['manufacturer_name', 'brand_name', 'classpath'] as const;

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Supabase not configured');
    process.exit(1);
  }
  const sb = createClient(url, key);

  console.log(`\n=== ENRICHMENT STATE RECONCILIATION (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);
  console.log(`Stale threshold: ${STALE_MINUTES} min\n`);

  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  const counts: Record<string, number> = {
    ACTIVE: 0, STALE: 0, VALID_ENRICHED: 0, VALID_REVIEW: 0, INVALID: 0,
  };
  const changes: Array<{ id: string; mpn: string; from: string; to: string; failed_step: string; reason: string }> = [];

  // ---- enriching rows -----------------------------------------------------
  const { data: enriching, error } = await sb
    .from('items')
    .select('id, mfg_part_num, status, updated_at')
    .eq('status', 'enriching');

  if (error) {
    console.error('query failed:', error.message);
    process.exit(1);
  }

  for (const it of enriching ?? []) {
    const isStale = it.updated_at < cutoff;

    if (!isStale) {
      counts.ACTIVE++;
      continue;
    }

    // Inspect logs: last event for this item
    const { data: logs } = await sb
      .from('enrichment_logs')
      .select('step, status, created_at')
      .eq('item_id', it.id)
      .order('created_at', { ascending: false })
      .limit(20);

    const lastLog = logs?.[0];
    let failedStep = 'unknown';
    let reason: string;

    if (!lastLog) {
      reason = `no enrichment_logs entries; enriching since ${it.updated_at}`;
    } else if (lastLog.status === 'error') {
      failedStep = lastLog.step;
      reason = `last log entry was an error in "${lastLog.step}" at ${lastLog.created_at}`;
    } else {
      // Last entry is a success but the job never finished the chain — infer
      // the step AFTER the last successful one as the likely stuck point.
      const ORDER = ['manufacturer', 'classify', 'external_evidence', 'attributes', 'descriptions', 'specs'];
      const doneSteps = new Set((logs ?? []).filter((l: any) => l.status === 'success').map((l: any) => l.step));
      const nextIdx = ORDER.findIndex((s) => !doneSteps.has(s));
      failedStep = nextIdx === -1 ? 'finalize' : ORDER[nextIdx];
      reason = `stale: last activity ${it.updated_at}; completed steps=[${[...doneSteps].join(',') || 'none'}]`;
    }

    counts.STALE++;
    changes.push({
      id: it.id, mpn: it.mfg_part_num, from: 'enriching',
      to: 'failed', failed_step: failedStep,
      reason: `${reason} → marking failed (retryable via Clean)`,
    });
  }

  // ---- enriched / review sanity --------------------------------------------
  const { data: others } = await sb
    .from('items')
    .select('id, mfg_part_num, status, manufacturer_name, brand_name, classpath')
    .in('status', ['enriched', 'review']);

  for (const it of others ?? []) {
    if (it.status === 'enriched') {
      const hasCritical = CRITICAL_FIELDS.every((f) => (it as any)[f]);
      if (hasCritical) counts.VALID_ENRICHED++;
      else {
        counts.INVALID++;
        changes.push({
          id: it.id, mpn: it.mfg_part_num, from: 'enriched',
          to: 'review', failed_step: '',
          reason: 'marked enriched but missing critical fields (manufacturer/brand/classpath)',
        });
      }
    } else {
      counts.VALID_REVIEW++;
    }
  }

  console.log('Classification:');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(14)} ${v}`);

  if (changes.length > 0) {
    console.log('\nProposed changes:');
    for (const c of changes) {
      console.log(`  ${c.mpn} [${c.id.slice(0, 8)}] ${c.from} → ${c.to}` +
        (c.failed_step ? ` (failed_step=${c.failed_step})` : '') + `\n     ${c.reason}`);
    }
  } else {
    console.log('\nNo state corrections needed.');
  }

  if (APPLY && changes.length > 0) {
    let migrationMissing = false;
    for (const c of changes) {
      const patch: Record<string, unknown> = { status: c.to, updated_at: new Date().toISOString() };
      if (c.to === 'failed') {
        patch.failed_step = c.failed_step || 'unknown';
        patch.failed_error = c.reason.slice(0, 500);
      }
      const { error } = await sb.from('items').update(patch).eq('id', c.id);
      if (error && /failed_error|failed_step|status_check/i.test(error.message)) {
        // Pre-migration fallback: 010-style schema not applied yet.
        // Stale jobs with NO log entries never started -> truthful state is raw (retryable).
        migrationMissing = true;
        const hadLogs = !c.reason.includes('no enrichment_logs entries');
        const fallbackStatus = hadLogs ? 'review' : 'raw';
        const { error: fbErr } = await sb.from('items').update({ status: fallbackStatus, updated_at: new Date().toISOString() }).eq('id', c.id);
        console.log(`  ↳ ${c.mpn}: 011 pending — fell back to '${fallbackStatus}' ${fbErr ? '(' + fbErr.message + ')' : '✓'}`);
      } else if (error) {
        console.error(`  ✗ ${c.mpn}: ${error.message}`);
      }
    }
    if (migrationMissing) {
      console.log('\n⚠️  supabase/migrations/011_failed_status.sql not applied yet —');
      console.log('   run its SQL in Supabase SQL Editor for full failed-state support.');
    } else {
      console.log(`\nApplied ${changes.length} correction(s).`);
    }
  } else if (!APPLY && changes.length > 0) {
    console.log(`\nDry-run: re-run with --apply to write ${changes.length} correction(s).`);
  }

  process.exitCode = 0;
}

void main();
