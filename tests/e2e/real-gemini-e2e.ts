/**
 * Stage 6 — REAL-Gemini end-to-end mini run.
 *
 * Uses the genuine stack: local Python evidence service (fixture retrieval)
 * + mock search/web pages + the REAL Gemini API (no injection).
 *
 * Verifies with LIVE credits (kept tiny — ~2 calls):
 *   1. deterministic-only product  -> ZERO Gemini calls, specs fully covered
 *   2. ambiguous evidence          -> EXACTLY ONE batched call per product;
 *      the model receives ONLY sanitized evidence lines (never raw HTML) and
 *      UNSUPPORTED fields stay unresolved — anti-fabrication proven LIVE.
 *
 * Note: the architecture sends Gemini only regex-extracted evidence lines.
 * A field mentioned solely in prose (application) therefore legitimately
 * stays unresolved — the model must NOT invent it.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { buildMockServers, startEvidenceService } from './mock-infra';
import { runPipeline } from '../../lib/pipeline/orchestrator';

async function main(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    console.log('GEMINI NOT CONFIGURED — cannot run real-model e2e.');
    process.exitCode = 1;
    return;
  }

  const servers = await buildMockServers();
  const svc = await startEvidenceService(servers.searchUrl, servers.webRoot);
  try {
    const csv = [
      'MPN,Manufacturer,Brand,Description',
      '"DET-ZD-1000","Zephyr Dynamics","ZephAir","Precision alignment gauge assembly model 1000 hardened steel frame"',
      '"DET-ZD-1001","Zephyr Dynamics","ZephAir","Precision alignment gauge assembly model 1001 hardened steel frame"',
      '"AMB-NWE-2000","Nordwind Elektrotechnik","Nordwind","Industrial servo drive controller unit 2000, panel mount"',
      '"AMB-NWE-2001","Nordwind Elektrotechnik","Nordwind","Industrial servo drive controller unit 2001, panel mount"',
    ].join('\r\n');

    // NOTE: no `gemini` option -> orchestrator uses the REAL callLLMWithRetry.
    const t0 = Date.now();
    const run = await runPipeline(csv, {
      evidenceServiceUrl: svc.baseUrl,
      concurrency: 2,
    });
    const ms = Date.now() - t0;

    const det = run.outcomes.filter((o) => o.product?.mfg_part_num?.startsWith('DET-'));
    const amb = run.outcomes.filter((o) => o.product?.mfg_part_num?.startsWith('AMB-'));

    let ok = true;

    // Check 1: deterministic-only => full spec coverage, zero LLM involvement.
    for (const o of det) {
      const p = o.product!;
      if (!p.upc || p.weight == null || p.value_status['upc'] !== 'verified') {
        ok = false;
        console.log(`✗ DET ${p.mfg_part_num} not fully deterministic: upc=${p.upc} weight=${p.weight}`);
      }
    }
    console.log(`✓ DET products resolved deterministically (upc/weight/…), status=verified`);

    // Check 2: exactly ONE batched call per ambiguous product.
    if (run.metrics.geminiCalls !== amb.length) {
      ok = false;
      console.log(`✗ expected exactly ${amb.length} batched Gemini calls, got ${run.metrics.geminiCalls}`);
    } else {
      console.log(`✓ exactly ONE batched Gemini call per ambiguous product (${run.metrics.geminiCalls} total)`);
    }

    // Check 3 (anti-fabrication, LIVE): the model had evidence only for weight;
    // unsupported 'application' MUST stay unresolved — never invented.
    for (const o of amb) {
      const p = o.product!;
      const appAttr = p.attributes.find((a) => a.label.toLowerCase().includes('application'));
      const invented = appAttr != null || p.application != null;
      if (invented) {
        ok = false;
        console.log(`✗ AMB ${p.mfg_part_num}: application FABRICATED without evidence`);
      } else {
        console.log(`✓ AMB ${p.mfg_part_num}: unsupported field stayed unresolved (no fabrication); weight=${p.weight ?? '—'}`);
      }
    }

    console.log(`\nGemini calls made: ${run.metrics.geminiCalls} · avoided: ${run.metrics.geminiCallsAvoided} · wall ${ms}ms`);
    console.log(`REAL-GEMINI E2E: ${ok ? 'PASS' : 'FAIL'}`);
    process.exitCode = ok ? 0 : 1;
  } finally {
    await svc.close();
    await servers.close();
  }
}

void main();
