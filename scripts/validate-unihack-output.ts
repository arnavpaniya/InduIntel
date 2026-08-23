/**
 * Stage 6, Part 16: Final UniHack submission validator.
 *
 * Accepts a CSV or XLSX file and verifies:
 *   1.  file readable
 *   2.  header count = 252
 *   3.  exact header order (byte-equal to UNIHACK_HEADERS)
 *   4.  no missing headers
 *   5.  no extra headers
 *   6.  every row has exactly 252 columns
 *   7.  CSV is not malformed (RFC4180 parse must succeed)
 *   8.  Unicode survives a round-trip
 *   9.  required static headers unchanged
 *
 * Exit codes: 0 = valid, 1 = invalid.
 *
 * Usage: npx tsx scripts/validate-unihack-output.ts <file.csv|file.xlsx>
 */

import { readFileSync } from 'fs';
import { parse as csvParse } from 'csv-parse/sync';
import { UNIHACK_HEADERS as CANONICAL, TOTAL_HEADERS } from '../lib/unihack/output-schema';

// Single source of truth: the frozen 252-column contract.
const UNIHACK_HEADERS: readonly string[] = CANONICAL;
const EXPECTED_COUNT = TOTAL_HEADERS;

interface Check { ok: boolean; detail: string }

const checks: Check[] = [];
function check(ok: boolean, detail: string): void {
  checks.push({ ok, detail });
  console.log(` ${ok ? '✓' : '✗'} ${detail}`);
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npx tsx scripts/validate-unihack-output.ts <file.csv|file.xlsx>');
    process.exit(1);
  }

  console.log(`\n=== UNIHACK SUBMISSION VALIDATOR ===\nFile: ${file}\n`);

  // 1. readable
  let raw: Buffer;
  try {
    raw = readFileSync(file);
    check(true, 'file readable');
  } catch (err) {
    check(false, `file NOT readable: ${err instanceof Error ? err.message : err}`);
    finish();
    return;
  }

  let rows: string[][] = [];

  if (file.toLowerCase().endsWith('.xlsx')) {
    // 2-6 via ExcelJS reload
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(raw as unknown as ArrayBuffer);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error('workbook has no worksheet');
      const headerRow = ws.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
        headers[col - 1] = String(cell.value ?? '');
      });
      rows = [headers];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const cells: string[] = [];
        for (let c = 1; c <= EXPECTED_COUNT; c++) {
          const v = row.getCell(c).value;
          cells.push(v == null ? '' : typeof v === 'object' && 'result' in (v as object) ? String((v as any).result ?? '') : String(v));
        }
        rows.push(cells);
      });
      check(true, 'XLSX workbook loads');
    } catch (err) {
      check(false, `XLSX load failed: ${err instanceof Error ? err.message : err}`);
      finish();
      return;
    }
  } else {
    // 7. malformed CSV check (RFC4180 strict-ish)
    try {
      const parsed = csvParse(raw, { bom: true, relax_column_count: false }) as string[][];
      rows = parsed;
      check(true, 'CSV parses without errors (RFC4180)');
    } catch (err) {
      check(false, `CSV MALFORMED: ${err instanceof Error ? err.message : err}`);
      finish();
      return;
    }
  }

  if (rows.length === 0) {
    check(false, 'file contains no rows');
    finish();
    return;
  }

  const headers = rows[0];

  // 2. header count
  check(headers.length === EXPECTED_COUNT, `header count = ${headers.length} (expected ${EXPECTED_COUNT})`);

  // 3+4+5. exact order / no missing / no extra
  let missing = 0;
  let extra = 0;
  let reordered = 0;
  const expectedSet = new Set(UNIHACK_HEADERS);
  for (let i = 0; i < Math.max(headers.length, UNIHACK_HEADERS.length); i++) {
    const actual = headers[i];
    const expected = UNIHACK_HEADERS[i];
    if (actual === undefined) missing++;
    else if (!expectedSet.has(actual)) extra++;
    else if (actual !== expected) reordered++;
  }
  check(missing === 0, `missing headers: ${missing}`);
  check(extra === 0, `extra/non-contract headers: ${extra}`);
  check(reordered === 0 && headers.length === EXPECTED_COUNT, `headers in EXACT organizer order (${EXPECTED_COUNT - reordered}/${EXPECTED_COUNT} positions correct)`);

  // 6. every row 252 columns
  let badRows = 0;
  for (let r = 1; r < rows.length; r++) {
    if (rows[r].length !== EXPECTED_COUNT) badRows++;
  }
  check(badRows === 0, `rows with wrong column count: ${badRows} (of ${rows.length - 1} data rows)`);

  // 8. Unicode survives
  const isXlsx = file.toLowerCase().endsWith('.xlsx');
  if (isXlsx) {
    // XLSX is a ZIP container: validate the PARSED string content instead of
    // raw bytes — no replacement-char corruption and no lone surrogates.
    const flat = rows.flat().join('\u0001');
    let bad = 0;
    for (const ch of flat) {
      const cp = ch.codePointAt(0)!;
      if (cp === 0xfffd || (cp >= 0xd800 && cp <= 0xdfff)) bad++;
    }
    const hasUnicodeContent = /[^\x00-\x7F]/.test(flat);
    check(bad === 0, `XLSX string content corruption-free (bad codepoints: ${bad}, non-ASCII present: ${hasUnicodeContent})`);
  } else {
    const hasUnicode = /[^\x00-\x7F]/.test(raw.toString('utf-8'));
    if (hasUnicode) {
      const flat = rows.flat().join('\u0001');
      const unicodePreserved = [...new Set(raw.toString('utf-8').match(/[^\x00-\x7F]/g) ?? [])]
        .every((ch) => flat.includes(ch));
      check(unicodePreserved, 'non-ASCII characters survive parsing');
    } else {
      check(true, 'no non-ASCII characters present (nothing to verify)');
    }
  }

  // 9. static headers unchanged — byte-level equality already covered above;
  // assert explicitly for the report.
  const staticOk = UNIHACK_HEADERS.every((h, i) => headers[i] === h);
  check(staticOk, 'static organizer headers unchanged');

  finish();
}

function finish(): void {
  const failedChecks = checks.filter((c) => !c.ok);
  console.log(`\n=== RESULT: ${checks.length - failedChecks.length}/${checks.length} checks passed ===`);
  if (failedChecks.length > 0) {
    console.log('FAILED:');
    for (const f of failedChecks) console.log(`  ✗ ${f.detail}`);
    process.exitCode = 1;
  } else {
    console.log('VALID FOR SUBMISSION.');
    process.exitCode = 0;
  }
}

void main();
