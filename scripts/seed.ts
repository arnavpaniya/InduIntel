import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PLACEHOLDER_VALUES = new Set([
  '-- Unbranded --',
  '-- No Unilog Brand --',
  '-- No DIB Brand --',
]);

function cleanValue(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || PLACEHOLDER_VALUES.has(trimmed)) {
    return null;
  }
  return trimmed;
}

function parseCSV(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

async function upsertItems() {
  console.log('📥 Parsing input CSV...');
  const inputPath = path.join(process.cwd(), 'Unihack_ Sample Dataset - Input.csv');
  const inputRows = parseCSV(inputPath);
  console.log(`   Found ${inputRows.length} rows`);

  // Deduplicate by mfg_part_num (keep first occurrence)
  const seen = new Set<string>();
  const uniqueRows: any[] = [];
  for (const row of inputRows) {
    const mfgPartNum = cleanValue(row.Mfg_Part_Num);
    if (mfgPartNum && !seen.has(mfgPartNum)) {
      seen.add(mfgPartNum);
      uniqueRows.push(row);
    }
  }
  console.log(`   Unique mfg_part_num: ${uniqueRows.length}`);

  const itemsToUpsert = uniqueRows.map((row) => ({
    mfg_part_num: cleanValue(row.Mfg_Part_Num)!,
    part_desc: cleanValue(row.Part_Desc),
    e1_brand: cleanValue(row.E1_Brand),
    unilog_brand: cleanValue(row.Unilog_Brand),
    dib_brand: cleanValue(row.DIB_Brand),
    part_manuf: cleanValue(row.Part_Manuf),
    status: 'raw',
    is_ground_truth: false,
  }));

  console.log('📤 Upserting items...');
  // Upsert on mfg_part_num - update if exists, insert if not
  const { data: upsertedItems, error: itemsError } = await supabase
    .from('items')
    .upsert(itemsToUpsert, { onConflict: 'mfg_part_num' })
    .select('id, mfg_part_num');

  if (itemsError) {
    console.error('❌ Error upserting items:', itemsError);
    throw itemsError;
  }

  console.log(`✅ Upserted ${upsertedItems?.length || 0} items`);
  return upsertedItems || [];
}

async function seedGroundTruth(itemIdMap: Map<string, string>) {
  console.log('📥 Parsing expected output CSV...');
  const outputPath = path.join(process.cwd(), 'Unihack_ Expected Output - Delivery Format.csv');
  const outputRows = parseCSV(outputPath);
  console.log(`   Found ${outputRows.length} rows`);
  if (outputRows.length > 0) {
    console.log('   Columns:', Object.keys(outputRows[0]).slice(0, 50).join(', '));
  }

  const groundTruthItems: any[] = [];
  const descriptionsToInsert: any[] = [];
  const attributesToInsert: any[] = [];
  const assetsToInsert: any[] = [];
  const specsToInsert: any[] = [];

  for (const row of outputRows) {
    const mfgPartNum = cleanValue(row.Mfg_Part_Num);
    if (!mfgPartNum) continue;

    const itemId = itemIdMap.get(mfgPartNum);
    if (!itemId) {
      console.warn(`⚠️  No matching item for Mfg_Part_Num: ${mfgPartNum}`);
      continue;
    }

    // Main item update for ground truth
    groundTruthItems.push({
      id: itemId,
      manufacturer_name: cleanValue(row.MANUFACTURER_NAME),
      brand_name: cleanValue(row.BRAND_NAME),
      dept: cleanValue(row.Dept),
      class: cleanValue(row.Class),
      fine: cleanValue(row.Fine),
      classpath: cleanValue(row.Classpath),
      is_ground_truth: true,
      status: 'enriched',
    });

    // Descriptions
    const descFields = [
      'MOBILE_DESC', 'INVOICE_DESC', 'SHORT_DESC', 'LONG_DESC1',
      'RETAIL_DESC', 'MARKETING_DESCRIPTION', 'PRODUCT_NAME',
    ];
    for (const field of descFields) {
      const value = cleanValue(row[field]);
      if (value) {
        descriptionsToInsert.push({
          item_id: itemId,
          field_name: field.toLowerCase(),
          value,
          char_count: value.length,
        });
      }
    }

    // Attributes (1-50)
    for (let i = 1; i <= 50; i++) {
      const label = cleanValue(row[`ATTRIBUTE_LABEL ${i}`]);
      const value = cleanValue(row[`ATTRIBUTE_VALUE ${i}`]);
      const uom = cleanValue(row[`ATTRIBUTE_UOM ${i}`]);
      
      if (label || value) {
        attributesToInsert.push({
          item_id: itemId,
          seq: i,
          label,
          value,
          uom,
        });
      }
    }

    // Assets
    const assetFields = [
      { field: 'MFR URL', type: 'mfr_url' },
      { field: 'Ref URL 1', type: 'ref_url' },
      { field: 'Ref URL 2', type: 'ref_url' },
      { field: 'Ref URL 3', type: 'ref_url' },
      { field: 'Ref URL 4', type: 'ref_url' },
      { field: 'Ref URL 5', type: 'ref_url' },
    ];
    for (let i = 0; i < assetFields.length; i++) {
      const url = cleanValue(row[assetFields[i].field]);
      if (url) {
        assetsToInsert.push({
          item_id: itemId,
          asset_type: assetFields[i].type,
          url,
          sort_order: i,
        });
      }
    }

    // Product images
    for (let i = 1; i <= 5; i++) {
      const imgField = `image_${i}`;
      const url = cleanValue(row[imgField.toUpperCase()]) || cleanValue(row[`FRIGIDAIRE_${imgField}.jpg`]) || cleanValue(row[`WHIRLPOOL_${imgField}.jpg`]);
      if (url) {
        assetsToInsert.push({
          item_id: itemId,
          asset_type: 'product_image',
          url,
          sort_order: i - 1,
        });
      }
    }

    // Specs - upsert on item_id
    specsToInsert.push({
      item_id: itemId,
      upc: cleanValue(row.UPC),
      ean: cleanValue(row.EAN),
      gtin: cleanValue(row.GTIN),
      unspsc: cleanValue(row.UNSPSC),
      list_price: row['List Price'] ? parseFloat(row['List Price']) : null,
      length: row.LENGTH ? parseFloat(row.LENGTH) : null,
      length_uom: cleanValue(row.LENGTH_UOM),
      width: row.WIDTH ? parseFloat(row.WIDTH) : null,
      width_uom: cleanValue(row.WIDTH_UOM),
      height: row.HEIGHT ? parseFloat(row.HEIGHT) : null,
      height_uom: cleanValue(row.HEIGHT_UOM),
      weight: row.WEIGHT ? parseFloat(row.WEIGHT) : null,
      weight_uom: cleanValue(row.WEIGHT_UOM),
      country_of_origin: cleanValue(row['Country of Origin']),
      warranty: cleanValue(row.Warranty),
    });
  }

  console.log('📤 Updating ground truth items...');
  for (const item of groundTruthItems) {
    const { id, ...updates } = item;
    const { error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', id);
    if (error) {
      console.error(`❌ Error updating item ${id}:`, error);
    }
  }

  console.log(`📤 Inserting ${descriptionsToInsert.length} descriptions...`);
  if (descriptionsToInsert.length > 0) {
    // Clear existing descriptions for these items first
    const itemIds = [...new Set(descriptionsToInsert.map(d => d.item_id))];
    await supabase.from('item_descriptions').delete().in('item_id', itemIds);
    const { error } = await supabase.from('item_descriptions').insert(descriptionsToInsert);
    if (error) console.error('❌ Error inserting descriptions:', error);
  }

  console.log(`📤 Inserting ${attributesToInsert.length} attributes...`);
  if (attributesToInsert.length > 0) {
    const itemIds = [...new Set(attributesToInsert.map(a => a.item_id))];
    await supabase.from('item_attributes').delete().in('item_id', itemIds);
    const { error } = await supabase.from('item_attributes').insert(attributesToInsert);
    if (error) console.error('❌ Error inserting attributes:', error);
  }

  console.log(`📤 Inserting ${assetsToInsert.length} assets...`);
  if (assetsToInsert.length > 0) {
    const itemIds = [...new Set(assetsToInsert.map(a => a.item_id))];
    await supabase.from('item_assets').delete().in('item_id', itemIds);
    const { error } = await supabase.from('item_assets').insert(assetsToInsert);
    if (error) console.error('❌ Error inserting assets:', error);
  }

  console.log(`📤 Upserting ${specsToInsert.length} specs...`);
  if (specsToInsert.length > 0) {
    const { error } = await supabase
      .from('item_specs')
      .upsert(specsToInsert, { onConflict: 'item_id' });
    if (error) console.error('❌ Error upserting specs:', error);
  }

  console.log('✅ Ground truth seeding complete');
}

async function main() {
  console.log('🚀 Starting seed process...\n');

  try {
    const upsertedItems = await upsertItems();
    
    const itemIdMap = new Map<string, string>();
    for (const item of upsertedItems) {
      itemIdMap.set(item.mfg_part_num, item.id);
    }

    await seedGroundTruth(itemIdMap);

    // Final counts
    const { count: totalItems } = await supabase.from('items').select('*', { count: 'exact', head: true });
    const { count: gtItems } = await supabase.from('items').select('*', { count: 'exact', head: true }).eq('is_ground_truth', true);
    const { count: descriptions } = await supabase.from('item_descriptions').select('*', { count: 'exact', head: true });
    const { count: attributes } = await supabase.from('item_attributes').select('*', { count: 'exact', head: true });
    const { count: assets } = await supabase.from('item_assets').select('*', { count: 'exact', head: true });
    const { count: specs } = await supabase.from('item_specs').select('*', { count: 'exact', head: true });

    console.log('\n📊 Final counts:');
    console.log(`   Items: ${totalItems} (ground truth: ${gtItems})`);
    console.log(`   Descriptions: ${descriptions}`);
    console.log(`   Attributes: ${attributes}`);
    console.log(`   Assets: ${assets}`);
    console.log(`   Specs: ${specs}`);
    console.log('\n✅ Seed complete!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

main();