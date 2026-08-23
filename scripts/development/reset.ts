/**
 * ============================================================================
 * InduIntel Master Database & Pipeline Reset Utility
 * ============================================================================
 * 
 * WHAT THIS SCRIPT RESETS:
 * 1. Items with status 'enriched', 'review', or 'enriching' back to 'raw'
 * 2. Clears all extracted and normalized enrichment fields:
 *    - manufacturer_name, brand_name, dept, class, fine, classpath,
 *      confidence_score, field_confidence
 * 3. Deletes associated child records for reset items:
 *    - item_descriptions
 *    - item_attributes
 *    - item_specs
 *    - item_assets
 * 4. (Optional with --quota or --all): Clears today's daily quota in gemini_usage_log
 * 5. (Optional with --gt or --all): Resets ground truth catalog items in items table to raw
 * 
 * WHAT THIS SCRIPT PRESERVES:
 * 1. Ground Truth benchmark tables (ground_truth_items, ground_truth_descriptions,
 *    ground_truth_attributes, ground_truth_specs, ground_truth_assets) - untouched
 *    to preserve scoring baseline
 * 2. Raw catalog items and their raw source fields (id, mfg_part_num, part_desc,
 *    e1_brand, unilog_brand, dib_brand, part_manuf, etc.)
 * 3. Audit trail and enrichment history in enrichment_logs (preserved for caching/audits)
 * 
 * USAGE:
 *   npx tsx scripts/reset.ts            # Standard reset of enriched/review items
 *   npx tsx scripts/reset.ts --quota    # Reset daily Gemini quota usage
 *   npx tsx scripts/reset.ts --gt       # Reset ground truth test items in items table
 *   npx tsx scripts/reset.ts --all      # Complete reset (items + GT items + quota)
 *   npx tsx scripts/reset.ts --dry-run  # Preview changes without modifying database
 * ============================================================================
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('here')
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found in environment or .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = process.argv.slice(2);
const resetQuota = args.includes('--quota') || args.includes('-q') || args.includes('--all') || args.includes('-a');
const resetGt = args.includes('--gt') || args.includes('--all') || args.includes('-a');
const isDryRun = args.includes('--dry-run');

async function runReset() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('         InduIntel Database Reset Utility');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Target Database: ${supabaseUrl}`);
  console.log(`Dry Run Mode   : ${isDryRun ? 'YES (No changes will be saved)' : 'NO'}`);
  console.log(`Reset Quota    : ${resetQuota ? 'YES' : 'NO'}`);
  console.log(`Reset GT Items : ${resetGt ? 'YES' : 'NO'}`);
  console.log('────────────────────────────────────────────────────────────────\n');

  // 1. Check and count items to reset
  const targetStatuses = ['enriched', 'review', 'enriching'];
  const { data: itemsToReset, error: selectError } = await supabase
    .from('items')
    .select('id, mfg_part_num, status, is_ground_truth')
    .or(
      resetGt
        ? `status.in.(${targetStatuses.join(',')}),is_ground_truth.eq.true`
        : `status.in.(${targetStatuses.join(',')})`
    );

  if (selectError) {
    console.error('❌ Error querying items to reset:', selectError.message);
    return;
  }

  const itemsList = itemsToReset || [];
  console.log(`📦 Found ${itemsList.length} items to reset back to 'raw' status.`);

  if (itemsList.length > 0 && !isDryRun) {
    const itemIds = itemsList.map((i) => i.id);

    console.log('🗑️  Deleting child records from descriptions, attributes, specs, assets...');
    // Delete associated child rows
    const [dRes, aRes, sRes, asRes] = await Promise.all([
      supabase.from('item_descriptions').delete().in('item_id', itemIds),
      supabase.from('item_attributes').delete().in('item_id', itemIds),
      supabase.from('item_specs').delete().in('item_id', itemIds),
      supabase.from('item_assets').delete().in('item_id', itemIds),
    ]);

    if (dRes.error) console.warn('⚠️ Warning deleting item_descriptions:', dRes.error.message);
    if (aRes.error) console.warn('⚠️ Warning deleting item_attributes:', aRes.error.message);
    if (sRes.error) console.warn('⚠️ Warning deleting item_specs:', sRes.error.message);
    if (asRes.error) console.warn('⚠️ Warning deleting item_assets:', asRes.error.message);

    console.log('🔄 Updating items table to status="raw" and clearing enriched fields...');
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
      .in('id', itemIds);

    if (updateError) {
      console.error('❌ Error resetting items:', updateError.message);
    } else {
      console.log(`✅ Successfully reset ${itemIds.length} items to 'raw'.`);
    }
  }

  // 2. Optional: Reset Daily Quota
  if (resetQuota) {
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n📊 Resetting Gemini daily quota usage log for ${today}...`);
    if (!isDryRun) {
      const { error: quotaError } = await supabase
        .from('gemini_usage_log')
        .delete()
        .eq('request_date', today);

      if (quotaError) {
        console.error('❌ Error resetting quota:', quotaError.message);
      } else {
        console.log(`✅ Daily quota log cleared for ${today}.`);
      }
    } else {
      console.log(`[DRY RUN] Would delete gemini_usage_log for ${today}.`);
    }
  }

  // 3. Verification step
  console.log('\n────────────────────────────────────────────────────────────────');
  console.log('                      Verification Summary');
  console.log('────────────────────────────────────────────────────────────────');
  const [itemsStatusRes, gtItemsRes, logsCountRes] = await Promise.all([
    supabase.from('items').select('status'),
    supabase.from('ground_truth_items').select('id', { count: 'exact', head: true }),
    supabase.from('enrichment_logs').select('id', { count: 'exact', head: true }),
  ]);

  const statusMap: Record<string, number> = {};
  itemsStatusRes.data?.forEach((i) => {
    statusMap[i.status] = (statusMap[i.status] || 0) + 1;
  });

  console.log(`Main Items Table Status:`, statusMap);
  console.log(`Ground Truth Benchmark Rows (Preserved): ${gtItemsRes.count ?? 'N/A'}`);
  console.log(`Enrichment Logs Entries     (Preserved): ${logsCountRes.count ?? 'N/A'}`);
  console.log('════════════════════════════════════════════════════════════════\n');
}

runReset().catch((err) => {
  console.error('Fatal error during reset:', err);
  process.exit(1);
});
