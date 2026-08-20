import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Check ground_truth_descriptions
  const { data: gtDescs, error: gtDescsError } = await supabase
    .from('ground_truth_descriptions')
    .select('*');
  
  console.log('ground_truth_descriptions:');
  if (gtDescsError) console.error('Error:', gtDescsError.message);
  else gtDescs?.forEach(d => console.log(`  - ${d.item_id.slice(0,8)}... ${d.field_name}: ${d.value?.slice(0,60)} (chars: ${d.char_count})`));
  
  // Check ground_truth_attributes
  const { data: gtAttrs, error: gtAttrsError } = await supabase
    .from('ground_truth_attributes')
    .select('*');
  
  console.log('\nground_truth_attributes:');
  if (gtAttrsError) console.error('Error:', gtAttrsError.message);
  else gtAttrs?.forEach(a => console.log(`  - ${a.item_id.slice(0,8)}... ${a.label}: ${a.value} (uom: ${a.uom})`));
  
  // Check ground_truth_specs
  const { data: gtSpecs, error: gtSpecsError } = await supabase
    .from('ground_truth_specs')
    .select('*');
  
  console.log('\nground_truth_specs:');
  if (gtSpecsError) console.error('Error:', gtSpecsError.message);
  else gtSpecs?.forEach(s => console.log(`  - ${s.item_id.slice(0,8)}... upc=${s.upc}, ean=${s.ean}, gtin=${s.gtin}, unspsc=${s.unspsc}, list_price=${s.list_price}, dims=${s.length}x${s.width}x${s.height}, weight=${s.weight}, origin=${s.country_of_origin}, warranty=${s.warranty}`));
  
  // Check items table for ground truth items with their related data
  const { data: gtItems, error: gtItemsError } = await supabase
    .from('items')
    .select('id, mfg_part_num, is_ground_truth, part_desc')
    .eq('is_ground_truth', true);
  
  console.log('\nGround truth item IDs:');
  gtItems?.forEach(i => console.log(`  - ${i.mfg_part_num}: ${i.id}`));
  
  // Check if there are any item_descriptions for ground truth items
  for (const gt of gtItems || []) {
    const { data: descs } = await supabase
      .from('item_descriptions')
      .select('*')
      .eq('item_id', gt.id);
    console.log(`\nitem_descriptions for ${gt.mfg_part_num} (${gt.id}):`, descs?.length || 0);
    descs?.forEach(d => console.log(`  - ${d.field_name}: ${d.value?.slice(0,60)} (chars: ${d.char_count})`));
    
    const { data: attrs } = await supabase
      .from('item_attributes')
      .select('*')
      .eq('item_id', gt.id);
    console.log(`item_attributes for ${gt.mfg_part_num}:`, attrs?.length || 0);
    attrs?.forEach(a => console.log(`  - ${a.label}: ${a.value} (uom: ${a.uom})`));
    
    const { data: specs } = await supabase
      .from('item_specs')
      .select('*')
      .eq('item_id', gt.id);
    console.log(`item_specs for ${gt.mfg_part_num}:`, specs?.length || 0);
    specs?.forEach(s => console.log(`  - upc=${s.upc}, ean=${s.ean}, gtin=${s.gtin}, unspsc=${s.unspsc}`));
  }
}

main().catch(console.error);