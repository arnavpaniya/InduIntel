-- 008_add_batch_id_to_items.sql
-- Add batch_id column to items table for tracking upload batches

ALTER TABLE items ADD COLUMN IF NOT EXISTS batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_items_batch_id ON items(batch_id);

-- Also add to ground_truth_items for consistency
ALTER TABLE ground_truth_items ADD COLUMN IF NOT EXISTS batch_id UUID;