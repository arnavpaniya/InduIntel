/**
 * Minimal TypeScript test harness (Stage 5).
 *
 * Zero-dependency runner compatible with `npx tsx tests/run-unit.ts`.
 *
 * Semantics:
 * - Tests execute SERIALLY in registration order via a single flat chain.
 * - describe() only contributes the name prefix (synchronous push/pop) and,
 *   when awaited, waits until every test registered inside it has settled.
 * - Runners MUST `await drained()` between suite imports so prefixes and
 *   fixture lifecycles stay correct (see tests/run-unit.ts).
 */

let passed = 0;
let failed = 0;
let chain: Promise<void> = Promise.resolve();
let pendingAtDrainCheck = 0;
const failures: Array<{ name: string; error: string }> = [];
const prefixStack: string[] = [];

/** True while any describe scope is open. */
let scopeDepth = 0;

export function describe(name: string, fn: () => void | Promise<void>): Promise<void> {
  prefixStack.push(name);
  scopeDepth++;
  const result = (async () => {
    try {
      await fn();
      // Drain until no NEW tests appear (handles late registrations).
      for (;;) {
        const before = chain;
        await before;
        if (chain === before) break; // no new tests chained during the wait
      }
    } finally {
      scopeDepth--;
      prefixStack.pop();
    }
  })();
  return result;
}

export function test(name: string, fn: () => void | Promise<void>): void {
  const fullName = [...prefixStack, name].join(' > ');
  const run = async (): Promise<void> => {
    try {
      await fn();
      passed++;
      process.stdout.write(`  ok   ${fullName}\n`);
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ name: fullName, error: message });
      process.stdout.write(`  FAIL ${fullName}\n       ${message}\n`);
    }
  };
  const prev = chain;
  chain = prev.then(run, run);
}

/**
 * Resolves once every test registered SO FAR has finished executing.
 * Call between suite imports so prefixes/lifecycle stay ordered.
 */
export async function drained(): Promise<void> {
  for (;;) {
    const before = chain;
    await before;
    if (chain === before && !scopeDepth) break;
    if (chain === before) break; // chain stable even if a scope is technically open
  }
  void pendingAtDrainCheck;
}

/** Print the summary. Returns process exit code. */
export async function runAll(): Promise<number> {
  await drained();
  process.stdout.write(`\n=== ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    process.stdout.write('\nFailed:\n');
    for (const f of failures) {
      process.stdout.write(`  - ${f.name}\n    ${f.error.split('\n')[0]}\n`);
    }
  }
  return failed > 0 ? 1 : 0;
}

// ---- Assertions -----------------------------------------------------------

export function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? 'assertion failed');
  }
}

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(message ?? `expected ${e}, got ${a}`);
  }
}

export function assertDeepEqual(actual: unknown, expected: unknown, message?: string): void {
  assertEqual(actual, expected, message);
}

export function assertGreaterThan(actual: number, min: number, message?: string): void {
  if (!(actual > min)) {
    throw new Error(message ?? `expected ${actual} > ${min}`);
  }
}

export function assertGreaterOrEqual(actual: number, min: number, message?: string): void {
  if (!(actual >= min)) {
    throw new Error(message ?? `expected ${actual} >= ${min}`);
  }
}

export function assertIncludes(haystack: string | unknown[], needle: unknown, message?: string): void {
  const ok = typeof haystack === 'string' ? haystack.includes(String(needle)) : haystack.includes(needle);
  if (!ok) {
    throw new Error(message ?? `expected ${JSON.stringify(haystack).slice(0, 200)} to include ${JSON.stringify(needle)}`);
  }
}

export function assertThrows(fn: () => unknown, message?: string): Error {
  try {
    fn();
  } catch (err) {
    return err as Error;
  }
  throw new Error(message ?? 'expected function to throw');
}
