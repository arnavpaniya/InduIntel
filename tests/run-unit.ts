/**
 * Stage 5 unit + contract test runner.
 * Usage: npx tsx tests/run-unit.ts
 */
import { runAll } from './helpers/harness';

async function main(): Promise<void> {
  // Import side-effectful suites (they queue+run tests into the harness)
  await import('./unit/input-normalizer.test');
  await import('./unit/identity.test');
  await import('./unit/conflicts.test');
  await import('./unit/output-contract.test');
  await import('./unit/orchestrator.test');
  const code = await runAll();
  process.exitCode = code;
}

void main();
