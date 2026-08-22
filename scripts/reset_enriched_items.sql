-- ============================================================
-- Reset enriched/review/enriching items back to raw status
-- ============================================================
-- This script resets ALL items in the `items` table with status
-- IN ('enriched', 'review', 'enriching') back to 'raw',
-- clearing all enrichment fields. It does NOT delete
-- enrichment_logs (preserves history) or touch gemini_usage_log
-- (quota tracking stays accurate).
-- It DOES delete associated item_descriptions, item_attributes,
-- item_specs, and item_assets rows for a clean slate.
-- Ground truth tables (ground_truth_*) are NOT touched -- those
-- stay as the answer key.
-- ============================================================

-- Step 1: Delete associated child rows and update items in one transaction
-- This resets all enriched/review/enriching items to raw status
DELETE FROM item_descriptions
WHERE item_id IN (SELECT id FROM items WHERE status IN ('enriched', 'review', 'enriching'));

DELETE FROM item_attributes
WHERE item_id IN (SELECT id FROM items WHERE status IN ('enriched', 'review', 'enriching'));

DELETE FROM item_specs
WHERE item_id IN (SELECT id FROM items WHERE status IN ('enriched', 'review', 'enriching'));

DELETE FROM item_assets
WHERE item_id IN (SELECT id FROM items WHERE status IN ('enriched', 'review', 'enriching'));

UPDATE items
SET status = 'raw',
    manufacturer_name = NULL,
    brand_name = NULL,
    dept = NULL,
    "class" = NULL,
    fine = NULL,
    classpath = NULL,
    confidence_score = NULL,
    field_confidence = NULL,
    updated_at = NOW()
WHERE status IN ('enriched', 'review', 'enriching');

-- Step 2: Verify the reset
-- Count items reset
SELECT
  (SELECT COUNT(*) FROM items WHERE status IN ('enriched', 'review', 'enriching')) AS still_enriched,
  (SELECT COUNT(*) FROM items WHERE status = 'raw') AS raw_count;

-- Step 3: Verify enrichment_logs are preserved
SELECT COUNT(*) AS enrichment_logs_preserved FROM enrichment_logs;

-- Step 4: Verify ground_truth_* tables are untouched
SELECT (SELECT COUNT(*) FROM ground_truth_items) AS gt_items_count;
SELECT (SELECT COUNT(*) FROM ground_truth_descriptions) AS gt_descs_count;
SELECT (SELECT COUNT(*) FROM ground_truth_attributes) AS gt_attrs_count;
SELECT (SELECT COUNT(*) FROM ground_truth_specs) AS gt_specs_count;