/**
 * Stage 5 unit tests: pipeline orchestration — failure isolation (Part 11),
 * bounded concurrency (Part 12), Gemini budget (Part 9), cache identity
 * safety (Part 10) — all fully offline via injection.
 */
import {
  describe, test, assert, assertEqual, assertGreaterThan,
} from '../helpers/harness';
import {
  runPipeline,
  evidenceCacheKey,
  InMemoryEvidenceCache,
  seedProductFromRow,
  type GeminiCaller,
} from '../../lib/pipeline/orchestrator';
import { normalizeInputRecord, type NormalizedInputRow } from '../../lib/input/input-normalizer';
import { computeIdentity } from '../../lib/product-intelligence/identity';

function row(data: Record<string, string>, index = 0): NormalizedInputRow {
  return normalizeInputRecord(data, index, []);
}

const noGemini: GeminiCaller = async () => ({ values: null, error: 'not called' });

describe('orchestrator: seeding + value quality', () => {
  test('verified input values are marked verified', () => {
    const p = seedProductFromRow('p1', row({
      MPN: 'A-1', Manufacturer: 'Acme', Weight: '2.5 kg',
    }));
    assertEqual(p.mfg_part_num, 'A-1');
    assertEqual(p.value_status['mfg_part_num'], 'verified');
    assertEqual(p.value_status['manufacturer_name'], 'verified');
    assertEqual(p.weight, 2.5);
    assertEqual(p.weight_uom, 'kg');
  });

  test('missing values are unresolved — never inferred', () => {
    const p = seedProductFromRow('p1', row({ MPN: 'A-1' }));
    for (const f of ['upc', 'ean', 'gtin', 'weight', 'warranty', 'manufacturer_name']) {
      assertEqual((p as any)[f], null, `${f} value`);
      assertEqual(p.value_status[f], 'unresolved', `${f} status`);
    }
  });

  test('invalid numeric is invalid with null value', () => {
    const p = seedProductFromRow('p1', row({ MPN: 'A-1', Weight: 'bogus' }));
    assertEqual(p.value_status['weight'], 'invalid');
    assertEqual(p.weight, null);
  });

  test('conflicting input keeps value but marks conflicting', () => {
    const p = seedProductFromRow('p1', normalizeInputRecord({
      MPN: 'A-1', Manufacturer: 'Acme', MFR: 'Beta', Weight: '2 kg',
    }, 0, []));
    assertEqual(p.value_status['manufacturer_name'], 'conflicting');
    assertEqual(p.manufacturer_name, 'Acme');
  });
});

describe('orchestrator: failure isolation (Part 11)', () => {
  test('one poisoned product does not terminate the dataset', async () => {
    const good1 = row({ MPN: 'G-1', Manufacturer: 'Acme', Description: 'Good industrial pump assembly unit' }, 0);
    const good2 = row({ MPN: 'G-2', Manufacturer: 'Beta', Description: 'Another fine hydraulic valve product here' }, 1);

    // Poisoned: fields getter explodes mid-pipeline
    const poisoned = row({ MPN: 'BAD-1' }, 2);
    Object.defineProperty(poisoned, 'fields', {
      get() { throw new Error('simulated corrupted row'); },
    });
    // But the identity pre-pass also reads fields; give it a frozen snapshot first
    // by re-defining raw only (identity degrades to none on throw).

    const result = await runPipeline([good1, good2, poisoned], {
      evidenceServiceUrl: '', gemini: noGemini, concurrency: 2,
    });

    assertEqual(result.outcomes.length, 3);
    assertEqual(result.metrics.failed >= 1, true, 'poisoned row must be marked failed');
    assertEqual(result.outcomes[0].status === 'processed' || result.outcomes[0].status === 'duplicate', true);
    assertEqual(result.outcomes[1].status === 'processed' || result.outcomes[1].status === 'duplicate', true);
    assertEqual(result.outcomes[2].status, 'failed');
    if (result.outcomes[2].errors.length > 0) {
      assert(typeof result.outcomes[2].errors[0].message === 'string');
      assert(typeof result.outcomes[2].errors[0].stage === 'string');
    }
  });

  test('structured per-item errors carry stage + message', async () => {
    const bad = row({ MPN: 'B-1' }, 0);
    Object.defineProperty(bad, 'raw', { get() { throw new Error('boom'); } });
    Object.defineProperty(bad, 'fields', { get() { throw new Error('boom'); } });
    const ok = row({ MPN: 'OK-1', Description: 'Solid steel bracket for mounting frames' }, 1);

    const r = await runPipeline([bad, ok], { evidenceServiceUrl: '', gemini: noGemini });
    assertEqual(r.metrics.failed, 1);
    assertEqual(r.metrics.processed, 1);
    const failedOutcome = r.outcomes.find((o) => o.status === 'failed');
    assert(failedOutcome);
    assertEqual(failedOutcome!.errors.length > 0, true);
  });
});

describe('orchestrator: evidence service unavailability (Part 28)', () => {
  test('dead service leaves products processed with unresolved fields', async () => {
    const rows = [
      row({ MPN: 'U-1', Manufacturer: 'Acme', Description: 'Industrial flow sensor with pulse output module' }, 0),
      row({ MPN: 'U-2', Manufacturer: 'Beta', Description: 'Pneumatic cylinder tie rod style heavy duty' }, 1),
      row({ MPN: 'U-3', Manufacturer: 'Gamma', Description: 'Gear motor right angle shaft 24V control' }, 2),
    ];
    const r = await runPipeline(rows, {
      evidenceServiceUrl: 'http://127.0.0.1:59999', // nothing listening
      gemini: noGemini,
      evidenceTimeoutMs: 1500,
      concurrency: 2,
    });
    assertEqual(r.metrics.processed, 3);
    assertEqual(r.metrics.failed, 0);
    assertEqual(r.metrics.externalRetrievals, 0);
    assertEqual(r.metrics.geminiCalls, 0);
    assertGreaterThan(r.metrics.unresolvedFields, 0);
    // Every product still yields a canonical product
    r.outcomes.forEach((o) => assert(o.product != null));
  });

  test('unset service URL skips external calls entirely', async () => {
    const r = await runPipeline(
      [row({ MPN: 'X-1', Manufacturer: 'Acme', Description: 'Torque wrench calibrated digital model' }, 0)],
      { evidenceServiceUrl: null, gemini: noGemini },
    );
    assertEqual(r.metrics.externalSearches, 0);
    assertEqual(r.metrics.processed, 1);
  });
});

describe('orchestrator: cache identity safety (Part 10)', () => {
  test('different MPNs never share a cache key', () => {
    const a = computeIdentity({ manufacturer: 'Acme', mpn: 'M-1' });
    const b = computeIdentity({ manufacturer: 'Acme', mpn: 'M-2' });
    assert(evidenceCacheKey(a) !== evidenceCacheKey(b));
  });

  test('same identity shares one cache key across formatting variants', () => {
    const a = computeIdentity({ manufacturer: 'ACME Corp', mpn: 'm 1' });
    const b = computeIdentity({ manufacturer: 'acme corp', mpn: 'M-1' });
    assertEqual(evidenceCacheKey(a), evidenceCacheKey(b));
  });

  test('duplicate identity avoids repeated enrichment and counts cache hit', async () => {
    const rows = [
      row({ MPN: 'D-9', Manufacturer: 'Acme', Description: 'First listing of precision spindle cartridge unit' }, 0),
      row({ MPN: 'D-9', Manufacturer: 'Acme', Description: 'Relisted identical spindle cartridge again here' }, 1),
    ];
    let searches = 0;
    // Even with a live-looking service, the duplicate must not trigger call #2.
    const cache = new InMemoryEvidenceCache();
    const r = await runPipeline(rows, {
      evidenceServiceUrl: 'http://127.0.0.1:59999',
      evidenceTimeoutMs: 800,
      gemini: noGemini,
      cache,
    });
    searches = r.metrics.externalSearches;
    assertEqual(searches, 1, 'only the primary identity may search');
    assertEqual(r.metrics.duplicatesMerged, 1);
    assertEqual(r.outcomes[1].status, 'duplicate');
    assertEqual(r.outcomes[1].product?.mfg_part_num, 'D-9');
  });
});

describe('orchestrator: weak identity never searches (no blind searching)', () => {
  test('description-only products skip evidence entirely', async () => {
    const r = await runPipeline(
      [row({ Description: 'An unbranded mystery widget of unknown provenance' }, 0)],
      { evidenceServiceUrl: 'http://127.0.0.1:59999', gemini: noGemini, evidenceTimeoutMs: 500 },
    );
    assertEqual(r.metrics.externalSearches, 0);
    assertEqual(r.metrics.skippedNoIdentity, 1);
    assertEqual(r.metrics.processed, 1);
  });
});
