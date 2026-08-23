/**
 * Stage 6 — Production pipeline runner over the ACTUAL organizer sample input.
 *
 *   Unihack_ Sample Dataset - Input.csv
 *     -> input normalization
 *     -> identity + duplicate detection
 *     -> missing-field analysis
 *     -> external evidence (REAL local Python service; search provider
 *        unauthenticated => graceful no-source path)
 *     -> deterministic extraction application
 *     -> Gemini ONLY if GEMINI_API_KEY configured (single batched calls)
 *     -> CanonicalProduct
 *     -> 252-column mapper
 *     -> reports/unihack-final-sample.csv + .xlsx
 *
 * Also produces:
 *   - data-quality audit  (field status classification; fabricated MUST be 0)
 *   - identity audit      (mfr+MPN, duplicates, suspicious identities)
 *   - reports/unihack-final-validation.json
 *
 * No input values are edited. No sample values hardcoded. Nothing fabricated.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { spawn } from 'child_process';
import { parse as csvParse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

import { normalizeCsvInput, fieldValue, stripVendorCode } from '../../lib/input/input-normalizer';
import { runPipeline } from '../../lib/pipeline/orchestrator';
import { productToRow } from '../../lib/unihack/output-mapper';
import {
  UNIHACK_HEADERS,
  HEADER_TO_INTERNAL,
} from '../../lib/unihack/output-schema';
import { computeIdentity } from '../../lib/product-intelligence/identity';
import type { ProductOutcome } from '../../lib/pipeline/orchestrator';

const INPUT_CSV = 'Unihack_ Sample Dataset - Input.csv';
const OUT_DIR = 'reports';
const OUT_CSV = `${OUT_DIR}/unihack-final-sample.csv`;
const OUT_XLSX = `${OUT_DIR}/unihack-final-sample.xlsx`;

// ---------------------------------------------------------------------------
// Real Python evidence service (production startup) — NO search provider env,
// so discovery honestly returns "no sources" until a provider is configured.
// ---------------------------------------------------------------------------

interface ServiceHandle {
  baseUrl: string | null;
  mode: 'real' | 'unavailable';
  close: () => void;
}

async function startProductionEvidenceService(): Promise<ServiceHandle> {
  const candidates = [
    process.env.E2E_PYTHON,
    '/Library/Frameworks/Python.framework/Versions/3.13/bin/python3',
    'python3',
  ].filter(Boolean) as string[];

  for (const py of candidates) {
    const port = 28100 + Math.floor(Math.random() * 900);
    const child = spawn(py, ['-m', 'uvicorn', 'app:app', '--port', String(port)], {
      cwd: `${process.cwd()}/services/evidence`,
      env: { ...process.env, EVIDENCE_PORT: String(port) }, // deliberately NO search provider
      stdio: 'ignore',
    });
    const baseUrl = `http://127.0.0.1:${port}`;
    const http = await import('http');
    const ready = await new Promise<boolean>((resolve) => {
      let attempts = 0;
      const tick = () => {
        attempts++;
        if (child.exitCode != null || attempts > 60) return resolve(false);
        const req = http.get(`${baseUrl}/`, (r) => {
          r.resume();
          resolve(r.statusCode === 200);
        });
        req.on('error', () => setTimeout(tick, 400));
      };
      child.on('exit', () => resolve(false));
      tick();
    });
    if (ready) {
      return {
        baseUrl,
        mode: 'real',
        close: () => {
          child.kill('SIGTERM');
          setTimeout(() => child.kill('SIGKILL'), 2500).unref();
          child.stdout?.destroy();
          child.stderr?.destroy();
        },
      };
    }
    child.kill('SIGKILL');
  }
  return { baseUrl: null, mode: 'unavailable', close: () => undefined };
}

// ---------------------------------------------------------------------------
// Output writers
// ---------------------------------------------------------------------------

function escapeCsv(v: string): string {
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

/** Legacy brand sentinels ("-- Unbranded --") → empty output cells. */
function cleanSentinel(v: string | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  if (!t || t.startsWith('--')) return null;
  return t;
}

function toCsvString(rows: string[][]): string {
  return [UNIHACK_HEADERS.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');
}

async function toXlsxBuffer(rows: string[][]): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Export');
  ws.columns = UNIHACK_HEADERS.map((h) => ({ header: h, key: h }));
  for (const r of rows) ws.addRow(r);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// Audits
// ---------------------------------------------------------------------------

interface FieldAuditLine {
  field: string;
  status: string;
}

function auditFields(outcomes: ProductOutcome[]): {
  totals: Record<string, number>;
  perField: Record<string, Record<string, number>>;
  fabricated: number;
  staticEmptyCells: number;
} {
  const totals: Record<string, number> = {
    verified: 0, inferred: 0, unresolved: 0, conflicting: 0, invalid: 0, static_empty: 0,
  };
  const perField: Record<string, Record<string, number>> = {};
  let fabricated = 0;

  for (const o of outcomes) {
    const p = o.product;
    if (!p) continue;

    // provenance coverage map for fabrication detection
    const hasProvenance = new Set(Object.keys(p.field_provenance ?? {}));

    for (const [header, internalRaw] of Object.entries(HEADER_TO_INTERNAL)) {
      if (internalRaw === 'null' || internalRaw == null) { totals.static_empty++; continue; }
      const internal: string = internalRaw;
      const status = p.value_status[internal] ?? 'unresolved';
      totals[status] = (totals[status] ?? 0) + 1;
      perField[internal] = perField[internal] ?? {};
      perField[internal][status] = (perField[internal][status] ?? 0) + 1;

      // FABRICATION definition: a non-empty value with NO provenance record
      // and no legitimate verified-input seeding.
      const value = (p as any)[internal];
      const valuePresent = value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0);
      if (valuePresent && !hasProvenance.has(internal)) {
        // actual_image_flag is derived deterministically from assets — allowed.
        if (internal !== 'actual_image_flag') fabricated++;
      }
    }
    // attributes/features carry their own statuses; count them too
    for (const a of p.attributes) {
      const st = a.status ?? 'unresolved';
      totals[st] = (totals[st] ?? 0) + 1;
      if ((a.value ?? '') !== '' && !a.provenance) fabricated++;
    }
    for (const f of p.features) {
      if ((f.value ?? '') !== '' && !f.provenance) fabricated++;
    }
  }
  return { totals, perField, fabricated, staticEmptyCells: totals.static_empty };
}

interface IdentityIssue {
  rowIndex: number;
  mpn: string | null;
  manufacturer: string | null;
  kind: string;
  detail: string;
}

function auditIdentity(outcomes: ProductOutcome[], rawRows: Array<Record<string, string>>): {
  strong: number; medium: number; none: number;
  issues: IdentityIssue[];
} {
  let strong = 0, medium = 0, none = 0;
  const issues: IdentityIssue[] = [];
  const seenMpn = new Map<string, number>();

  for (const o of outcomes) {
    if (o.identity.strength === 'strong') strong++;
    else if (o.identity.strength === 'medium') medium++;
    else none++;

    const mpn: string | null = o.product?.mfg_part_num ?? null;
    const mfr: string | null = o.product?.manufacturer_name ?? null;

    if (mpn) {
      const prev = seenMpn.get(mpn);
      if (prev !== undefined) {
        issues.push({ rowIndex: o.rowIndex, mpn, manufacturer: mfr, kind: 'duplicate_mpn', detail: `MPN already seen at row ${prev}` });
      } else {
        seenMpn.set(mpn, o.rowIndex);
      }
    }

    // Manufacturer mismatch vs raw Part_Manuf (deterministic code-stripped compare)
    const rawManuf = rawRows[o.rowIndex]?.['Part_Manuf'] ?? '';
    if (rawManuf && mfr) {
      const cleanedRaw = stripVendorCode(rawManuf.trim());
      if (cleanedRaw.toLowerCase() !== mfr.toLowerCase()) {
        // Not necessarily wrong: LLM manufacturer derivation may differ from
        // distributor-of-record. Report as suspicious; NEVER silently correct.
        issues.push({
          rowIndex: o.rowIndex, mpn, manufacturer: mfr, kind: 'manufacturer_derived_differs',
          detail: `input "${cleanedRaw}" vs output "${mfr}"`,
        });
      }
    }

    // External source mismatch signals
    for (const e of o.errors) {
      if (e.stage === 'external_evidence' || e.stage === 'apply_evidence') {
        issues.push({ rowIndex: o.rowIndex, mpn, manufacturer: mfr, kind: `error_${e.stage}`, detail: e.message });
      }
    }
  }
  return { strong, medium, none, issues };
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Credit safety: external evidence is OFF by default so regenerating the
  // 1000-row artifacts never consumes search/API credits. Pass --live-evidence
  // to opt in to real discovery for this run.
  const liveEvidence = process.argv.includes('--live-evidence');
  console.log('\n=== STAGE 6 · PRODUCTION RUN OVER ORGANIZER SAMPLE INPUT ===\n');

  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  const searchConfigured = Boolean(process.env.EVIDENCE_SEARCH_URL) && liveEvidence;
  console.log(`Gemini:            ${geminiConfigured ? 'CONFIGURED' : 'NOT CONFIGURED (LLM-derived fields stay unresolved)'}`);
  console.log(`Search provider:   ${searchConfigured ? 'CONFIGURED' : 'SEARCH PROVIDER NOT CONFIGURED (external evidence unavailable)'}`);

  // ---- Load organizer input ---------------------------------------------
  const inputText = readFileSync(INPUT_CSV, 'utf-8');
  const rawRows = csvParse(inputText, { columns: true, skip_empty_lines: true, bom: true }) as Array<Record<string, string>>;
  console.log(`Organizer input rows: ${rawRows.length}`);

  const normalized = normalizeCsvInput(inputText);
  console.log(`Normalized rows:      ${normalized.rows.length}`);
  const unmappedCols = [...new Set(normalized.rows.flatMap((r) => r.unmappedColumns.map((u) => u.column)))];
  if (unmappedCols.length > 0) console.log(`Unmapped columns:     ${unmappedCols.join(', ')}`);

  // ---- Start REAL local evidence service ---------------------------------
  const svc = await startProductionEvidenceService();
  console.log(`Evidence service:     ${svc.mode === 'real' ? `RUNNING (${svc.baseUrl})` : 'UNAVAILABLE'}`);

  try {
    // Part 8 smoke: POST /evidence/check must answer with the contract shape.
    if (svc.baseUrl) {
      const resp = await fetch(`${svc.baseUrl}/evidence/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manufacturer: 'Smoke Test Co', brand: '', mpn: 'SMOKE-1',
          description: 'production startup verification', category: '',
          missing_fields: ['upc'],
        }),
      });
      const body = await resp.json();
      const keysOk = ['success', 'needs_search', 'identity_match', 'evidence', 'deterministic_fields', 'needs_gemini', 'unresolved']
        .every((k) => k in body);
      console.log(`Evidence /evidence/check smoke: HTTP ${resp.status}, contract keys ${keysOk ? 'OK' : 'MISSING'}, needs_search=${body.needs_search}`);
    }

    // ---- Run the production pipeline ------------------------------------
    const t0 = Date.now();
    if (!liveEvidence) {
      console.log('External evidence:   DISABLED (default). Re-run with --live-evidence to use real search.');
    }
    const run = await runPipeline(normalized.rows.map((r) => r), {
      evidenceServiceUrl: liveEvidence ? svc.baseUrl : null,
      concurrency: 4,
      // Gemini caller: only wired when key present; otherwise never called.
      gemini: process.env.GEMINI_API_KEY ? undefined : async () => ({ values: null, error: 'GEMINI_NOT_CONFIGURED' }),
    });
    const elapsedMs = Date.now() - t0;
    console.log(`Pipeline finished in ${elapsedMs} ms`);

    // ---- Map to 252 columns ---------------------------------------------
    const outRows: string[][] = [];
    for (const outcome of run.outcomes) {
      if (!outcome.product) {
        outRows.push(new Array(UNIHACK_HEADERS.length).fill(''));
        continue;
      }
      const row = productToRow(outcome.product);

      // Legacy distributor-brand slots are not part of the frozen canonical
      // model; pass the VERIFIED INPUT values straight through (organizer's
      // own example row preserves Part_Manuf raw, including vendor codes).
      const src = normalized.rows[outcome.rowIndex];
      const rawSrc = rawRows[outcome.rowIndex];
      if (src && rawSrc) {
        const put = (header: string, v: string | null | undefined) => {
          const idx = UNIHACK_HEADERS.indexOf(header as never);
          if (idx >= 0 && v != null && v.trim() !== '') row[idx] = v.trim();
        };
        put('E1_Brand', fieldValue(src, 'e1_brand' as never) ?? cleanSentinel(rawSrc['E1_Brand']));
        put('Unilog_Brand', cleanSentinel(rawSrc['Unilog_Brand']));
        put('DIB_Brand', cleanSentinel(rawSrc['DIB_Brand']));
        put('Part_Manuf', rawSrc['Part_Manuf']);
      }
      outRows.push(row);
    }

    // ---- Write outputs ----------------------------------------------------
    mkdirSync(OUT_DIR, { recursive: true });
    const csvText = toCsvString(outRows);
    writeFileSync(OUT_CSV, csvText);
    const xlsxbuf = await toXlsxBuffer(outRows);
    writeFileSync(OUT_XLSX, xlsxbuf);
    console.log(`Wrote ${OUT_CSV} (${(csvText.length / 1024).toFixed(0)} KB)`);
    console.log(`Wrote ${OUT_XLSX} (${(xlsxbuf.length / 1024).toFixed(0)} KB)`);

    // ---- Programmatic re-validation of BOTH files -------------------------
    const parsedBack = csvParse(csvText, { relax_column_count: false }) as string[][];
    const csvHeaderOk = parsedBack[0].length === 252 && UNIHACK_HEADERS.every((h, i) => parsedBack[0][i] === h);
    const csvRowLengthsOk = parsedBack.slice(1).every((r) => r.length === 252);

    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsxbuf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const xlsxHeader: string[] = [];
    ws!.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => { headers_fill(xlsxHeader, col, String(cell.value ?? '')); });
    function headers_fill(arr: string[], col: number, v: string) { arr[col - 1] = v; }
    const xlsxHeaderOk = xlsxHeader.length === 252 && UNIHACK_HEADERS.every((h, i) => xlsxHeader[i] === h);

    // CSV/XLSX parity on all cells of first N rows + row count
    let parityChecked = 0;
    let parityMismatches = 0;
    const sampleN = Math.min(parsedBack.length - 1, 60);
    for (let r = 1; r <= sampleN; r++) {
      const row = ws!.getRow(r + 1);
      for (let c = 1; c <= 252; c++) {
        const xv = row.getCell(c).value;
        const xs = xv == null ? '' : String(xv);
        parityChecked++;
        if (xs !== parsedBack[r][c - 1]) parityMismatches++;
      }
    }

    // ---- Audits ------------------------------------------------------------
    const fieldAudit = auditFields(run.outcomes);
    const idAudit = auditIdentity(run.outcomes, rawRows);

    // Externally-sourced VERIFIED fields (provenance source_type='external').
    let externalEvidenceFields = 0;
    for (const o of run.outcomes) {
      const p = o.product;
      if (!p) continue;
      for (const [internal, prov] of Object.entries(p.field_provenance ?? {})) {
        if (prov?.source_type === 'external' && (p as any)[internal] != null) externalEvidenceFields++;
      }
    }

    // Duplicate MPNs at input level (organizer file itself)
    const inputMpnCounts = new Map<string, number>();
    for (const rr of rawRows) {
      const m = (rr['Mfg_Part_Num'] ?? '').trim();
      if (m) inputMpnCounts.set(m, (inputMpnCounts.get(m) ?? 0) + 1);
    }
    const duplicatedInputMpns = [...inputMpnCounts.entries()].filter(([, c]) => c > 1);

    // ---- Final validation report ------------------------------------------
    const report = {
      generated_at: new Date().toISOString(),
      source_input: INPUT_CSV,
      input_rows: rawRows.length,
      processed_rows: run.metrics.processed + run.metrics.duplicatesMerged,
      failed_rows: run.metrics.failed,
      duplicates: run.metrics.duplicatesMerged + duplicatedInputMpns.reduce((a, [, c]) => a + (c - 1), 0),
      output_columns: 252,
      csv_valid: csvHeaderOk && csvRowLengthsOk,
      xlsx_valid: xlsxHeaderOk,
      csv_xlsx_parity_checked_cells: parityChecked,
      csv_xlsx_parity_mismatches: parityMismatches,
      fabricated_values: fieldAudit.fabricated,
      verified_fields: fieldAudit.totals.verified ?? 0,
      inferred_fields: (fieldAudit.totals.inferred ?? 0),
      unresolved_fields: fieldAudit.totals.unresolved ?? 0,
      conflicting_fields: fieldAudit.totals.conflicting ?? 0,
      invalid_fields: fieldAudit.totals.invalid ?? 0,
      external_evidence_fields: externalEvidenceFields,
      deterministic_fields: run.metrics.deterministicFields,
      gemini_calls: run.metrics.geminiCalls,
      gemini_calls_avoided: run.metrics.geminiCallsAvoided,
      cache_hits: run.metrics.cacheHits,
      cache_misses: run.metrics.cacheMisses,
      production_status: {
        gemini: geminiConfigured ? 'configured' : 'NOT CONFIGURED',
        search_provider: searchConfigured ? 'configured' : 'SEARCH PROVIDER NOT CONFIGURED',
        evidence_service: svc.mode,
        supabase: process.env.SUPABASE_URL ? 'configured' : 'not configured',
      },
      identity_audit: {
        strong: idAudit.strong,
        medium: idAudit.medium,
        none: idAudit.none,
        duplicated_input_mpns: duplicatedInputMpns.map(([m, c]) => ({ mpn: m, count: c })),
        suspicious_issues: idAudit.issues.slice(0, 50),
        suspicious_issue_count: idAudit.issues.length,
      },
      field_status_totals: fieldAudit.totals,
      timing: { ...run.metrics.timing, totalWallMs: elapsedMs },
    };

    writeFileSync(`${OUT_DIR}/unihack-final-validation.json`, JSON.stringify(report, null, 2));
    // Detailed audit artifacts
    writeFileSync(`${OUT_DIR}/data-quality-audit.json`, JSON.stringify({
      totals: fieldAudit.totals,
      per_field: fieldAudit.perField,
      fabricated_values: fieldAudit.fabricated,
    }, null, 2));
    writeFileSync(`${OUT_DIR}/identity-audit.json`, JSON.stringify({
      strength: { strong: idAudit.strong, medium: idAudit.medium, none: idAudit.none },
      duplicated_input_mpns: duplicatedInputMpns,
      issues: idAudit.issues,
    }, null, 2));

    console.log('\n=== SUMMARY ===');
    console.log(`CSV valid: ${report.csv_valid} · XLSX valid: ${report.xlsx_valid} · parity mismatches: ${parityMismatches}/${parityChecked}`);
    console.log(`Fabricated values: ${report.fabricated_values} (must be 0)`);
    console.log(`Field statuses: ${JSON.stringify(fieldAudit.totals)}`);
    console.log(`Identity: strong=${idAudit.strong} medium=${idAudit.medium} none=${idAudit.none}; suspicious=${idAudit.issues.length}`);
    console.log(`Reports written to ${OUT_DIR}/`);
    process.exitCode = report.fabricated_values === 0 && report.csv_valid && report.xlsx_valid && parityMismatches === 0 ? 0 : 1;
  } finally {
    svc.close();
  }
}

void main();
void computeIdentity;
void fieldValue;
void rmSync;
void createClient;
