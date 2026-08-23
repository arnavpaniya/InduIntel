-- 011_failed_status.sql
-- Stage 6 bug-fix pass: honest failure states.
-- - adds 'failed' to the items.status lifecycle
-- - records WHERE cleaning failed and a safe, user-presentable reason

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_status_check;

ALTER TABLE items ADD CONSTRAINT items_status_check
    CHECK (status IN ('raw', 'enriching', 'enriched', 'review', 'failed'));

ALTER TABLE items ADD COLUMN IF NOT EXISTS failed_step TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS failed_error TEXT;

CREATE INDEX IF NOT EXISTS idx_items_failed_step ON items(failed_step);
