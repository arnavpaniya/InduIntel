import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function enrichItem(itemId: string, itemName: string) {
  const baseUrl = 'http://localhost:3000';
  
  const response = await fetch(`${baseUrl}/api/enrich/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id: itemId }),
  });
  
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch (e) {
    console.log(`Failed to parse JSON for ${itemName}:`, text.slice(0, 200));
    return null;
  }
  
  console.log(`Enrichment result for ${itemName}: success=${result.success}, status=${result.status}, confidence=${result.confidence_score}`);
  if (result.error) console.log(`  Error: ${result.error}`);
  return result;
}

async function main() {
  // Get ground truth item IDs
  const { data: gtItems } = await supabase
    .from('items')
    .select('id, mfg_part_num')
    .eq('is_ground_truth', true);
  
  console.log('Ground truth items to enrich:');
  gtItems?.forEach(item => console.log(`  - ${item.mfg_part_num}: ${item.id}`));
  
  if (gtItems && gtItems.length > 0) {
    for (const item of gtItems) {
      console.log(`\n--- Enriching ${item.mfg_part_num} ---`);
      await enrichItem(item.id, item.mfg_part_num);
      // Wait a bit between requests
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

main().catch(console.error);