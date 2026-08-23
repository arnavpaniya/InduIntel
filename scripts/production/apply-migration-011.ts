/**
 * Stage 6 — apply the external-evidence-step migration (010) through whatever
 * path the environment exposes:
 *   1. supabase.rpc('exec', { query })            (if a helper function exists)
 *   2. direct Postgres connection                 (needs SUPABASE_DB_PASSWORD)
 *
 * Idempotent; safe to re-run. Reports honestly if no path is available.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFileSync } from 'fs';

const SQL_PATH = 'supabase/migrations/011_failed_status.sql';

async function tryRpc(sql: string): Promise<boolean> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await sb.rpc('exec', { query: sql });
    if (error) {
      console.log(`rpc('exec') unavailable: ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    console.log(`rpc('exec') threw: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

async function tryDirectPg(sql: string): Promise<boolean> {
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  if (!dbPassword || !process.env.SUPABASE_URL) return false;
  let Client: any;
  try {
    Client = (await import('pg')).Client;
  } catch {
    console.log('pg package not installed — skipping direct path');
    return false;
  }
  const host = process.env.SUPABASE_URL.replace('https://', '').replace('.supabase.co', '.supabase.co');
  const client = new Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(dbPassword)}@${host}:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(sql);
  await client.end();
  return true;
}

async function main(): Promise<void> {
  const sql = readFileSync(SQL_PATH, 'utf-8');
  console.log('\n=== APPLY MIGRATION 010_external_evidence_step ===\n');

  if (await tryRpc(sql)) {
    console.log('✓ applied via rpc(exec)');
    process.exitCode = 0;
    return;
  }
  if (await tryDirectPg(sql)) {
    console.log('✓ applied via direct Postgres connection');
    process.exitCode = 0;
    return;
  }
  console.log('✗ No automatic path available.');
  console.log('Apply manually in Supabase Dashboard → SQL Editor:');
  console.log('---');
  console.log(sql);
  console.log('---');
  process.exitCode = 1;
}

void main();
