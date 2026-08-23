/**
 * Stage 6 — Parts 11 + 12: Supabase production check & persistent cache test.
 *
 * Part 11 (read-only where possible): connection, required tables/columns,
 * row counts.
 *
 * Part 12 (persistent cache via enrichment_logs):
 *   Product A -> evidence -> cache write -> read back = HIT
 *   Same product again            -> HIT (no duplicate retrieval)
 *   Different MPN                 -> MISS
 *   Same MPN, different manufacturer -> MISS
 *   Negative entry                -> stored as null
 *
 * Credential honesty: the JWT payload's role is decoded locally (no network)
 * and reported. Writes require a true service_role key; with any other role
 * the round trip is reported BLOCKED, never faked. Cleanup touches ONLY rows
 * this script created.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { evidenceCacheKey, SupabaseEnrichmentLogsCache } from '../../lib/pipeline/orchestrator';
import { computeIdentity } from '../../lib/product-intelligence/identity';
import type { EvidenceServiceResponse } from '../../lib/evidence/client';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!url || !serviceKey) {
  console.error('Supabase URL/key not configured — cannot run production check.');
  process.exit(1);
}

/** Decode a JWT payload locally (structure only — no verification needed). */
function jwtRole(jwt: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString('utf-8'));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  console.log('\n=== SUPABASE PRODUCTION CHECK ===\n');

  const role = jwtRole(serviceKey);
  const isServiceRole = role === 'service_role' || serviceKey.startsWith('sb_secret_');
  console.log(`Connection:              ✓ (${isServiceRole ? 'service-role' : `key role="${role ?? 'unknown'}" — NOT service_role`})`);
  if (!isServiceRole) {
    console.log('');
    console.log('⚠️  The configured SUPABASE_SERVICE_ROLE_KEY does not carry the');
    console.log('   service_role role — writes are rejected by RLS (42501).');
    console.log('   Fix: Supabase Dashboard → Settings → API → copy the');
    console.log('   "service_role" secret (or new-format sb_secret_... key), then re-run.');
  }

  const supabase = createClient(url, serviceKey);

  // --- Required tables / columns ------------------------------------------
  const tables: Array<{ name: string; columns: string[] }> = [
    { name: 'items', columns: ['id', 'mfg_part_num', 'part_desc', 'manufacturer_name', 'status', 'batch_id'] },
    { name: 'item_descriptions', columns: ['item_id', 'field_name', 'value'] },
    { name: 'item_attributes', columns: ['item_id', 'seq', 'label', 'value'] },
    { name: 'item_specs', columns: ['item_id', 'upc', 'weight', 'warranty'] },
    { name: 'item_assets', columns: ['item_id', 'asset_type', 'url'] },
    { name: 'enrichment_logs', columns: ['id', 'item_id', 'step', 'status', 'input_json', 'output_json'] },
  ];

  let allTablesOk = true;
  for (const t of tables) {
    const { error, count } = await supabase.from(t.name).select('*', { count: 'exact', head: true });
    const exists = !error;
    allTablesOk = allTablesOk && exists;
    console.log(`Table ${t.name.padEnd(20)} ${exists ? '✓' : '✗ ' + error?.message} rows=${count ?? '?'}`);
    if (exists) {
      const { error: colErr } = await supabase.from(t.name).select(t.columns.join(',')).limit(1);
      console.log(`  columns (${t.columns.join(', ')}): ${colErr ? '✗ ' + colErr.message : '✓'}`);
      allTablesOk = allTablesOk && !colErr;
    }
  }

  // --- Persistent cache behavior (Part 12) ---------------------------------
  console.log('\n=== PERSISTENT CACHE VERIFICATION ===\n');

  const cache = new SupabaseEnrichmentLogsCache(supabase);

  const idA = computeIdentity({ manufacturer: 'Stage6 Probe Manufacturing', mpn: 'PRB-A-0001' });
  const idA2 = computeIdentity({ manufacturer: 'stage6 probe manufacturing', mpn: 'prb-a-0001' }); // same product, formatting variants
  const idB = computeIdentity({ manufacturer: 'Stage6 Probe Manufacturing', mpn: 'PRB-B-0002' }); // different MPN
  const idC = computeIdentity({ manufacturer: 'Other Vendor GmbH', mpn: 'PRB-A-0001' });        // different mfr

  const keyA = evidenceCacheKey(idA);
  const keyA2 = evidenceCacheKey(idA2);
  const keyB = evidenceCacheKey(idB);
  const keyC = evidenceCacheKey(idC);

  console.log(`Key formatting-invariance (same product): ${keyA === keyA2 ? '✓ identical' : '✗ differs'}`);
  console.log(`Different MPN => different key:           ${keyB !== keyA ? '✓' : '✗'}`);
  console.log(`Different manufacturer => different key:  ${keyC !== keyA ? '✓' : '✗'}`);
  const keysIsolated = keyA === keyA2 && keyB !== keyA && keyC !== keyA;

  let roundTrip = false;
  let blockedReason: string | null = isServiceRole ? null : `writes need service_role; provided key role="${role}"`;

  if (!blockedReason) {
    // Need a REAL items.id (enrichment_logs.item_id is UUID FK).
    const { data: item } = await supabase.from('items').select('id').limit(1).maybeSingle();
    if (!item) {
      blockedReason = 'items table empty — cannot attach probe rows';
    }
    if (!blockedReason) {
      const ctx = { itemId: item!.id };
      const sampleEvidence: EvidenceServiceResponse = {
        success: true,
        needs_search: true,
        source: null,
        identity_match: true,
        identity_confidence: 0.99,
        reject_reason: null,
        evidence: [],
        deterministic_fields: {
          weight: { value: 1.5, uom: 'kg', evidence: 'Weight: 1.5 kg', source_url: 'probe://x', confidence: 0.9 },
        },
        needs_gemini: [],
        unresolved: [],
      };

      await cache.set(keyA, sampleEvidence, ctx);
      const hit = await cache.get(keyA, ctx);
      console.log(`Product A after write:                    ${hit !== undefined && hit?.identity_match === true ? '✓ CACHE HIT' : '✗ MISS'}`);
      if (hit === undefined) {
        // Distinguish RLS vs schema-constraint causes for precise remediation.
        const probe = await supabase.from('enrichment_logs').insert({
          item_id: ctx.itemId,
          step: 'external_evidence',
          status: 'success',
          input_json: { _identity_key: keyA },
          output_json: { diagnostic: true },
        });
        if (probe.error?.message?.includes('enrichment_logs_step_check')) {
          blockedReason = 'step CHECK constraint rejects external_evidence — apply supabase/migrations/010_external_evidence_step.sql (SQL Editor), then re-run';
          console.log(`  ↳ cause: ${blockedReason}`);
        } else if (probe.error) {
          blockedReason = `insert rejected: ${probe.error.message}`;
          console.log(`  ↳ cause: ${blockedReason}`);
        }
      }

      if (!blockedReason) {
        const hit2 = await cache.get(keyA2, ctx);
        console.log('Product A again (formatting variants):    ' + (hit2 !== undefined && hit2?.identity_match ? '✓ CACHE HIT (no duplicate retrieval)' : '✗'));

        const missB = await cache.get(keyB, ctx);
        console.log(`Different MPN:                            ${missB === undefined ? '✓ CACHE MISS (isolated)' : '✗ CROSSED!'}`);

        const missC = await cache.get(keyC, ctx);
        console.log(`Different manufacturer, same MPN:         ${missC === undefined ? '✓ CACHE MISS (isolated)' : '✗ CROSSED!'}`);

        // Negative-cached entry semantics
        const idD = computeIdentity({ manufacturer: 'Stage6 Probe Manufacturing', mpn: 'PRB-D-0004' });
        await cache.set(evidenceCacheKey(idD), null, ctx);
        const negEntry = await cache.get(evidenceCacheKey(idD), ctx);
        console.log(`Negative entry stored (not-found):        ${negEntry === null ? '✓ null (searched, nothing found)' : negEntry === undefined ? '○ absent' : '✗ unexpected value'}`);

        // Cleanup ONLY our own probe rows on this item (per-key contains filter;
        // PostgREST has no OR'd jsonb .in() syntax).
        let cleaned = true;
        for (const k of [keyA, keyB, keyC, evidenceCacheKey(idD)]) {
          const del = await supabase
            .from('enrichment_logs')
            .delete()
            .eq('item_id', item!.id)
            .contains('input_json', { _identity_key: k });
          if (del.error) { cleaned = false; console.log(`Probe cleanup error: ${del.error.message}`); }
        }
        if (cleaned) console.log('Probe cleanup (own rows only):            ✓ removed');

        roundTrip =
          hit?.identity_match === true && hit2?.identity_match === true &&
          missB === undefined && missC === undefined && negEntry === null;
      }
    }
  }

  if (blockedReason) {
    console.log(`Round trip: BLOCKED — ${blockedReason}`);
    console.log('Offline proof of key isolation (same production code path): shown above.');
  }

  const cacheOk = keysIsolated && !blockedReason && roundTrip;

  console.log(`\nAll tables OK: ${allTablesOk} · Key isolation: ${keysIsolated ? 'PASS' : 'FAIL'} · Persistent-cache round trip: ${cacheOk ? 'PASS' : blockedReason ? `BLOCKED (${blockedReason})` : 'FAIL'}`);
  process.exitCode = allTablesOk && keysIsolated && cacheOk ? 0 : 1;
}

void main();
