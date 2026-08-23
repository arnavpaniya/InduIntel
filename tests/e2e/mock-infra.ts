/**
 * Mock external infrastructure for the Stage 5 end-to-end evaluation.
 *
 * - searchApi: implements the EVIDENCE_SEARCH_URL contract (?q= -> results[])
 * - webServer: serves deterministic synthetic product pages by path
 *
 * Both are FICTIONAL fixture servers; no organizer data is embedded.
 */

import { createServer } from 'http';
import type { Server as ClosableServer } from 'http';

export interface MockServers {
  searchUrl: string;
  webRoot: string;
  close: () => Promise<void>;
  /** Paths actually fetched from the web server (request log). */
  fetchedPaths: string[];
  /** Queries received by the mock search API (request log). */
  searchQueries: string[];
}

/** Node http.Server with closeAllConnections (18.2+). */


/** Valid UPC-A/EAN-13 builders for synthetic barcodes. */
function gtinCheckDigit(digits: string): number {
  let sum = 0;
  let pos = 0;
  for (let i = digits.length - 1; i >= 0; i--, pos++) {
    sum += Number(digits[i]) * (pos % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}
function upc12(seed: number): string {
  const base = String(36000000000 + seed * 7919).slice(0, 11);
  return base + gtinCheckDigit(base);
}
function ean13(seed: number): string {
  const base = ('40' + String(63813339300 + seed * 104729)).slice(0, 12);
  return base + gtinCheckDigit(base);
}
function gtin14(seed: number): string {
  const base = ('0012345678' + String(9000 + seed * 13)).slice(0, 13);
  return base + gtinCheckDigit(base);
}

/**
 * Build page HTML per kind. `mpn` is echoed so identity verification holds.
 */
export function buildMockServers(): Promise<MockServers> {
  const fetchedPaths: string[] = [];
  let webRoot = ''; // assigned once the web server is listening

  const pageFor = (kind: string, mpn: string, idx: number): string => {
    switch (kind) {
      case 'det':
        return `<html><head><title>${mpn}</title></head><body>
<h1>Zephyr Dynamics ${mpn}</h1>
<p>Manufacturer: Zephyr Dynamics</p>
<p>MPN: ${mpn}</p>
<p>UPC: ${upc12(idx + 1)}</p>
<p>EAN: ${ean13(idx + 1)}</p>
<p>GTIN-14: ${gtin14(idx + 1)}</p>
<p>Weight: 4.2 kg</p>
<p>Length: 300 mm Width: 150 mm Height: 75 mm</p>
<p>Warranty: 2 years limited.</p>
</body></html>`;
      case 'amb':
        return `<html><body>
<h1>Nordwind Elektrotechnik ${mpn}</h1>
<p>Manufacturer: Nordwind Elektrotechnik</p>
<p>MPN: ${mpn}</p>
<p>Weight: 6.4 kg</p>
<p>Application: suitable for continuous duty in wet locations with high vibration.</p>
<p>Features robust housing and conformal coated electronics for harsh sites.</p>
</body></html>`;
      case 'wrong':
        return `<html><body>
<p>Manufacturer: Cascadia Motors Group</p>
<p>MPN: OTHER-999-DIFFERENT</p>
<p>Weight: 9 kg</p>
</body></html>`;
      case 'conf':
        return `<html><body>
<p>Manufacturer listing for ${mpn}.</p>
<p>MPN: ${mpn}</p>
<p>UPC: ${upc12(idx + 101)}</p>
<p>Weight: 3 kg</p>
<p>Warranty: 1 year</p>
</body></html>`;
      default:
        return '<html><body><p>empty placeholder page</p></body></html>';
    }
  };

  // Product-page server
  const webServer: ClosableServer = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    fetchedPaths.push(decodeURIComponent(url.pathname));
    const parts = url.pathname.split('/').filter(Boolean); // [kind, mpn]
    if (parts.length < 2) {
      res.writeHead(404).end('not found');
      return;
    }
    const [kindRaw, mpnRaw] = parts;
    const kind = kindRaw.replace(/\.html$/, '');
    const mpn = decodeURIComponent(mpnRaw.replace(/\.html$/, ''));
    const idx = Number(url.searchParams.get('i') ?? '0') || 0;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(pageFor(kind, mpn, idx));
  });

  // Search API server: query content decides which fixture pages exist.
  // Mirrors Stage 4 semantics honestly: wrong/missing/limited results are
  // produced by the SEARCH layer exactly like a real provider would.
  const searchQueries: string[] = [];
  const searchServer: ClosableServer = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const q = decodeURIComponent(url.searchParams.get('q') ?? '');
    searchQueries.push(q);
    if (process.env.DEBUG_EVIDENCE && searchQueries.length <= 6) {
      // eslint-disable-next-line no-console
      console.error(`[MOCK_SEARCH] q=${JSON.stringify(q)}`);
    }
    const results: Array<{ url: string; title: string }> = [];

    if (q.includes('DET-')) {
      const mpn = q.split(/\s+/).find((t) => t.startsWith('DET-')) ?? 'DET-X';
      results.push({ url: `${webRoot}/det/${encodeURIComponent(mpn)}`, title: `Zephyr ${mpn}` });
    } else if (q.includes('AMB-')) {
      const mpn = q.split(/\s+/).find((t) => t.startsWith('AMB-')) ?? 'AMB-X';
      results.push({ url: `${webRoot}/amb/${encodeURIComponent(mpn)}`, title: `Nordwind ${mpn}` });
    } else if (q.includes('WRONG-')) {
      results.push({ url: `${webRoot}/wrong/not-the-product`, title: 'Cascadia catalog entry' });
    } else if (/CONF\d*-/.test(q)) {
      const mpn = q.split(/\s+/).find((t) => /^CONF\d*-/.test(t)) ?? 'CONF-X';
      results.push({ url: `${webRoot}/conf/${encodeURIComponent(mpn)}`, title: `Listing ${mpn}` });
    } else if (q.includes('BADURL-')) {
      results.push({ url: 'http://localhost:9/admin', title: 'internal panel' });
      results.push({ url: `${webRoot}/wrong/badurl-7`, title: 'Sketchy Parts Depot' });
    }
    // everything else: zero results (no external source)

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ results }));
  });

  const listen = (srv: ClosableServer, host = '127.0.0.1'): Promise<number> =>
    new Promise((resolve) => srv.listen(0, host, () => resolve((srv.address() as any).port)));

  return new Promise((resolve) => {
    void (async () => {
      const webPort = await listen(webServer);
      const searchPort = await listen(searchServer);
      webRoot = `http://127.0.0.1:${webPort}`;
      resolve({
        searchUrl: `http://127.0.0.1:${searchPort}/search`,
        webRoot,
        fetchedPaths,
        searchQueries,
        close: async () => {
          webServer.close();
          searchServer.close();
          // Destroy keep-alive sockets so the node process can exit.
          webServer.closeAllConnections?.();
          searchServer.closeAllConnections?.();
        },
      });
    })();
  });
}

export interface PythonServiceHandle {
  baseUrl: string;
  mode: 'real' | 'mock';
  close: () => Promise<void>;
}

/**
 * Start the REAL Stage 4 Python evidence service (via the hermetic retrieval
 * fixture wrapper — all discovery/ranking/sanitization/identity/extraction
 * logic is the real code; only fetches are served from fixture pages, since
 * the SSRF guard correctly blocks loopback targets).
 * If Python deps are unavailable, fall back to an in-process contract mock.
 */
export async function startEvidenceService(searchUrl: string, webRoot = ''): Promise<PythonServiceHandle> {
  const { spawn } = await import('child_process');
  const http = await import('http');
  const { randomUUID } = await import('crypto');

  const candidates = [
    process.env.E2E_PYTHON,
    '/Library/Frameworks/Python.framework/Versions/3.13/bin/python3',
    'python3',
  ].filter(Boolean) as string[];

  for (const py of candidates) {
    const port = 20000 + Math.floor(Math.random() * 8000);
    const token = `tok-${randomUUID().slice(0, 8)}`;
    const child = spawn(py, [`${process.cwd()}/tests/e2e/run_evidence_fixture.py`], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        EVIDENCE_SEARCH_URL: searchUrl,
        EVIDENCE_FIXTURE_WEB_ROOT: webRoot,
        EVIDENCE_FIXTURE_TOKEN: token,
        EVIDENCE_PORT: String(port),
        EVIDENCE_TRACE_LOG: process.env.EVIDENCE_TRACE_LOG || '',
        PYTHONPATH: `${process.cwd()}/services/evidence`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const errTail: string[] = [];
    child.stderr?.on('data', (d) => {
      errTail.push(String(d));
      if (errTail.length > 30) errTail.shift();
      if (process.env.DEBUG_EVIDENCE) {
        // eslint-disable-next-line no-console
        console.error(`[EVIDENCE_SVC] ${String(d).slice(0, 300)}`);
      }
    });
    child.on('exit', (code, signal) => {
      if (process.env.DEBUG_EVIDENCE) {
        // eslint-disable-next-line no-console
        console.error(`[EVIDENCE_SVC] exited code=${code} signal=${signal} tail=${errTail.slice(-5).join(' | ').slice(0, 800)}`);
      }
    });

    const baseUrl = `http://127.0.0.1:${port}`;
    // Readiness must confirm the token — a stale orphan on this port will
    // not know it, so we keep polling until OUR child answers, dies, or
    // attempts are exhausted. A 200 with a WRONG token (orphan) retries
    // rather than failing fast: our child will soon take the port over or
    // exit, either of which settles the loop.
    const ready = await new Promise<boolean>((resolve) => {
      let settled = false;
      let attempts = 0;
      const settle = (v: boolean) => {
        if (!settled) { settled = true; resolve(v); }
      };
      const tick = () => {
        attempts++;
        if (child.exitCode != null || attempts > 120) {
          settle(false);
          return;
        }
        const req = http.get(`${baseUrl}/__fixture_ping`, (r) => {
          let body = '';
          r.on('data', (c) => (body += c));
          r.on('end', () => {
            try {
              const ok = r.statusCode === 200 && JSON.parse(body).token === token;
              if (ok) settle(true);
              else setTimeout(tick, 250);
            } catch {
              setTimeout(tick, 250);
            }
          });
        });
        req.on('error', () => setTimeout(tick, 250));
      };
      child.on('exit', () => settle(false));
      tick();
    });

    if (ready) {
      return {
        baseUrl,
        mode: 'real',
        close: async () => {
          child.kill('SIGTERM');
          const killer = setTimeout(() => child.kill('SIGKILL'), 3000);
          child.on('exit', () => clearTimeout(killer));
          child.stdout?.destroy();
          child.stderr?.destroy();
        },
      };
    }
    child.kill('SIGKILL');
  }

  // ---- Fallback: contract-compatible in-process mock ----
  const mockServer: ClosableServer = createServer((req, res) => {
    if (req.method !== 'POST' || !req.url?.includes('/evidence/check')) {
      res.writeHead(404).end();
      return;
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const payload = JSON.parse(body || '{}');
      const mpn: string = payload.mpn ?? '';
      const missing: string[] = payload.missing_fields ?? [];

      // Mirror the real service decision table using the mock web pages.
      const decide = (): any => {
        if (mpn.startsWith('DET-')) {
          return {
            identity_match: true,
            deterministic_fields: {
              upc: { value: upc12(1), uom: '', evidence: `UPC: ${upc12(1)}`, source_url: 'mock://det', confidence: 0.98 },
              weight: { value: 4.2, uom: 'kg', evidence: 'Weight: 4.2 kg', source_url: 'mock://det', confidence: 0.92 },
              warranty: { value: '2 years limited', uom: '', evidence: 'Warranty: 2 years limited.', source_url: 'mock://det', confidence: 0.88 },
              length: { value: 300, uom: 'mm', evidence: 'Length: 300 mm', source_url: 'mock://det', confidence: 0.9 },
              width: { value: 150, uom: 'mm', evidence: 'Width: 150 mm', source_url: 'mock://det', confidence: 0.9 },
              height: { value: 75, uom: 'mm', evidence: 'Height: 75 mm', source_url: 'mock://det', confidence: 0.9 },
            },
            needs_gemini: [],
            unresolved: [],
            reject_reason: null,
          };
        }
        if (mpn.startsWith('AMB-')) {
          return {
            identity_match: true,
            deterministic_fields: {
              weight: { value: 6.4, uom: 'kg', evidence: 'Weight: 6.4 kg', source_url: 'mock://amb', confidence: 0.92 },
            },
            needs_gemini: missing.filter((f) => f !== 'weight'),
            unresolved: [],
            reject_reason: null,
          };
        }
        if (/^CONF\d*-/.test(mpn)) {
          return {
            identity_match: true,
            deterministic_fields: {
              weight: { value: 3, uom: 'kg', evidence: 'Weight: 3 kg', source_url: 'mock://conf', confidence: 0.92 },
            },
            needs_gemini: [],
            unresolved: missing.filter((f) => f !== 'weight'),
            reject_reason: null,
          };
        }
        return {
          identity_match: false,
          deterministic_fields: {},
          needs_gemini: [],
          unresolved: missing,
          reject_reason: 'no candidate matched after retrieval(s)',
        };
      };

      const d = decide();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true, needs_search: true,
        source: d.identity_match ? { url: 'mock://src', title: 'Mock', domain: 'mock', source_type: 'unknown', authority_tier: 4, retrieved_at: new Date().toISOString() } : null,
        identity_confidence: d.identity_match ? 0.99 : 0.0,
        evidence: Object.entries(d.deterministic_fields as Record<string, any>).map(([field, v]) => ({
          field, value: v.value, uom: v.uom, evidence: v.evidence, source_url: v.source_url, confidence: v.confidence,
        })),
        ...d,
      }));
    });
  });
  const port = await listen(mockServer);
  function listen(srv: ClosableServer): Promise<number> {
    return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve((srv.address() as any).port)));
  }
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    mode: 'mock',
    close: async () => {
      mockServer.close();
      mockServer.closeAllConnections?.();
    },
  };
}
