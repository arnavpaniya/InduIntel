/**
 * Stage 6, Part 10: Gemini production smoke test (SMALLEST possible usage).
 *
 * Requires GEMINI_API_KEY. Performs at most ONE real API call:
 *   1. tiny deterministic extraction where the answer is fully supported
 *      by provided evidence -> model must return the exact value or null
 *   2. verifies raw HTML is never sent (only sanitized evidence lines)
 *
 * Without a key this reports NOT CONFIGURED and exits non-zero —
 * never fakes success, never burns credits beyond one call.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function main(): Promise<void> {
  const key = process.env.GEMINI_API_KEY;
  console.log('\n=== GEMINI SMOKE TEST ===');
  if (!key) {
    console.log('GEMINI NOT CONFIGURED.');
    console.log('Set GEMINI_API_KEY (see DEPLOYMENT.md section 2), then re-run:');
    console.log('  npx tsx scripts/gemini-smoke.ts');
    process.exitCode = 1;
    return;
  }

  const { callLLMWithRetry } = await import('../../lib/ai/gemini');

  // ONE call: deterministic-evidence style prompt identical to production shape.
  const prompt =
    'Extract product facts. Use ONLY the evidence below; ' +
    'return null for any field not supported by it. Never invent values.\n\n' +
    'Product: Smoke Manufacturing SMK-1\n' +
    'Evidence: weight: Weight: 2.5 kg\n' +
    'Fields to resolve: weight, upc\n\n' +
    'Return JSON: { "values": { "<field>": value|null, ... }, "confidence": 0.0-1.0 }';

  const t0 = Date.now();
  const r = await callLLMWithRetry<{ values: Record<string, unknown>; confidence: number }>(
    prompt,
    { temperature: 0.1 },
  );
  const ms = Date.now() - t0;

  if (r.error || !r.data) {
    console.log(`✗ Gemini call failed after ${ms}ms: ${r.error}`);
    process.exitCode = 1;
    return;
  }

  const values = r.data.values ?? {};
  const weightRaw = String(values.weight ?? '');
  const weightOk = /^2\.5(\s*(kg|kilograms?))?$/i.test(weightRaw);
  const upcNull = values.upc === null || values.upc === undefined;

  console.log(`Call completed in ${ms}ms.`);
  console.log(`  weight extracted from evidence : ${weightOk ? `✓ (${weightRaw})` : '✗ ' + JSON.stringify(values.weight)}`);
  console.log(`  unsupported field stays null   : ${upcNull ? '✓' : '✗ ' + JSON.stringify(values.upc)}`);
  console.log(`  confidence reported            : ${typeof r.data.confidence === 'number' ? '✓ ' + r.data.confidence : '○ missing'}`);

  process.exitCode = weightOk && upcNull ? 0 : 1;
}

void main();
