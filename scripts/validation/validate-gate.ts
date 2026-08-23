/**
 * Stage 6, Part 20: One-command validation gate.
 *
 *   npm run validate:unihack
 *
 * Runs (non-destructively):
 *   1. TypeScript check        npx tsc --noEmit
 *   2. Lint                    npm run lint
 *   3. Build                   npm run build
 *   4. Python compile          python -m compileall services/evidence
 *   5. Python tests            python -m pytest services/evidence/tests
 *   6. Output validator        scripts/validate-unihack-output.ts (CSV + XLSX)
 *   7. Environment check       scripts/check-production-env.ts
 *
 * Every step runs even if an earlier one fails; the final exit code is
 * non-zero when ANY step fails. Never prints secret values.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';

interface StepResult {
  name: string;
  ok: boolean;
  detail: string;
}

const results: StepResult[] = [];

function run(name: string, cmd: string[], opts: { cwd?: string } = {}): void {
  process.stdout.write(`\n▶ ${name}: ${cmd.join(' ')}\n`);
  const r = spawnSync(cmd[0], cmd.slice(1), {
    encoding: 'utf-8',
    cwd: opts.cwd ?? process.cwd(),
    env: { ...process.env, PYTHONPATH: `${process.cwd()}/services/evidence` },
    timeout: 600_000,
  });
  const ok = r.status === 0;
  const tail = ((r.stdout ?? '') + (r.stderr ?? '')).trim().split('\n').slice(-4).join('\n');
  results.push({ name, ok, detail: ok ? 'ok' : `exit=${r.status}\n${tail}` });
  console.log(`  ${ok ? '✓ PASS' : '✗ FAIL'} (${r.status ?? 'signal'})`);
}

async function main(): Promise<void> {
  console.log('\n=== UNIHACK FINAL VALIDATION GATE ===');

  // 1–3: TypeScript toolchain
  run('TypeScript', ['npx', 'tsc', '--noEmit']);
  run('Lint', ['npm', 'run', 'lint']);
  run('Build', ['npm', 'run', 'build']);

  // 4–5: Python evidence service
  const py = process.env.E2E_PYTHON
    || ['/Library/Frameworks/Python.framework/Versions/3.13/bin/python3', 'python3']
      .find((p) => existsSync(p.split('/').slice(0, -1).join('/'))) // cheap existence probe
    || 'python3';
  run('Python compile', [py, '-m', 'compileall', '-q', 'services/evidence']);
  run('Python tests', [py, '-m', 'pytest', 'services/evidence/tests', '-q']);

  // 6: Submission outputs (regenerate if missing)
  if (!existsSync('reports/unihack-final-sample.csv')) {
    run('Regenerate outputs', ['npx', 'tsx', 'scripts/run-unihack-pipeline.ts']);
  }
  if (existsSync('reports/unihack-final-sample.csv')) {
    run('Validate CSV output', ['npx', 'tsx', 'scripts/validate-unihack-output.ts', 'reports/unihack-final-sample.csv']);
  } else {
    results.push({ name: 'Validate CSV output', ok: false, detail: 'reports/unihack-final-sample.csv not found' });
    console.log('\n✗ Validate CSV output: file missing');
  }
  if (existsSync('reports/unihack-final-sample.xlsx')) {
    run('Validate XLSX output', ['npx', 'tsx', 'scripts/validate-unihack-output.ts', 'reports/unihack-final-sample.xlsx']);
  } else {
    results.push({ name: 'Validate XLSX output', ok: false, detail: 'reports/unihack-final-sample.xlsx not found' });
    console.log('\n✗ Validate XLSX output: file missing');
  }

  // 7: Environment presence
  const env = spawnSync('npx', ['tsx', 'scripts/check-production-env.ts'], { encoding: 'utf-8' });
  results.push({
    name: 'Environment check',
    ok: env.status === 0,
    detail: env.status === 0 ? 'ok' : 'missing mandatory variables (see output above)',
  });
  console.log(env.stdout);
  console.log(`  ${env.status === 0 ? '✓ PASS' : '✗ FAIL'} (missing mandatory variables)`);

  // ---- Summary ----
  console.log('\n=== GATE SUMMARY ===');
  let failures = 0;
  for (const r of results) {
    console.log(` ${r.ok ? '✓' : '✗'} ${r.name}`);
    if (!r.ok) {
      failures++;
      if (!r.detail.startsWith('missing mandatory') && r.detail !== 'ok') {
        console.log(`    ${r.detail.split('\n').join('\n    ')}`);
      }
    }
  }
  console.log(`\n${results.length - failures}/${results.length} steps passed.`);
  if (failures > 0) {
    console.log('\nNOTE: failing steps include real configuration gaps — see DEPLOYMENT.md.');
    console.log('Do not submit until every step passes in the submission environment.');
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

void main();
