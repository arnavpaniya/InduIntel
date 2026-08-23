/**
 * Stage 6, Part 17: Final production environment check.
 *
 * Verifies the PRESENCE of required environment variables.
 * NEVER prints secret values — only names and ✓/✗.
 *
 * Exit codes:
 *   0 = all mandatory variables present
 *   1 = at least one mandatory variable missing
 *
 * Usage: npx tsx scripts/check-production-env.ts
 */

import { config } from 'dotenv';
import { existsSync, readFileSync } from 'fs';

config({ path: '.env.local' });

interface EnvVar {
  label: string;
  key: string;
  mandatory: boolean;
  /** When true, a non-empty value must exist. */
  nonEmpty?: boolean;
}

const VARS: EnvVar[] = [
  { label: 'Supabase URL', key: 'NEXT_PUBLIC_SUPABASE_URL', mandatory: true },
  { label: 'Supabase publishable key', key: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', mandatory: true },
  { label: 'Supabase URL (server)', key: 'SUPABASE_URL', mandatory: false },
  { label: 'Supabase service-role key', key: 'SUPABASE_SERVICE_ROLE_KEY', mandatory: true },
  { label: 'Gemini API key', key: 'GEMINI_API_KEY', mandatory: true },
  { label: 'Gemini model', key: 'GEMINI_MODEL', mandatory: false },
  { label: 'Evidence service URL', key: 'EVIDENCE_SERVICE_URL', mandatory: true },
  { label: 'Search provider URL', key: 'EVIDENCE_SEARCH_URL', mandatory: true },
  { label: 'Search provider API key', key: 'EVIDENCE_SEARCH_API_KEY', mandatory: true },
  { label: 'Internal API token', key: 'INTERNAL_API_TOKEN', mandatory: false },
];

function valueOf(key: string): string {
  if (process.env[key] && process.env[key]!.trim() !== '') return process.env[key] as string;
  // Fall back to .env.example-style presence check is NOT done here:
  // only real configuration counts.
  return '';
}

let missing = 0;
console.log('\n=== PRODUCTION ENVIRONMENT CHECK ===\n');
if (!existsSync('.env.local')) {
  console.log('NOTE: .env.local not found in working directory.\n');
}

for (const v of VARS) {
  const present = valueOf(v.key) !== '';
  const mark = present ? '✓' : (v.mandatory ? '✗' : '○');
  console.log(`${v.label.padEnd(28)} ${mark}${present ? '' : v.mandatory ? '   (MISSING)' : '   (optional)'}`);
  if (!present && v.mandatory) missing++;
}

// Sanity: model default
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
console.log(`\nGemini model                 ${model}`);

console.log('');
if (missing > 0) {
  console.log(`Missing ${missing} mandatory variable(s). See DEPLOYMENT.md for setup.\n`);
  process.exitCode = 1;
} else {
  console.log('All mandatory production variables present.\n');
}

void readFileSync; // reserved for future .env file cross-checks
