-- 007_enrichment_cache.sql
-- Add caching for enrichment LLM responses to avoid quota burn from repeated calls

CREATE TABLE enrichment_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    step TEXT NOT NULL CHECK (step IN ('manufacturer', 'classify', 'attributes', 'descriptions', 'specs')),
    input_hash TEXT NOT NULL,
    response_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (item_id, step, input_hash)
);

CREATE INDEX idx_enrichment_cache_item_step ON enrichment_cache(item_id, step);

ALTER TABLE enrichment_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access enrichment_cache" ON enrichment_cache FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Public read enrichment_cache" ON enrichment_cache FOR SELECT USING (true);

-- Function to get cached enrichment result
CREATE OR REPLACE FUNCTION get_enrichment_cache(
    p_item_id UUID,
    p_step TEXT,
    p_input_hash TEXT
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT response_json INTO result
    FROM enrichment_cache
    WHERE item_id = p_item_id
      AND step = p_step
      AND input_hash = p_input_hash;
    RETURN result;
END;
$$;

-- Function to set enrichment cache
CREATE OR REPLACE FUNCTION set_enrichment_cache(
    p_item_id UUID,
    p_step TEXT,
    p_input_hash TEXT,
    p_response_json JSONB
)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO enrichment_cache (item_id, step, input_hash, response_json)
    VALUES (p_item_id, p_step, p_input_hash, p_response_json)
    ON CONFLICT (item_id, step, input_hash) DO UPDATE SET
        response_json = EXCLUDED.response_json,
        updated_at = NOW();
END;
$$;