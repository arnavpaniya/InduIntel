/**
 * Unit tests for Gemini retry logic, error propagation, and backoff behaviour.
 *
 * Uses the project's lightweight harness (no Jest) so it can run via
 *   npx tsx tests/run-unit.ts
 */
import {
  describe, test, assert, assertEqual, assertIncludes,
} from '../helpers/harness';
import { callLLMWithRetry, type LLMOptions, type LLMResponse } from '../../lib/ai/gemini';

// ---- Test-only fake for callLLM -----------------------------------------

type FakeCallLLM = <T = unknown>(prompt: string, options?: LLMOptions) => Promise<LLMResponse<T>>;

function makeFake(responses: LLMResponse[]): { fake: FakeCallLLM; calls: string[] } {
  let idx = 0;
  const calls: string[] = [];
  const fake: FakeCallLLM = async <T>(prompt: string, _options?: LLMOptions): Promise<LLMResponse<T>> => {
    calls.push(prompt);
    const r = responses[Math.min(idx, responses.length - 1)] as LLMResponse<T>;
    idx++;
    return r;
  };
  return { fake, calls };
}

// ---- Tests ---------------------------------------------------------------

describe('gemini: callLLMWithRetry', () => {

  test('returns immediately on first-attempt success', async () => {
    const { fake, calls } = makeFake([
      { data: { ok: true }, raw: '{"ok":true}', error: null },
    ]);
    const res = await callLLMWithRetry('hello', {}, 2, undefined, fake as any);
    assertEqual(res.data !== null, true);
    assertEqual(res.attempts, 1);
    assertEqual(calls.length, 1);
  });

  test('retries on transient 429 and succeeds on second attempt', async () => {
    const { fake, calls } = makeFake([
      { data: null, raw: '', error: 'Gemini API error: 429 Too Many Requests' },
      { data: { ok: true }, raw: '{"ok":true}', error: null },
    ]);
    let onAttemptCount = 0;
    const onAttempt = async () => { onAttemptCount++; };

    const res = await callLLMWithRetry('hello', {}, 2, onAttempt, fake as any);
    assertEqual(res.data !== null, true);
    assertEqual(res.attempts, 2);
    assertEqual(calls.length, 2);
    assertEqual(onAttemptCount, 2);
  });

  test('bubbles up 503 error after exhausting retries', async () => {
    const { fake, calls } = makeFake([
      { data: null, raw: '', error: 'Gemini API error: 503 Service Unavailable' },
    ]);

    const res = await callLLMWithRetry('hello', {}, 2, undefined, fake as any);
    assertEqual(res.data, null);
    assertEqual(res.attempts, 3); // 1 original + 2 retries
    assertIncludes(res.error!, '503 Service Unavailable');
    assertEqual(calls.length, 3);
  });

  test('does NOT retry on fatal 401 Unauthorized', async () => {
    const { fake, calls } = makeFake([
      { data: null, raw: '', error: 'Gemini API error: 401 Unauthorized' },
    ]);

    const res = await callLLMWithRetry('hello', {}, 2, undefined, fake as any);
    assertEqual(res.data, null);
    assertIncludes(res.error!, '401 Unauthorized');
    assertEqual(calls.length, 1); // no retries
  });

  test('does NOT retry on fatal 403 Forbidden', async () => {
    const { fake, calls } = makeFake([
      { data: null, raw: '', error: 'Gemini API error: 403 Forbidden' },
    ]);

    const res = await callLLMWithRetry('hello', {}, 2, undefined, fake as any);
    assertEqual(res.data, null);
    assertIncludes(res.error!, '403 Forbidden');
    assertEqual(calls.length, 1);
  });

  test('retries JSON parse errors with an augmented prompt', async () => {
    const { fake, calls } = makeFake([
      { data: null, raw: 'not json!', error: 'JSON parse error: Unexpected token n' },
      { data: { ok: true }, raw: '{"ok":true}', error: null },
    ]);

    const res = await callLLMWithRetry('original prompt', {}, 2, undefined, fake as any);
    assertEqual(res.data !== null, true);
    assertEqual(res.attempts, 2);
    assertEqual(calls.length, 2);

    // First call uses original prompt
    assertEqual(calls[0], 'original prompt');

    // Second call includes the retry instruction AND the previous bad output
    assertIncludes(calls[1], 'IMPORTANT: Your previous response was not valid JSON');
    assertIncludes(calls[1], 'not json!');
  });

  test('retries 500 errors with exponential backoff pattern', async () => {
    const { fake, calls } = makeFake([
      { data: null, raw: '', error: 'Gemini API error: 500 Internal Server Error' },
      { data: null, raw: '', error: 'Gemini API error: 500 Internal Server Error' },
      { data: { ok: true }, raw: '{"ok":true}', error: null },
    ]);

    const res = await callLLMWithRetry('hello', {}, 2, undefined, fake as any);
    assertEqual(res.data !== null, true);
    assertEqual(res.attempts, 3);
    assertEqual(calls.length, 3);
  });

  test('error string is never the generic "Max retries exceeded" alone', async () => {
    const { fake } = makeFake([
      { data: null, raw: '', error: 'Gemini API error: 429 rate limit (status 429)' },
    ]);

    const res = await callLLMWithRetry('hello', {}, 1, undefined, fake as any);
    assertEqual(res.data, null);
    // The error MUST contain the actual underlying message, not just "Max retries exceeded"
    assert(res.error !== 'Max retries exceeded - see logs for underlying errors',
      'error must not be the old generic message');
    assertIncludes(res.error!, '429');
  });

  test('attempts count is accurate with zero retries allowed', async () => {
    const { fake } = makeFake([
      { data: null, raw: '', error: 'Gemini API error: 500 Internal Server Error' },
    ]);

    const res = await callLLMWithRetry('hello', {}, 0, undefined, fake as any);
    assertEqual(res.data, null);
    assertEqual(res.attempts, 1);
    assertIncludes(res.error!, '500');
  });
});
