/**
 * Stage 6 — Search provider live smoke test (ONE real search).
 *
 * Requires EVIDENCE_SEARCH_URL + EVIDENCE_SEARCH_API_KEY (Tavily).
 * Prints candidate count and URLs/titles ONLY — never the API key.
 * Do not run repeatedly (consumes search credits).
 *
 * Usage: npx tsx scripts/search-provider-smoke.ts [optional-query]
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function main(): Promise<void> {
  const url = process.env.EVIDENCE_SEARCH_URL ?? '';
  const key = process.env.EVIDENCE_SEARCH_API_KEY ?? '';

  console.log('\n=== SEARCH PROVIDER SMOKE TEST ===');
  if (!url || !key) {
    console.log('SEARCH PROVIDER NOT CONFIGURED.');
    console.log('Set EVIDENCE_SEARCH_URL and EVIDENCE_SEARCH_API_KEY (see DEPLOYMENT.md section 4).');
    process.exitCode = 1;
    return;
  }
  console.log(`Provider endpoint host: ${new URL(url).host}`);
  console.log(`API key present:        ✓ (${key.length} chars, value hidden)`);

  const isTavily = url.toLowerCase().includes('tavily.com');
  const query = process.argv[2] ?? 'DeWalt DCD771C2 drill driver specifications';

  let resp: Response;
  const t0 = Date.now();
  try {
    if (isTavily) {
      // Official Tavily contract (verified against docs.tavily.com):
      // POST /search with Bearer auth; basic depth; no generated answer.
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          query,
          max_results: 5,
          search_depth: 'basic',
          include_answer: false,
          include_raw_content: false,
        }),
      });
    } else {
      // Generic GET ?q= contract.
      resp = await fetch(`${url}?q=${encodeURIComponent(query)}`, {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
      });
    }
  } catch (err) {
    console.log(`✗ request failed: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
    return;
  }

  const ms = Date.now() - t0;
  if (!resp.ok) {
    // Status codes only — response bodies could echo auth problems but never
    // contain the key itself; still, print nothing beyond the status.
    console.log(`✗ HTTP ${resp.status} after ${ms}ms`);
    process.exitCode = 1;
    return;
  }

  const data = await resp.json();
  const results: Array<{ url?: unknown; title?: unknown }> = Array.isArray(data?.results) ? data.results : [];
  const candidates = results
    .filter((r): r is { url: string; title: string } =>
      typeof r === 'object' && r !== null && typeof (r as any).url === 'string')
    .map((r) => ({ url: r.url.trim(), title: typeof r.title === 'string' ? r.title : '' }));

  console.log(`Query "${query}" -> HTTP ${resp.status} in ${ms}ms, ${candidates.length} candidate(s):`);
  for (const c of candidates.slice(0, 5)) {
    console.log(`  - ${c.url}${c.title ? `  | ${c.title.slice(0, 70)}` : ''}`);
  }

  if (isTavily && typeof data.answer === 'string' && data.answer.length > 0) {
    console.log('  (note: Tavily answer field ignored by design — URLs/titles only)');
  }

  process.exitCode = candidates.length > 0 ? 0 : 1;
}

void main();
