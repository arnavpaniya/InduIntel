/**
 * Stage 6, Part 14: 500-product operational stability test.
 *
 * Generates 500 synthetic products programmatically (no organizer data),
 * runs the full orchestrator with:
 *   - REAL local Python evidence service when available (search unconfigured
 *     => honest no-source path; no Gemini anywhere)
 *   - otherwise dead-service degradation path
 *
 * Measures: wall time, memory behavior, per-product latency, external
 * requests, gemini calls, cache hit rate, failures. Stability only —
 * no premature optimization.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { writeFileSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';
import { runPipeline } from '../../lib/pipeline/orchestrator';
import { normalizeCsvInput } from '../../lib/input/input-normalizer';

// --- deterministic synthetic generation ------------------------------------

const COMPANIES = [
  'Aster Fabrication', 'Borealis Tools', 'Cinder Dynamics', 'Delta Fluidics',
  'Ember Electrical', 'Flint Mechanical', 'Gale Instruments', 'Halcyon Labs',
];
const NOUNS = [
  'valve assembly', 'gear motor unit', 'filter cartridge', 'sensor module',
  'mount bracket kit', 'control relay', 'bearing set', 'hose fitting',
  'pressure gauge', 'drive belt', 'coupling insert', 'terminal block',
];

function makeCsv(n: number): string {
  const esc = (v: string) => (/[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
  const lines = ['MPN,Manufacturer,Description,Category'];
  for (let i = 0; i < n; i++) {
    const dupOfPrev = i % 25 === 24 && i > 0;
    const srcIdx = dupOfPrev ? i - 1 : i;
    const company = COMPANIES[srcIdx % COMPANIES.length];
    const noun = NOUNS[(srcIdx * 7) % NOUNS.length];
    const mpn = `STB-${String(srcIdx).padStart(4, '0')}-${company.slice(0, 2).toUpperCase()}`;
    lines.push(
      [esc(mpn), esc(company), esc(`Industrial ${noun} rated for continuous duty, model ${srcIdx}`), esc(srcIdx % 3 === 0 ? 'industrial' : '')].join(','),
    );
  }
  return lines.join('\r\n');
}

interface EvidenceHandle { baseUrl: string | null; close: () => void }

async function startEvidence(): Promise<EvidenceHandle> {
  const candidates = [
    process.env.E2E_PYTHON,
    '/Library/Frameworks/Python.framework/Versions/3.13/bin/python3',
    'python3',
  ].filter(Boolean) as string[];
  for (const py of candidates) {
    const port = 29100 + Math.floor(Math.random() * 800);
    const child = spawn(py, ['-m', 'uvicorn', 'app:app', '--port', String(port)], {
      cwd: `${process.cwd()}/services/evidence`,
      env: { ...process.env, EVIDENCE_PORT: String(port) },
      stdio: 'ignore',
    });
    const http = await import('http');
    const baseUrl = `http://127.0.0.1:${port}`;
    const ready = await new Promise<boolean>((resolve) => {
      let attempts = 0;
      const tick = () => {
        attempts++;
        if (child.exitCode != null || attempts > 50) return resolve(false);
        const req = http.get(`${baseUrl}/`, (r) => { r.resume(); resolve(r.statusCode === 200); });
        req.on('error', () => setTimeout(tick, 300));
      };
      child.on('exit', () => resolve(false));
      tick();
    });
    if (ready) return { baseUrl, close: () => { child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 2000).unref(); child.stdout?.destroy(); child.stderr?.destroy(); } };
    child.kill('SIGKILL');
  }
  return { baseUrl: null, close: () => undefined };
}

async function main(): Promise<void> {
  console.log('\n=== STAGE 6 · 500-PRODUCT STABILITY TEST ===\n');
  const N = 500;
  const csv = makeCsv(N);
  const memBefore = process.memoryUsage();

  const svc = await startEvidence();
  console.log(`Evidence service: ${svc.baseUrl ?? 'UNAVAILABLE (degradation path)'}`);

  const t0 = Date.now();
  const run = await runPipeline(csv, {
    evidenceServiceUrl: svc.baseUrl,
    concurrency: 4,
    gemini: async () => ({ values: null, error: 'stability-test-no-gemini' }),
  });
  const elapsedMs = Date.now() - t0;
  svc.close();

  const memAfter = process.memoryUsage();
  const heapGrowthMb = ((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(1);

  const totalIdentities = new Set(
    run.outcomes.map((o) => o.identity.key ?? `none:${o.rowIndex}`),
  ).size;

  const result = {
    products: N,
    totalMs: elapsedMs,
    avgMsPerProduct: Number((elapsedMs / N).toFixed(2)),
    maxConcurrency: 4,
    processed: run.metrics.processed,
    duplicatesMerged: run.metrics.duplicatesMerged,
    failed: run.metrics.failed,
    uniqueIdentities: totalIdentities,
    externalSearches: run.metrics.externalSearches,
    externalRetrievals: run.metrics.externalRetrievals,
    deterministicFields: run.metrics.deterministicFields,
    geminiCalls: run.metrics.geminiCalls,
    cacheHits: run.metrics.cacheHits,
    cacheMisses: run.metrics.cacheMisses,
    cacheHitRate: Number((run.metrics.cacheHits / Math.max(1, run.metrics.cacheHits + run.metrics.cacheMisses)).toFixed(3)),
    unresolvedFields: run.metrics.unresolvedFields,
    heapUsedBeforeMb: Number((memBefore.heapUsed / 1024 / 1024).toFixed(1)),
    heapUsedAfterMb: Number((memAfter.heapUsed / 1024 / 1024).toFixed(1)),
    heapGrowthMb: Number(heapGrowthMb),
    rssMb: Number((memAfter.rss / 1024 / 1024).toFixed(1)),
    evidenceMode: svc.baseUrl ? 'real-local' : 'unavailable',
  };

  console.log(JSON.stringify(result, null, 2));

  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/stability-500.json', JSON.stringify(result, null, 2));

  // Stability gates — generous by design (stability, not speed).
  const ok =
    run.outcomes.length === N &&
    run.metrics.failed === 0 &&
    elapsedMs < 120_000 &&
    run.metrics.geminiCalls === 0 &&
    run.metrics.duplicatesMerged >= 15 && // ~20 duplicate rows engineered in
    Number(heapGrowthMb) < 512;

  console.log(`\nSTABILITY: ${ok ? 'PASS' : 'FAIL'} (${run.outcomes.length}/${N} outcomes, ${run.metrics.failed} failed)`);
  process.exitCode = ok ? 0 : 1;
}

void main();
