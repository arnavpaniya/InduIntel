import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🔄 Resetting ground truth items to raw state...');
  
  // First, let's see the current state
  const { data: gtItems, error: fetchError } = await supabase
    .from('items')
    .select('id, mfg_part_num, status, manufacturer_name, brand_name, dept, class, fine, classpath, confidence_score, field_confidence, is_ground_truth')
    .eq('is_ground_truth', true);
  
  if (fetchError) {
    console.error('❌ Error fetching ground truth items:', fetchError);
    process.exit(1);
  }
  
  console.log(`\n📋 Found ${gtItems?.length || 0} ground truth items:`);
  gtItems?.forEach(item => {
    console.log(`  - ${item.mfg_part_num} (${item.id}): status=${item.status}, manufacturer=${item.manufacturer_name}, brand=${item.brand_name}`);
  });
  
  // Reset enriched fields back to raw state
  const { error: updateError } = await supabase
    .from('items')
    .update({
      status: 'raw',
      manufacturer_name: null,
      brand_name: null,
      dept: null,
      class: null,
      fine: null,
      classpath: null,
      confidence_score: null,
      field_confidence: null,
      updated_at: new Date().toISOString(),
    })
    .eq('is_ground_truth', true);
  
  if (updateError) {
    console.error('❌ Error updating ground truth items:', updateError);
    process.exit(1);
  }
  
  console.log('\n✅ Ground truth items reset to raw state');
  
  // Verify the reset
  const { data: verifyItems, error: verifyError } = await supabase
    .from('items')
    .select('id, mfg_part_num, status, manufacturer_name, brand_name, dept, class, fine, classpath, confidence_score, field_confidence, is_ground_truth')
    .eq('is_ground_truth', true);
  
  if (verifyError) {
    console.error('❌ Error verifying:', verifyError);
    process.exit(1);
  }
  
  console.log('\n📋 Verification - ground truth items after reset:');
  verifyItems?.forEach(item => {
    console.log(`  - ${item.mfg_part_num} (${item.id}): status=${item.status}, manufacturer=${item.manufacturer_name}, brand=${item.brand_name}`);
  });
  
  // Verify ground_truth_* tables still have the answer key data
  console.log('\n🔍 Verifying ground_truth_* tables (answer key) still have data...');
  
  const { data: gtItemsTable, error: gtItemsError } = await supabase
    .from('ground_truth_items')
    .select('id, mfg_part_num, manufacturer_name, brand_name, dept, class, fine, classpath');
  
  if (gtItemsError) {
    console.error('❌ Error fetching ground_truth_items:', gtItemsError);
  } else {
    console.log(`\n📋 ground_truth_items table has ${gtItemsTable?.length || 0} rows:`);
    gtItemsTable?.forEach(item => {
      console.log(`  - ${item.mfg_part_num}: manufacturer=${item.manufacturer_name}, brand=${item.brand_name}, dept=${item.dept}, class=${item.class}, fine=${item.fine}, classpath=${item.classpath}`);
    });
  }
  
  const { data: gtDescs, error: gtDescsError } = await supabase
    .from('ground_truth_descriptions')
    .select('item_id, field_name, value')
    .limit(10);
  
  if (gtDescsError) {
    console.error('❌ Error fetching ground_truth_descriptions:', gtDescsError);
  } else {
    console.log(`\n📋 ground_truth_descriptions table has ${gtDescs?.length || 0} rows (showing first 10)`);
  }
  
  const { data: gtAttrs, error: gtAttrsError } = await supabase
    .from('ground_truth_attributes')
    .select('item_id, label, value')
    .limit(10);
  
  if (gtAttrsError) {
    console.error('❌ Error fetching ground_truth_attributes:', gtAttrsError);
  } else {
    console.log(`\n📋 ground_truth_attributes table has ${gtAttrs?.length || 0} rows (showing first 10)`);
  }
  
  const { data: gtSpecs, error: gtSpecsError } = await supabase
    .from('ground_truth_specs')
    .select('item_id, upc, ean, gtin, unspsc, list_price, length, width, height, weight, country_of_origin, warranty');
  
  if (gtSpecsError) {
    console.error('❌ Error fetching ground_truth_specs:', gtSpecsError);
  } else {
    console.log(`\n📋 ground_truth_specs table has ${gtSpecs?.length || 0} rows:`);
    gtSpecs?.forEach(item => {
      console.log(`  - ${item.item_id}: upc=${item.upc}, ean=${item.ean}, gtin=${item.gtin}, unspsc=${item.unspsc}`);
    });
  }
  
  console.log('\n✅ Verification complete');
}

main().catch(console.error);