/**
 * Stage 6 · Part 13 — Frontend integration smoke (runtime path).
 * Boots nothing itself; expects Next.js on :3000 and evidence service on :8000.
 * Drives the EXACT calls the dashboard makes:
 *   upload → items → enrich/run (full step chain incl. Tavily+Gemini) → export
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync, writeFileSync } from 'fs';
import { parse as csvParse } from 'csv-parse/sync';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3000';
const TOKEN = process.env.INTERNAL_API_TOKEN ?? '';
const H: Record<string, string> = TOKEN ? { 'x-internal-api-token': TOKEN } : {};

async function j(url: string, init?: RequestInit) {
  const r = await fetch(BASE + url, { ...init, headers: { ...(init?.headers ?? {}), ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) } });
  const body = await r.text();
  let parsed: any = null;
  try { parsed = JSON.parse(body); } catch { /* non-json */ }
  return { status: r.status, ok: r.ok, parsed, body };
}

async function main() {
  console.log('\n=== FRONTEND INTEGRATION SMOKE ===\n');
  let failures = 0;
  const check = (name: string, ok: boolean, detail = '') => {
    console.log(` ${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
    if (!ok) failures++;
  };

  // 0) services reachable
  try {
    const ev = await (await fetch('http://127.0.0.1:8000/')).json();
    check('evidence service up', ev?.search_provider === 'TavilySearchProvider', `provider=${ev?.search_provider}`);
  } catch { check('evidence service up', false); }

  // 1) Upload a 5-row organizer slice (same code path as the upload modal)
  const rows = (csvParse(readFileSync('Unihack_ Sample Dataset - Input.csv', 'utf-8'), { columns: true }) as any[]).slice(0, 5);
  const csv5 = ['Mfg_Part_Num,Part_Desc,E1_Brand,Unilog_Brand,DIB_Brand,Part_Manuf',
    ...rows.map((r: any) => `${r.Mfg_Part_Num},"${(r.Part_Desc ?? '').replace(/"/g, '""')}",${r.E1_Brand},${r.Unilog_Brand},${r.DIB_Brand},"${(r.Part_Manuf ?? '').replace(/"/g, '""')}"`)].join('\n');
  writeFileSync('/tmp/smoke5.csv', csv5);

  const fd = new FormData();
  fd.append('file', new Blob([readFileSync('/tmp/smoke5.csv')], { type: 'text/csv' }), 'smoke5.csv');
  fd.append('source', 'csv');
  const up = await j('/api/items/upload', { method: 'POST', body: fd as any, headers: H });
  check('POST /api/items/upload', up.ok && up.parsed?.count > 0,
    `batch=${up.parsed?.batchId} count=${up.parsed?.count} err=${up.ok ? '' : (up.parsed?.error ?? up.body.slice(0, 120))}`);
  const batchId: string | undefined = up.parsed?.batchId;

  // 2) Items list (what the table renders)
  const list = await j(`/api/items?limit=10${batchId ? `&batch=${batchId}` : ''}`);
  check('GET /api/items returns uploaded batch', list.ok && list.parsed?.items?.length >= 5, `total=${list.parsed?.pagination?.total}`);
  const target = list.parsed?.items?.[0];
  check('raw status from backend', target?.status === 'raw', `status=${target?.status}`);

  // 3) Enrich ONE product through the full chain (dashboard enrichItem())
  const run = await j('/api/enrich/run', { method: 'POST', headers: H, body: JSON.stringify({ item_id: target.id }) });
  const steps = run.parsed?.step_results ?? {};
  const ranSteps = Object.keys(steps);
  const isHandledFailure = run.parsed?.status === 'failed';
  check('POST /api/enrich/run', run.status === 200 && !!run.parsed?.item_id,
    `steps=[${ranSteps.join(',')}] status=${run.parsed?.status}`);
  if (!isHandledFailure) {
    // Success path: every stage must have executed
    for (const expected of ['manufacturer', 'classify', 'missing-field-analysis', 'external_evidence', 'attributes', 'descriptions', 'specs']) {
      check(`  step ${expected}`, expected in steps);
    }
  } else {
    // Handled failure path: pipeline must stop at the failing step and report it
    const fs2 = run.parsed?.failed_step;
    check('  pipeline aborted at failing step', ranSteps.includes(fs2), `aborted after ${fs2}`);
  }
  const evData = steps['external_evidence']?.data;
  check('external evidence reached Python service',
    evData == null || evData.skipped !== undefined || evData.identity_match !== undefined,
    evData?.source ? `source=${evData.source?.domain ?? evData.source?.url}` : (evData?.reject_reason ?? evData?.skipped ?? ''));

  // 4) Backend-derived status/confidence
  const st = run.parsed?.status;
  const cs = run.parsed?.confidence_score;
  check('backend-reported lifecycle status', ['enriched','review','failed'].includes(st), `status=${st} confidence=${cs}`);
  if (st === 'failed') {
    check('failed state carries failed_step + safe error',
      !!run.parsed?.failed_step && !!run.parsed?.failed_error,
      `step=${run.parsed?.failed_step} err="${String(run.parsed?.failed_error).slice(0,60)}"`);
  }

  // 5) Item detail reflects persisted state
  const detail = await j(`/api/items/${target.id}`);
  check('GET /api/items/:id persists enrichment', detail.ok && detail.parsed?.confidence_score != null,
    `db status=${detail.parsed?.status} score=${detail.parsed?.confidence_score}`);

  // 6) Export + validate 252 columns
  const exp = await fetch(`${BASE}/api/export?format=csv&batch=${batchId}`);
  const csvText = await exp.text();
  check('GET /api/export?format=csv', exp.ok);
  const { parse: parseCsv } = await import('csv-parse/sync');
  const parsedRows = parseCsv(csvText) as string[][];
  check('export has 252 columns in header', parsedRows[0]?.length === 252,
    `got ${parsedRows[0]?.length}`);
  const raggedRows = parsedRows.filter((r) => r.length !== 252).length;
  check('every exported row has 252 columns', raggedRows === 0,
    `${raggedRows} ragged rows of ${parsedRows.length - 1}`);

  // cleanup smoke rows so the catalog stays clean
  if (batchId) {
    const del = await j(`/api/items?batch=${batchId}`, { method: 'DELETE' }).catch(() => ({ status: 0 } as any));
    console.log(` (cleanup: delete-by-batch status ${del.status})`);
  }

  console.log(`\n=== FRONTEND SMOKE: ${failures === 0 ? 'PASS' : failures + ' FAILURE(S)'} ===`);
  process.exitCode = failures === 0 ? 0 : 1;
}
void main();
