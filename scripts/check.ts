import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  // Count by status
  const { data: statusCounts } = await supabase
    .from('items')
    .select('status, is_ground_truth', { count: 'exact' });
  
  console.log('Items:', statusCounts?.length);
  
  // Group by mfg_part_num to find duplicates
  const { data: items } = await supabase
    .from('items')
    .select('id, mfg_part_num, status, is_ground_truth, created_at')
    .order('mfg_part_num, created_at');
  
  const seen = new Map<string, typeof items>();
  for (const item of items || []) {
    if (!seen.has(item.mfg_part_num)) {
      seen.set(item.mfg_part_num, []);
    }
    seen.get(item.mfg_part_num)!.push(item);
  }
  
  let dupCount = 0;
  for (const [partNum, items] of seen) {
    if (items.length > 1) {
      dupCount++;
      console.log(`Duplicate: ${partNum} - ${items.length} rows`);
      for (const i of items) {
        console.log(`  ${i.id} | ${i.status} | gt:${i.is_ground_truth} | ${i.created_at}`);
      }
    }
  }
  console.log(`Total duplicate groups: ${dupCount}`);
}

check();