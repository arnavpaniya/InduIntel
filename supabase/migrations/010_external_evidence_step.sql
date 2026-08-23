-- 010_external_evidence_step.sql
-- Stage 6 (Part 12): allow the external-evidence evidence-cache rows in
-- enrichment_logs. Proven required by scripts/supabase-production-check.ts:
--   insert of step='external_evidence' violates enrichment_logs_step_check.
--
-- Idempotent. Also restores input_hash (+index) expected by existing cache
-- helpers if absent.

ALTER TABLE enrichment_logs DROP CONSTRAINT IF EXISTS enrichment_logs_step_check;

ALTER TABLE enrichment_logs ADD CONSTRAINT enrichment_logs_step_check
    CHECK (step IN ('manufacturer', 'classify', 'attributes', 'descriptions', 'specs', 'external_evidence'));

ALTER TABLE enrichment_logs ADD COLUMN IF NOT EXISTS input_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_enrichment_logs_item_step_hash
    ON enrichment_logs(item_id, step, input_hash);
