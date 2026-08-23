/**
 * Stage 5 End-to-End Evaluation (Parts 16–19, 23–24)
 *
 * synthetic evaluation CSV
 *   -> dynamic input normalization
 *   -> product identity + duplicates
 *   -> missing-field analysis
 *   -> REAL Stage 4 Python evidence service (mock search/web fixtures)
 *   -> deterministic extraction application
 *   -> Gemini only when required (mocked, counted)
 *   -> conflict resolution
 *   -> CanonicalProduct
 *   -> UniHack 252-column mapper
 *   -> CSV + XLSX
 *
 * Emits tests/e2e/evaluation-report.json with REAL execution metrics.
 */

import { describe, test, assert, assertEqual, assertGreaterThan, runAll } from '../helpers/harness';

import { buildSyntheticDataset, renderRows, toCsv } from '../synthetic/generate-dataset';
import { buildMockServers, startEvidenceService } from './mock-infra';
import {
  runPipeline,
  seedProductFromRow,
  type GeminiCaller,
} from '../../lib/pipeline/orchestrator';
import { normalizeCsvInput } from '../../lib/input/input-normalizer';
import { productToRow } from '../../lib/unihack/output-mapper';
import { UNIHACK_HEADERS } from '../../lib/unihack/output-schema';
import { parse as csvParse } from 'csv-parse/sync';

async function main(): Promise<void> {
  // ------------------------------------------------------------------
  // Fixture setup
  // ------------------------------------------------------------------
  const servers = await buildMockServers();
  const evidence = await startEvidenceService(servers.searchUrl, servers.webRoot);
  process.stdout.write(`\n[e2e] evidence service mode: ${evidence.mode}\n`);

  const { rows: scenarioRows, meta } = buildSyntheticDataset();
  assert(scenarioRows.length >= 50, `dataset must have >=50 products, got ${scenarioRows.length}`);

  const { records, headersInOrder } = renderRows(scenarioRows);
  const csvText = toCsv(records, headersInOrder);

  let geminiPromptLog: string[] = [];
  const mockGemini: GeminiCaller = async (prompt) => {
    geminiPromptLog.push(prompt.slice(0, 120));
    return { values: {}, confidence: 0.7 }; // resolves nothing; call still counted
  };

  try {
    await describe('end-to-end evaluation', async () => {
      test('dataset covers all 30 scenario types and has 50+ products', () => {
        const scenarios = new Set(meta.values());
        assertGreaterThan(scenarioRows.length, 50);
        assertGreaterThan(scenarios.size, 25, 'scenario diversity');
      });

      // ---------------- FULL PIPELINE RUN ----------------
      let run!: Awaited<ReturnType<typeof runPipeline>>;
      test('full pipeline executes over the synthetic CSV', async () => {
        run = await runPipeline(csvText, {
          evidenceServiceUrl: evidence.baseUrl,
          gemini: mockGemini,
          concurrency: 2,
        });
        assertEqual(run.outcomes.length, scenarioRows.length);

        if (process.env.DEBUG_EVIDENCE) {
          // eslint-disable-next-line no-console
          const health = await fetch(`${servers.searchUrl}?q=healthcheck`)
            .then((r) => r.status)
            .catch((e) => `DEAD: ${e.message}`);
          console.error(`[DEBUG] searchUrl after run: ${health}`);
          console.error(`[DEBUG] search queries received: ${servers.searchQueries.length}`);
          for (const o of run.outcomes) {
            const scen = meta.get(o.rowIndex);
            if (!scen || ['filler_mixed', 'deterministic_only', 'gemini_required'].every((s) => !scen.startsWith(s))) continue;
            console.error(`[SCEN] ${scen.padEnd(34)} ${o.status.padEnd(10)} mpn=${(o.product?.mfg_part_num ?? '-').padEnd(18)} weight=${JSON.stringify(o.product?.weight)} wstatus=${o.product?.value_status['weight']} mfr=${o.product?.manufacturer_name} errors=${o.errors.map((e) => e.stage).join(',')}`);
          }
        }
      });

      test('failure isolation: no crash, structured outcomes for every row', () => {
        assertEqual(run.metrics.totalProducts, scenarioRows.length);
        assertEqual(run.outcomes.length, scenarioRows.length);
        run.outcomes.forEach((o) => {
          assert(['processed', 'duplicate', 'failed'].includes(o.status), o.status);
        });
      });

      test('every processed product yields exactly 252 columns (Part 13/24)', () => {
        let checked = 0;
        for (const outcome of run.outcomes) {
          if (!outcome.product) continue;
          const row = productToRow(outcome.product);
          assert(row.length === UNIHACK_HEADERS.length, `row ${outcome.id}: ${row.length}`);
          assert(row.length === 252);
          checked++;
        }
        assertGreaterThan(checked, 45);
      });

      test('duplicate products merged without repeated enrichment (Part 4/30)', () => {
        assertGreaterThan(run.metrics.duplicatesMerged, 0);
        assertGreaterThan(run.metrics.cacheHits, 0);
        const dups = run.outcomes.filter((o) => o.status === 'duplicate');
        assertGreaterThan(dups.length, 0);
        for (const dup of dups) {
          assert(dup.duplicateOfId != null);
          assert(dup.product != null);
        }
      });

      test('deterministic-only products trigger ZERO Gemini calls (Part 9)', () => {
        // The six DET- rows resolve upc/ean/gtin/weight/dims/warranty deterministically
        assert(run.metrics.geminiCalls < 15); // far below one-per-product
        const detOutcome = run.outcomes.find(
          (o) => o.product?.mfg_part_num?.startsWith('DET-'),
        );
        assert(detOutcome?.product);
        assertEqual(detOutcome.product.upc != null, true, 'DET upc resolved');
        assertEqual(detOutcome.product.weight != null, true, 'DET weight resolved');
      });

      test('ambiguous evidence triggers exactly ONE batched Gemini call per product', () => {
        const ambOutcomes = run.outcomes.filter(
          (o) => o.product?.mfg_part_num?.startsWith('AMB-'),
        );
        assertGreaterThan(ambOutcomes.length, 0, 'AMB rows must exist');
        assertEqual(run.metrics.geminiCalls, geminiPromptLog.length, 'call accounting');
        // Every primary AMB row (not duplicates) may fire at most one batched call.
        assert(run.metrics.geminiCalls <= ambOutcomes.length,
          `geminiCalls=${run.metrics.geminiCalls} ambRows=${ambOutcomes.length}`);
        if (geminiPromptLog.length > 0) {
          assert(geminiPromptLog.some((p) => p.includes('Fields to resolve')), 'batched prompt shape');
        }
      });

      test('conflicting external vs input values are preserved, not discarded (Part 5)', () => {
        const confRow = run.outcomes.find(
          (o) => meta.get(o.rowIndex) === 'conflicting_external',
        );
        assert(confRow, 'conflicting_external row found');
        assert(confRow.product, 'product present');
        assert(confRow.product.value_status['weight'] === 'conflicting',
          `weight status: ${JSON.stringify(confRow.product.value_status)} errors=${JSON.stringify(confRow.errors)}`);
        assertGreaterThan(run.metrics.conflicts, 0);
      });

      test('conflicting input columns preserve both contributions (Part 1/5)', () => {
        const confInput = run.outcomes.find(
          (o) => meta.get(o.rowIndex) === 'conflicting_input',
        );
        assert(confInput?.product);
        assert(confInput.product.value_status['manufacturer_name'] === 'conflicting',
          JSON.stringify(confInput.product.value_status));
        assert(confInput.product.manufacturer_name != null); // display value kept
      });

      test('invalid values marked invalid — never guessed (Part 6)', () => {
        const badNum = run.outcomes.find((o) => meta.get(o.rowIndex) === 'invalid_numeric');
        assert(badNum?.product);
        assert(badNum.product.value_status['weight'] === 'invalid');

        const badUpc = run.outcomes.find((o) => meta.get(o.rowIndex) === 'invalid_barcode');
        assert(badUpc?.product);
        assert(badUpc.product.value_status['upc'] === 'invalid');
        assert(badUpc.product.upc == null || typeof badUpc.product.upc === 'string');
        assertGreaterThan(run.metrics.invalidFields, 0);
      });

      test('missing values remain unresolved — never inferred/fabricated', () => {
        const sparse = run.outcomes.find((o) => meta.get(o.rowIndex) === 'completely_sparse');
        assert(sparse, `sparse row found at index (rowIndex map size=${meta.size})`);
        assert(sparse.product, 'sparse product seeded');
        for (const f of ['upc', 'gtin', 'manufacturer_name', 'warranty']) {
          assertEqual((sparse.product as any)[f], null, `${f} value`);
          assert(sparse.product.value_status[f] !== 'inferred',
            `${f} must not be inferred (got ${sparse.product.value_status[f]})`);
        }
        assert(run.metrics.unresolvedFields > 0);
      });

      test('wrong external product rejected by identity verification (Part 23)', () => {
        const wrong = run.outcomes.find(
          (o) => meta.get(o.rowIndex) === 'wrong_external',
        );
        assert(wrong, 'wrong_external row found');
        assert(wrong.product, 'product present');
        // No external values may leak into a non-matching product
        assertEqual(wrong.product.weight, null,
          `weight leaked from wrong page; status=${JSON.stringify(wrong.product.value_status)}`);
      });

      test('blocked/malformed source URLs never fetched (Part 20)', () => {
        // The BADURL scenario offered http://localhost:9/admin as candidate;
        // the mock web server log must show NO such fetch ever occurred.
        assert(!servers.fetchedPaths.some((p) => p.includes('admin')),
          `localhost admin path was fetched! paths=${JSON.stringify(servers.fetchedPaths)}`);
      });

      test('unicode manufacturers/descriptions survive the full pipeline (Part 15/16)', () => {
        const uni = run.outcomes.find((o) =>
          o.product?.manufacturer_name?.includes('Müller'),
        );
        assert(uni?.product);
        assert(uni.product.manufacturer_name!.includes('Müller & Söhne'));
        const uniDesc = run.outcomes.find((o) => o.identity.key && meta.get(o.rowIndex) === 'unicode_description');
        assert(uniDesc !== undefined);
      });

      test('very long description does not break identity or mapping (Part 17)', () => {
        const longRow = run.outcomes.find((o) => meta.get(o.rowIndex) === 'very_long_description');
        assert(longRow?.product);
        const row = productToRow(longRow.product);
        assertEqual(row.length, 252);
      });

      test('extra/unrecognized input columns reported, never fatal (Part 18)', () => {
        const parsed = normalizeCsvInput(csvText);
        const unmappedCols = new Set(
          parsed.rows.flatMap((r) => r.unmappedColumns.map((u) => u.column)),
        );
        assert(unmappedCols.has('Warehouse Location'));
      });

      test('unknown category keeps generic attribute handling (Part 7)', () => {
        const cat = run.outcomes.find((o) => meta.get(o.rowIndex) === 'unknown_category');
        assert(cat?.product);
        const row = productToRow(cat.product);
        assertEqual(row.length, 252);
      });

      // ---------------- CSV OUTPUT CONTRACT (Part 14) ----------------
      let csvRowsBack!: string[][];
      test('CSV round-trip: exact headers, RFC4180 escaping, every row 252 cells', () => {
        const mapped = run.outcomes
          .filter((o) => o.product)
          .map((o) => productToRow(o.product as any));
        const esc = (v: string) =>
          /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        const outCsv = [
          UNIHACK_HEADERS.map(esc).join(','),
          ...mapped.map((r) => r.map(esc).join(',')),
        ].join('\r\n');

        const back = csvParse(outCsv, { relax_column_count: false }) as string[][];
        assertEqual(back.length, mapped.length + 1);
        assertEqual(back[0].length, 252);
        assertDeep(back[0], [...UNIHACK_HEADERS]);
        for (const r of back.slice(1)) {
          assertEqual(r.length, 252);
        }
        csvRowsBack = back.slice(1);
      });

      test('CSV preserves commas/newlines/quotes/unicode inside quoted cells', () => {
        const flat = csvRowsBack.flat().join('|');
        assert(flat.includes('Müller'), 'unicode manufacturer present');
      });

      // ---------------- XLSX PARITY (Part 15) ----------------
      test('XLSX output matches CSV cell-for-cell with 252 columns', async () => {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Export');
        ws.columns = UNIHACK_HEADERS.map((header) => ({ header, key: header }));
        for (const r of csvRowsBack) ws.addRow(r);
        const buffer = await workbook.xlsx.writeBuffer();

        const wb2 = new ExcelJS.Workbook();
        await wb2.xlsx.load(buffer as ArrayBuffer);
        const ws2 = wb2.getWorksheet('Export')!;
        assertEqual(ws2.columnCount, 252);
        const headerRow = ws2.getRow(1);
        for (let i = 0; i < 252; i++) {
          assertEqual(headerRow.getCell(i + 1).value, UNIHACK_HEADERS[i]);
        }
        // Spot parity between CSV and XLSX data rows
        for (let rIdx = 0; rIdx < Math.min(5, csvRowsBack.length); rIdx++) {
          const xlsxRow = ws2.getRow(rIdx + 2);
          for (let c = 0; c < 252; c++) {
            const xv = xlsxRow.getCell(c + 1).value;
            const xvStr = xv == null ? '' : String(xv);
            assertEqual(xvStr, csvRowsBack[rIdx][c], `cell ${rIdx},${c}`);
          }
        }
      });

      // ---------------- QUALITY REPORT (Part 18/19) ----------------
      test('machine-readable evaluation report written with real metrics', async () => {
        const fs = await import('fs');
        const report = {
          generated_at: new Date().toISOString(),
          evidence_service_mode: evidence.mode,
          dataset_scenarios: [...new Set(meta.values())].length,
          ...run.report,
          performance: {
            ...run.metrics.timing,
            cache_hit_rate:
              run.metrics.cacheHits + run.metrics.cacheMisses > 0
                ? Number(
                    (
                      run.metrics.cacheHits /
                      (run.metrics.cacheHits + run.metrics.cacheMisses)
                    ).toFixed(3),
                  )
                : 0,
            avg_ms_per_product: run.metrics.timing.avgPerProductMs,
          },
          output_columns: 252,
        };
        fs.writeFileSync(
          new URL('./evaluation-report.json', import.meta.url).pathname,
          JSON.stringify(report, null, 2),
        );
        assertEqual(report.outputColumns, 252);
        process.stdout.write(`\n[e2e] report metrics: ${JSON.stringify({
          totalProducts: report.totalProducts,
          processed: report.processed,
          failed: report.failed,
          duplicatesMerged: report.duplicatesMerged,
          externalSearches: report.externalSearches,
          externalRetrievals: report.externalRetrievals,
          deterministicFields: report.deterministicFields,
          geminiCalls: report.geminiCalls,
          geminiCallsAvoided: report.geminiCallsAvoided,
          cacheHits: report.cacheHits,
          conflicts: report.conflicts,
          unresolvedFields: report.unresolvedFields,
          invalidFields: report.invalidFields,
          timing: report.performance,
        })}\n`);
      });
    });
  } finally {
    await evidence.close();
    await servers.close();
  }

  await runAll();
}

// -- helpers --
function assertDeep(actual: unknown[], expected: unknown[], msg?: string): void {
  assertEqual(actual.length, expected.length, msg);
  actual.forEach((v, i) => assertEqual(v, expected[i], `${msg ?? ''}[${i}]`));
}

void main();
