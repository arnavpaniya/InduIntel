-- 009_enrichment_logs.sql
-- Table for logging enrichment operations for caching and auditing

CREATE TABLE enrichment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    step TEXT NOT NULL CHECK (step IN ('manufacturer', 'classify', 'attributes', 'descriptions', 'specs')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'error')),
    error TEXT,
    input_json JSONB,
    output_json JSONB,
    duration_ms INTEGER,
    input_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE enrichment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access enrichment_logs" ON enrichment_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Public read enrichment_logs" ON enrichment_logs FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION get_enrichment_log(p_id UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', id,
        'item_id', item_id,
        'step', step,
        'status', status,
        'error', error,
        'input_json', input_json,
        'output_json', output_json,
        'duration_ms', duration_ms,
        'created_at', created_at
    ) INTO result
    FROM enrichment_logs
    WHERE id = p_id;
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION log_enrichment(
    p_item_id UUID,
    p_step TEXT,
    p_status TEXT,
    p_error TEXT,
    p_input_json JSONB,
    p_output_json JSONB,
    p_duration_ms INTEGER
)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO enrichment_logs (item_id, step, status, error, input_json, output_json, duration_ms, created_at, updated_at)
    VALUES (p_item_id, p_step, p_status, p_error, p_input_json, p_output_json, p_duration_ms, NOW(), NOW());
END;
$$;