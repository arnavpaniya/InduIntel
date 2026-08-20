-- 005_gemini_usage_log.sql
-- Track daily Gemini API request count for quota management

CREATE TABLE gemini_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    request_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(request_date)
);

CREATE INDEX idx_gemini_usage_log_date ON gemini_usage_log(request_date);

ALTER TABLE gemini_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read gemini_usage_log" ON gemini_usage_log FOR SELECT USING (true);
CREATE POLICY "Service role full access gemini_usage_log" ON gemini_usage_log FOR ALL USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE TRIGGER update_gemini_usage_log_updated_at
    BEFORE UPDATE ON gemini_usage_log
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();