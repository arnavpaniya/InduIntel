import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Check ground truth items in items table
  const { data: gtItems, error: gtError } = await supabase
    .from('items')
    .select('id, mfg_part_num, status, manufacturer_name, brand_name, dept, class, fine, classpath, confidence_score, field_confidence, is_ground_truth, part_desc, part_manuf, e1_brand, unilog_brand, dib_brand')
    .eq('is_ground_truth', true);
  
  console.log('Ground truth items (in items table):');
  gtItems?.forEach(item => {
    console.log(`  - ${item.mfg_part_num} (${item.id.slice(0,8)}...): status=${item.status}, mfg=${item.manufacturer_name}, brand=${item.brand_name}, classpath=${item.classpath}, conf=${item.confidence_score}, field_conf=${item.field_confidence}`);
    console.log(`    part_desc: ${item.part_desc}`);
    console.log(`    part_manuf: ${item.part_manuf}, e1: ${item.e1_brand}, unilog: ${item.unilog_brand}, dib: ${item.dib_brand}`);
  });
  
  // Check ground_truth_items table (answer key)
  const { data: gtAnswerKey, error: gtAkError } = await supabase
    .from('ground_truth_items')
    .select('id, mfg_part_num, manufacturer_name, brand_name, dept, class, fine, classpath');
  
  console.log('\nGround truth answer key (ground_truth_items table):');
  gtAnswerKey?.forEach(item => {
    console.log(`  - ${item.mfg_part_num}: mfg=${item.manufacturer_name}, brand=${item.brand_name}, dept=${item.dept}, class=${item.class}, fine=${item.fine}, classpath=${item.classpath}`);
  });
  
  // Check enriched items
  const { data: enrichedItems, error: enrError } = await supabase
    .from('items')
    .select('id, mfg_part_num, status, manufacturer_name, brand_name, dept, class, fine, classpath, confidence_score, field_confidence, is_ground_truth')
    .eq('status', 'enriched');
  
  console.log('\nEnriched items:');
  enrichedItems?.forEach(item => {
    console.log(`  - ${item.mfg_part_num} (${item.id.slice(0,8)}...): mfg=${item.manufacturer_name}, brand=${item.brand_name}, classpath=${item.classpath}, conf=${item.confidence_score}, field_conf=${item.field_confidence}`);
  });
  
  // Check review items
  const { data: reviewItems, error: revError } = await supabase
    .from('items')
    .select('id, mfg_part_num, status, manufacturer_name, brand_name, dept, class, fine, classpath, confidence_score, field_confidence, is_ground_truth')
    .eq('status', 'review');
  
  console.log('\nReview items:');
  reviewItems?.forEach(item => {
    console.log(`  - ${item.mfg_part_num} (${item.id.slice(0,8)}...): mfg=${item.manufacturer_name}, brand=${item.brand_name}, classpath=${item.classpath}, conf=${item.confidence_score}, field_conf=${item.field_confidence}`);
  });
  
  // Check raw items with taxonomy data (dept/class/fine)
  const { data: rawWithTaxonomy, error: rawTaxError } = await supabase
    .from('items')
    .select('id, mfg_part_num, status, dept, class, fine, part_desc')
    .eq('status', 'raw')
    .not('dept', 'is', null)
    .limit(10);
  
  console.log('\nRaw items with taxonomy data:');
  rawWithTaxonomy?.forEach(item => {
    console.log(`  - ${item.mfg_part_num}: dept=${item.dept}, class=${item.class}, fine=${item.fine}, desc=${item.part_desc?.slice(0,50)}`);
  });
  
  // Check all distinct dept/class/fine combinations
  const { data: allItems, error: allError } = await supabase
    .from('items')
    .select('dept, class, fine, mfg_part_num, status')
    .not('dept', 'is', null);
  
  console.log('\nAll items with taxonomy:');
  allItems?.forEach(item => {
    console.log(`  - ${item.mfg_part_num} (${item.status}): ${item.dept} > ${item.class} > ${item.fine}`);
  });
}

main().catch(console.error);