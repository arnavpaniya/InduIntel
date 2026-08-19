-- 001_create_items_schema.sql
-- Normalized schema for product catalog enrichment pipeline

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Main items table
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mfg_part_num TEXT NOT NULL,
    part_desc TEXT,
    e1_brand TEXT,
    unilog_brand TEXT,
    dib_brand TEXT,
    part_manuf TEXT,
    dept TEXT,
    class TEXT,
    fine TEXT,
    classpath TEXT,
    manufacturer_name TEXT,
    brand_name TEXT,
    status TEXT NOT NULL DEFAULT 'raw' CHECK (status IN ('raw', 'enriching', 'enriched', 'review')),
    confidence_score NUMERIC(3,2),
    is_ground_truth BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Item descriptions table (mobile_desc, invoice_desc, short_desc, long_desc1, etc.)
CREATE TABLE item_descriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    value TEXT,
    char_count INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Item attributes table (ATTRIBUTE_LABEL 1-50, ATTRIBUTE_VALUE 1-50, ATTRIBUTE_UOM 1-50)
CREATE TABLE item_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    seq INT NOT NULL CHECK (seq >= 1 AND seq <= 50),
    label TEXT,
    value TEXT,
    uom TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Item assets table (product images, spec sheets, manuals, MFR URLs, ref URLs)
CREATE TABLE item_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('product_image', 'spec_sheet', 'manual', 'mfr_url', 'ref_url', 'image_1', 'image_2', 'image_3', 'image_4', 'image_5')),
    url TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Item specs table (UPC, EAN, GTIN, UNSPSC, list_price, dimensions, weight, country_of_origin, warranty)
CREATE TABLE item_specs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE UNIQUE,
    upc TEXT,
    ean TEXT,
    gtin TEXT,
    unspsc TEXT,
    list_price NUMERIC(12,2),
    length NUMERIC(10,3),
    length_uom TEXT,
    width NUMERIC(10,3),
    width_uom TEXT,
    height NUMERIC(10,3),
    height_uom TEXT,
    weight NUMERIC(10,3),
    weight_uom TEXT,
    country_of_origin TEXT,
    warranty TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_items_mfg_part_num ON items(mfg_part_num);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_is_ground_truth ON items(is_ground_truth);
CREATE INDEX idx_items_brand_name ON items(brand_name);
CREATE INDEX idx_items_manufacturer_name ON items(manufacturer_name);
CREATE INDEX idx_items_classpath ON items(classpath);

CREATE INDEX idx_item_descriptions_item_id ON item_descriptions(item_id);
CREATE INDEX idx_item_descriptions_field_name ON item_descriptions(field_name);

CREATE INDEX idx_item_attributes_item_id ON item_attributes(item_id);
CREATE INDEX idx_item_attributes_seq ON item_attributes(item_id, seq);

CREATE INDEX idx_item_assets_item_id ON item_assets(item_id);
CREATE INDEX idx_item_assets_type ON item_assets(asset_type);

CREATE INDEX idx_item_specs_item_id ON item_specs(item_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_item_specs_updated_at
    BEFORE UPDATE ON item_specs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS policies (enable RLS)
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_specs ENABLE ROW LEVEL SECURITY;

-- Public read access (for app), service role full access
CREATE POLICY "Public read items" ON items FOR SELECT USING (true);
CREATE POLICY "Public read item_descriptions" ON item_descriptions FOR SELECT USING (true);
CREATE POLICY "Public read item_attributes" ON item_attributes FOR SELECT USING (true);
CREATE POLICY "Public read item_assets" ON item_assets FOR SELECT USING (true);
CREATE POLICY "Public read item_specs" ON item_specs FOR SELECT USING (true);

-- Service role can do everything
CREATE POLICY "Service role full access items" ON items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access item_descriptions" ON item_descriptions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access item_attributes" ON item_attributes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access item_assets" ON item_assets FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access item_specs" ON item_specs FOR ALL USING (auth.role() = 'service_role');