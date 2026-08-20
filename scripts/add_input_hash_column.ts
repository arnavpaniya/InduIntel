import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Add input_hash column to enrichment_logs
  const { error } = await supabase.rpc('exec', { 
    query: `ALTER TABLE enrichment_logs ADD COLUMN IF NOT EXISTS input_hash TEXT` 
  });
  if (error) {
    console.error('Error adding input_hash column:', error);
  } else {
    console.log('Added input_hash column');
  }
  
  // Create index
  const { error: idxError } = await supabase.rpc('exec', { 
    query: `CREATE INDEX IF NOT EXISTS idx_enrichment_logs_item_step_hash ON enrichment_logs(item_id, step, input_hash)` 
  });
  if (idxError) {
    console.error('Error creating index:', idxError);
  } else {
    console.log('Created index');
  }
}

main().catch(console.error);