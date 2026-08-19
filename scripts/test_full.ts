import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  // Get a ground truth item with all related data
  const { data: items } = await supabase
    .from('items')
    .select(`
      *,
      item_descriptions(*),
      item_attributes(*),
      item_assets(*),
      item_specs(*)
    `)
    .eq('is_ground_truth', true);
  
  for (const item of items || []) {
    console.log(`\n=== ${item.mfg_part_num} ===`);
    console.log(`Status: ${item.status}`);
    console.log(`Manufacturer: ${item.manufacturer_name}`);
    console.log(`Brand: ${item.brand_name}`);
    console.log(`Classpath: ${item.classpath}`);
    console.log(`\nDescriptions (${item.item_descriptions?.length}):`);
    for (const d of item.item_descriptions || []) {
      console.log(`  ${d.field_name}: ${d.value?.substring(0, 80)}...`);
    }
    console.log(`\nAttributes (${item.item_attributes?.length}):`);
    for (const a of item.item_attributes || []) {
      console.log(`  [${a.seq}] ${a.label}: ${a.value} ${a.uom || ''}`);
    }
    console.log(`\nAssets (${item.item_assets?.length}):`);
    for (const a of item.item_assets || []) {
      console.log(`  ${a.asset_type}: ${a.url}`);
    }
    console.log(`\nSpecs:`);
    const s = item.item_specs?.[0];
    if (s) {
      console.log(`  UPC: ${s.upc}`);
      console.log(`  Dimensions: ${s.length}${s.length_uom} x ${s.width}${s.width_uom} x ${s.height}${s.height_uom}`);
      console.log(`  Weight: ${s.weight}${s.weight_uom}`);
      console.log(`  Warranty: ${s.warranty}`);
    }
  }
}

test();