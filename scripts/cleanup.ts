import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanup() {
  // Get all items
  const { data: items, error } = await supabase
    .from('items')
    .select('id, mfg_part_num, created_at')
    .order('mfg_part_num, created_at');
  
  if (error) {
    console.error('Error fetching items:', error);
    return;
  }
  
  // Find duplicates
  const seen = new Map<string, string>();
  const toDelete: string[] = [];
  
  for (const item of items || []) {
    if (seen.has(item.mfg_part_num)) {
      toDelete.push(item.id);
    } else {
      seen.set(item.mfg_part_num, item.id);
    }
  }
  
  console.log(`Found ${toDelete.length} duplicate items to delete`);
  
  if (toDelete.length > 0) {
    // Delete in batches
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100);
      const { error: delError } = await supabase
        .from('items')
        .delete()
        .in('id', batch);
      
      if (delError) {
        console.error('Error deleting batch:', delError);
      }
    }
    console.log('Duplicates cleaned up');
  }
  
  // Add unique constraint
  console.log('Adding unique constraint on mfg_part_num...');
  const { error: constraintError } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE items ADD CONSTRAINT items_mfg_part_num_key UNIQUE (mfg_part_num);'
  });
  
  if (constraintError) {
    console.log('Constraint may already exist or RPC not available:', constraintError.message);
  }
  
  // Verify
  const { count } = await supabase.from('items').select('*', { count: 'exact', head: true });
  console.log(`Total items after cleanup: ${count}`);
}

cleanup();