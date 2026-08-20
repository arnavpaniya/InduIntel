-- 004_confidence_scale_fix.sql
-- Fix confidence_score column to support 0-100 scale
-- Add field_confidence column for 0-1 per-step LLM confidence

-- Rename confidence_score to field_confidence (preserving 0-1 LLM self-reported confidence)
ALTER TABLE items RENAME COLUMN confidence_score TO field_confidence;

-- Add new confidence_score column for 0-100 orchestrator-computed percentage
ALTER TABLE items ADD COLUMN confidence_score NUMERIC(5,2);

-- Add comment for clarity
COMMENT ON COLUMN items.field_confidence IS 'Average of per-step LLM self-reported confidence (0-1 scale)';
COMMENT ON COLUMN items.confidence_score IS 'Orchestrator-computed percentage of expected fields filled (0-100 scale)';