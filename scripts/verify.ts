import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  // Check ground truth items
  const { data: gtItems } = await supabase
    .from('items')
    .select('id, mfg_part_num, status, is_ground_truth, manufacturer_name, brand_name')
    .eq('is_ground_truth', true);
  
  console.log('Ground truth items:', gtItems?.length);
  for (const item of gtItems || []) {
    console.log(`  ${item.mfg_part_num} | ${item.status} | ${item.manufacturer_name} | ${item.brand_name}`);
  }
  
  // Check counts
  const { count: total } = await supabase.from('items').select('*', { count: 'exact', head: true });
  const { count: gt } = await supabase.from('items').select('*', { count: 'exact', head: true }).eq('is_ground_truth', true);
  const { count: descriptions } = await supabase.from('item_descriptions').select('*', { count: 'exact', head: true });
  const { count: attributes } = await supabase.from('item_attributes').select('*', { count: 'exact', head: true });
  const { count: assets } = await supabase.from('item_assets').select('*', { count: 'exact', head: true });
  const { count: specs } = await supabase.from('item_specs').select('*', { count: 'exact', head: true });
  
  console.log('\nFinal counts:');
  console.log(`   Items: ${total} (ground truth: ${gt})`);
  console.log(`   Descriptions: ${descriptions}`);
  console.log(`   Attributes: ${attributes}`);
  console.log(`   Assets: ${assets}`);
  console.log(`   Specs: ${specs}`);
}

check();