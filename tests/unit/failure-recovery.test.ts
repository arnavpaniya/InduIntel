/**
 * Stage 6, Part 13: Production-style failure recovery.
 * Verifies the pipeline continues through every failure class and that
 * unresolved stays unresolved — nothing fabricated to mask failures.
 */
import {
  describe, test, assert, assertEqual, assertGreaterThan,
} from '../helpers/harness';
import http from 'http';
import {
  runPipeline,
} from '../../lib/pipeline/orchestrator';
import { normalizeInputRecord, type NormalizedInputRow } from '../../lib/input/input-normalizer';
import { fetchEvidence } from '../../lib/evidence/client';

function row(data: Record<string, string>, index = 0): NormalizedInputRow {
  return normalizeInputRecord(data, index, []);
}
const noGemini = async () => ({ values: null, error: 'not called' });

function listen(srv: http.Server): Promise<number> {
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve((srv.address() as any).port)));
}

describe('failure recovery: evidence service', () => {
  test('connection refused -> null, products still processed', async () => {
    const r = await fetchEvidence(
      { manufacturer: 'A', brand: '', mpn: 'M-1', description: '', category: '', missing_fields: ['upc'] },
      { serviceUrl: 'http://127.0.0.1:59990', timeoutMs: 1000 },
    );
    assertEqual(r, null);
  });

  test('HTTP 500 -> null', async () => {
    const srv = http.createServer((_, res) => { res.writeHead(500); res.end('boom'); });
    const port = await listen(srv);
    const r = await fetchEvidence(
      { manufacturer: 'A', brand: '', mpn: 'M-1', description: '', category: '', missing_fields: [] },
      { serviceUrl: `http://127.0.0.1:${port}`, timeoutMs: 2000 },
    );
    srv.close();
    assertEqual(r, null);
  });

  test('malformed JSON body -> null', async () => {
    const srv = http.createServer((_, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{not json'); });
    const port = await listen(srv);
    const r = await fetchEvidence(
      { manufacturer: 'A', brand: '', mpn: 'M-1', description: '', category: '', missing_fields: [] },
      { serviceUrl: `http://127.0.0.1:${port}`, timeoutMs: 2000 },
    );
    srv.close();
    assertEqual(r, null);
  });

  test('timeout aborts and returns null (no hang)', async () => {
    const srv = http.createServer(() => { /* never respond */ });
    srv.on('request', () => { /* hold */ });
    const port = await listen(srv);
    const t0 = Date.now();
    const r = await fetchEvidence(
      { manufacturer: 'A', brand: '', mpn: 'M-1', description: '', category: '', missing_fields: [] },
      { serviceUrl: `http://127.0.0.1:${port}`, timeoutMs: 700 },
    );
    const elapsed = Date.now() - t0;
    srv.close();
    srv.closeAllConnections?.();
    assertEqual(r, null);
    assert(elapsed < 4000, `abort took ${elapsed}ms`);
  });

  test('rate limit (429) then success -> recovers', async () => {
    let n = 0;
    const srv = http.createServer((_, res) => {
      if (n++ === 0) { res.writeHead(429, { 'Retry-After': '1' }); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true, needs_search: true, source: null,
        identity_match: true, identity_confidence: 0.99, reject_reason: null,
        evidence: [], deterministic_fields: {}, needs_gemini: [],
        unresolved: [],
      }));
    });
    const port = await listen(srv);
    // First call hits the 429 -> null; second succeeds.
    const first = await fetchEvidence(
      { manufacturer: 'A', brand: '', mpn: 'M-1', description: '', category: '', missing_fields: [] },
      { serviceUrl: `http://127.0.0.1:${port}`, timeoutMs: 3000 },
    );
    const second = await fetchEvidence(
      { manufacturer: 'A', brand: '', mpn: 'M-1', description: '', category: '', missing_fields: [] },
      { serviceUrl: `http://127.0.0.1:${port}`, timeoutMs: 3000 },
    );
    srv.close();
    srv.closeAllConnections?.();
    assertEqual(first === null || first?.identity_match === true, true);
    assertEqual(second?.identity_match, true, 'recovers after rate limit');
  });

  test('dataset survives ALL services down: search, evidence dead, gemini absent', async () => {
    const rows = [
      row({ MPN: 'R-1', Manufacturer: 'Acme', Description: 'Industrial pump assembly with stainless housing' }, 0),
      row({ Description: 'orphan product with no identity at all here' }, 1),
      row({ MPN: 'R-3', Manufacturer: 'Beta', Description: 'Pneumatic valve manifold heavy duty series' }, 2),
    ];
    const r = await runPipeline(rows, {
      evidenceServiceUrl: 'http://127.0.0.1:59991',
      evidenceTimeoutMs: 800,
      gemini: noGemini,
    });
    assertEqual(r.metrics.failed, 0);
    assertEqual(r.metrics.processed, 3);
    for (const o of r.outcomes) {
      assert(o.product != null);
      // Nothing may appear out of thin air
      assertEqual(o.product!.upc, null);
      assertEqual(o.product!.gtin, null);
    }
    assertGreaterThan(r.metrics.unresolvedFields, 0);
  });
});
