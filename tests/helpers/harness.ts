/**
 * Minimal TypeScript test harness (Stage 5).
 *
 * Zero-dependency runner compatible with `npx tsx tests/run-unit.ts`.
 *
 * Semantics: test bodies are chained onto an internal tail promise and
 * EXECUTE INLINE as they are registered — so fixture servers created around
 * a describe block stay alive while its tests actually run. describe()
 * awaits its own children before returning.
 */

let passed = 0;
let failed = 0;
const failures: Array<{ name: string; error: string }> = [];

/** Serial execution chain for the CURRENTLY OPEN describe scope. */
let tail: Promise<void> = Promise.resolve();
/** Name path of the currently OPEN describe scope (captured per scope). */
let currentPrefix: string[] = [];

export function describe(name: string, fn: () => void | Promise<void>): Promise<void> {
  const previousTail = tail;
  const savedPrefix = currentPrefix;
  const childPrefix = [...savedPrefix, name];
  tail = Promise.resolve();
  const scope = (async () => {
    try {
      await fn();
      await tail;
    } finally {
      currentPrefix = savedPrefix;
    }
  })();
  // Restore the outer chain so sibling scopes serialize too.
  tail = previousTail.then(() => scope, () => scope);
  return scope;
}

export function test(name: string, fn: () => void | Promise<void>): void {
  const fullName = [...currentPrefix, name].join(' > ');
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
  // Chain onto the open scope regardless of whether the caller awaits us.
  tail = tail.then(run, run);
}

/**
 * Barrier kept for runner compatibility: by the time imports settle, the
 * tail chains have already executed. Returns process exit code.
 */
export async function runAll(): Promise<number> {
  await tail.catch(() => undefined);
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
