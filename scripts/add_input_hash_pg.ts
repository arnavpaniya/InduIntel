import { config } from 'dotenv';
config({ path: '.env.local' });

import { Client } from 'pg';

const connectionString = process.env.SUPABASE_URL!.replace('https://', 'postgresql://postgres:').replace('.supabase.co', '.supabase.co:5432/postgres');
const password = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const client = new Client({
    connectionString: `postgresql://postgres:${password}@${process.env.SUPABASE_URL!.replace('https://', '').replace('.supabase.co', '.supabase.co')}:5432/postgres`,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  console.log('Connected to database');
  
  // Add input_hash column to enrichment_logs
  await client.query(`ALTER TABLE enrichment_logs ADD COLUMN IF NOT EXISTS input_hash TEXT`);
  console.log('Added input_hash column');
  
  // Create index
  await client.query(`CREATE INDEX IF NOT EXISTS idx_enrichment_logs_item_step_hash ON enrichment_logs(item_id, step, input_hash)`);
  console.log('Created index');
  
  await client.end();
  console.log('Done');
}

main().catch(console.error);