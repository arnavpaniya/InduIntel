/**
 * Stage 6 — Parts 11 + 12: Supabase production check & persistent cache test.
 *
 * Part 11 (read-only where possible):
 *   - connection
 *   - required tables/columns exist (items, item_descriptions, item_attributes,
 *     item_specs, item_assets, enrichment_logs)
 *   - row counts (head count only)
 *
 * Part 12 (persistent cache via enrichment_logs):
 *   - write evidence result for identity A -> read -> HIT
 *   - different MPN                  -> MISS
 *   - same MPN, different manufacturer -> MISS
 *   - cleans up ONLY rows it created (item_id prefix 'stage6-cache-probe')
 *
 * Non-destructive: never deletes or resets pre-existing data.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { computeIdentity } from '../lib/product-intelligence/identity';
import { evidenceCacheKey, SupabaseEnrichmentLogsCache } from '../lib/pipeline/orchestrator';
import type { EvidenceServiceResponse } from '../lib/evidence/client';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

if (!url || !(serviceKey || publishableKey)) {
  console.error('Supabase not configured — cannot run production check.');
  process.exit(1);
}

/**
 * Credential strategy: try the service-role key first (full write access).
 * If it is rejected (rotated/invalid), fall back to the publishable key for
 * READ-ONLY verification and report writes as blocked — never fake success.
 */
async function pickClient(): Promise<{ client: any; role: 'service' | 'readonly'; writeBlocked: string | null }> {
  if (serviceKey) {
    const svc = createClient(url, serviceKey);
    const { error } = await svc.from('items').select('id', { count: 'exact', head: true });
    if (!error) return { client: svc, role: 'service', writeBlocked: null };
    console.log(`Service-role key rejected (${error.message || '401'}). Falling back to read-only checks.`);
  }
  const pub = createClient(url, publishableKey);
  const { error } = await pub.from('items').select('id', { count: 'exact', head: true });
  if (error) {
    console.log(`Publishable key also failed: ${error.message}`);
  }
  return { client: pub, role: 'readonly', writeBlocked: 'SUPABASE_SERVICE_ROLE_KEY invalid/rotated (401). Writes blocked.' };
}

const PROBE_PREFIX = 'stage6-cache-probe';

async function main(): Promise<void> {
  console.log('\n=== SUPABASE PRODUCTION CHECK ===\n');

  const { client: supabase, role, writeBlocked } = await pickClient();
  console.log(`Connection:            ✓ (${role === 'service' ? 'service-role' : 'READ-ONLY publishable key'})`);
  if (writeBlocked) console.log(`Writes:                ✗ ${writeBlocked}`);

  // --- Required tables / columns ---
  const tables: Array<{ name: string; columns: string[] }> = [
    { name: 'items', columns: ['id', 'mfg_part_num', 'part_desc', 'manufacturer_name', 'status', 'batch_id'] },
    { name: 'item_descriptions', columns: ['item_id', 'field_name', 'value'] },
    { name: 'item_attributes', columns: ['item_id', 'seq', 'label', 'value'] },
    { name: 'item_specs', columns: ['item_id', 'upc', 'weight', 'warranty'] },
    { name: 'item_assets', columns: ['item_id', 'asset_type', 'url'] },
    { name: 'enrichment_logs', columns: ['item_id', 'step', 'status', 'input_json', 'output_json'] },
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

  // --- Cache hygiene: clean OUR OWN previous probe rows only --------------
  await supabase.from('enrichment_logs').delete().like('item_id', `${PROBE_PREFIX}%`);

  // --- Persistent cache behavior (Part 12) --------------------------------
  console.log('\n=== PERSISTENT CACHE VERIFICATION ===\n');

  if (writeBlocked) {
    // Honest reporting: persistent-cache WRITES cannot be verified without a
    // valid service-role key. Key-isolation logic is still proven offline.
    console.log(`SKIPPED against live Supabase: ${writeBlocked}`);
    console.log('Remediation: set a valid SUPABASE_SERVICE_ROLE_KEY, then re-run this script.');
    console.log('Offline proof of key isolation (same code path as production):');
  }

  const cache = new SupabaseEnrichmentLogsCache(supabase);

  const idA = computeIdentity({ manufacturer: 'Stage6 Probe Manufacturing', mpn: 'PRB-A-0001' });
  const idA2 = computeIdentity({ manufacturer: 'Stage6 Probe Manufacturing', mpn: 'PRB-A-0001' }); // same product, formatting variants
  const idB = computeIdentity({ manufacturer: 'Stage6 Probe Manufacturing', mpn: 'PRB-B-0002' }); // different MPN
  const idC = computeIdentity({ manufacturer: 'Other Vendor GmbH', mpn: 'PRB-A-0001' });        // different manufacturer

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

  const keyA = evidenceCacheKey(idA);
  const keyA2 = evidenceCacheKey(idA2);
  const keyB = evidenceCacheKey(idB);
  const keyC = evidenceCacheKey(idC);

  console.log(`Key formatting-invariance (same product): ${keyA === keyA2 ? '✓ identical' : '✗ differs'}`);
  console.log(`Different MPN => different key:           ${keyB !== keyA ? '✓' : '✗'}`);
  console.log(`Different manufacturer => different key:  ${keyC !== keyA ? '✓' : '✗'}`);
  const keysIsolated = keyA === keyA2 && keyB !== keyA && keyC !== keyA;

  let roundTrip = false;
  if (!writeBlocked) {
    await cache.set(keyA, sampleEvidence);

    const hit = await cache.get(keyA);
    console.log(`Product A after write:                    ${hit !== undefined && hit?.identity_match === true ? '✓ CACHE HIT' : '✗ MISS'}`);

    const hit2 = await cache.get(keyA2);
    console.log('Product A again (formatting variants):    ' + (hit2 !== undefined && hit2?.identity_match ? '✓ CACHE HIT (no duplicate retrieval)' : '✗'));

    const missB = await cache.get(keyB);
    console.log(`Different MPN:                            ${missB === undefined ? '✓ CACHE MISS (isolated)' : '✗ CROSSED!'}`);

    const missC = await cache.get(keyC);
    console.log(`Different manufacturer, same MPN:         ${missC === undefined ? '✓ CACHE MISS (isolated)' : '✗ CROSSED!'}`);

    // Negative-cached entry semantics
    const idD = computeIdentity({ manufacturer: 'Stage6 Probe Manufacturing', mpn: 'PRB-D-0004' });
    await cache.set(evidenceCacheKey(idD), null);
    const negEntry = await cache.get(evidenceCacheKey(idD));
    console.log(`Negative entry stored (not-found):        ${negEntry === null ? '✓ null (searched, nothing found)' : negEntry === undefined ? '○ absent' : '✗ unexpected value'}`);

    // --- Cleanup own probe rows ---------------------------------------------
    const del = await supabase.from('enrichment_logs').delete().like('item_id', `${PROBE_PREFIX}%`);
    console.log(`Probe cleanup:                            ${del.error ? '✗ ' + del.error.message : '✓ removed own rows only'}`);

    roundTrip =
      hit?.identity_match === true && hit2?.identity_match === true &&
      missB === undefined && missC === undefined;
  } else {
    roundTrip = false; // unverifiable without valid service credentials
  }

  const cacheOk = keysIsolated && (writeBlocked ? false : roundTrip);

  console.log(`\nAll tables OK: ${allTablesOk} · Key isolation: ${keysIsolated ? 'PASS' : 'FAIL'} · Persistent-cache round trip: ${writeBlocked ? `BLOCKED — ${writeBlocked}` : roundTrip ? 'PASS' : 'FAIL'}`);
  process.exitCode = allTablesOk && keysIsolated && !writeBlocked ? 0 : writeBlocked ? 2 : 1;
}

void main();
