/**
 * Stage 5 unit + contract test runner.
 * Usage: npx tsx tests/run-unit.ts
 */
import { runAll, drained } from './helpers/harness';

async function main(): Promise<void> {
  // Import each suite, then drain its tests before loading the next so
  // name prefixes and fixture lifecycles stay ordered.
  await import('./unit/input-normalizer.test');
  await drained();
  await import('./unit/identity.test');
  await drained();
  await import('./unit/conflicts.test');
  await drained();
  await import('./unit/output-contract.test');
  await drained();
  await import('./unit/orchestrator.test');
  await drained();
  await import('./unit/failure-recovery.test');
  const code = await runAll();
  process.exitCode = code;
}

void main();
