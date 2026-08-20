import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Snapshotting ground truth...');
  const { error } = await supabase.rpc('snapshot_ground_truth');
  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  console.log('Ground truth snapshot complete');
  process.exit(0);
}

main();