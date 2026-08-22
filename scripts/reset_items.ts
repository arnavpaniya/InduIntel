import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rxqlpjekiwwjeuwdarvj.supabase.co';
const supabaseKey = 'sb_service_role_key_here'; // Will use env var if available

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function resetItems() {
  console.log('=== Item Reset Script ===\n');

  // Step 1: Count items with status enriched, review, or enriching
  const { count: enrichedBefore, error: enrichedError } = await supabase
    .from('items')
    .select('status', { count: 'exact', head: true })
    .in('status', ['enriched', 'review', 'enriching']);

  if (enrichedError) {
    console.error('Error counting enriched/review/enriching items:', enrichedError.message);
    return;
  }

  console.log(`Items with status enriched/review/enriching before reset: ${enrichedBefore}`);

  if (enrichedBefore === 0) {
    console.log('No items to reset. All items are already raw or in other states.');
    return;
  }

  // Step 2: Get all item IDs that need resetting
  const { data: itemsToReset, error: selectError } = await supabase
    .from('items')
    .select('id')
    .in('status', ['enriched', 'review', 'enriching']);

  if (selectError) {
    console.error('Error selecting items to reset:', selectError.message);
    return;
  }

  console.log(`Found ${itemsToReset.length} items to reset`);

  // For each item, delete associated child rows first, then update the item
  for (const item of itemsToReset) {
    const itemId = item.id;

    // Delete associated child rows
    await supabase.from('item_descriptions').delete().eq('item_id', itemId);
    await supabase.from('item_attributes').delete().eq('item_id', itemId);
    await supabase.from('item_specs').delete().eq('item_id', itemId);
    await supabase.from('item_assets').delete().eq('item_id', itemId);

    // Update item status to raw and clear enrichment fields
    await supabase.from('items').update({
      status: 'raw',
      manufacturer_name: null,
      brand_name: null,
      dept: null,
      'class': null,
      fine: null,
      classpath: null,
      confidence_score: null,
      field_confidence: null,
      updated_at: new Date().toISOString(),
    }).eq('id', itemId);
  }

  // Step 3: Count items after reset
  const { count: enrichedAfter, error: enrichedAfterError } = await supabase
    .from('items')
    .select('status', { count: 'exact', head: true })
    .in('status', ['enriched', 'review', 'enriching']);

  if (enrichedAfterError) {
    console.error('Error counting enriched/review/enriching items after reset:', enrichedAfterError.message);
  }

  console.log(`Items with status enriched/review/enriching after reset: ${enrichedAfter}`);

  // Step 4: Verify enrichment_logs are intact
  const { count: logCount, error: logError } = await supabase
    .from('enrichment_logs')
    .select('id', { count: 'exact', head: true });

  if (logError) {
    console.error('Error counting enrichment_logs:', logError.message);
  } else {
    console.log(`Enrichment logs preserved: ${logCount} entries`);
  }

  console.log('\n=== Reset Complete ===');
}

resetItems().catch(console.error);