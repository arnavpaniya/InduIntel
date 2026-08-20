-- 006_ground_truth_preservation.sql
-- Create separate tables to preserve ground truth data for scoring

-- Ground truth items (copy of items at ground truth state)
CREATE TABLE ground_truth_items (
    id UUID PRIMARY KEY,
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
    status TEXT NOT NULL DEFAULT 'enriched',
    confidence_score NUMERIC(5,2),
    field_confidence NUMERIC(3,2),
    is_ground_truth BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- Ground truth descriptions
CREATE TABLE ground_truth_descriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES ground_truth_items(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    value TEXT,
    char_count INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ground truth attributes
CREATE TABLE ground_truth_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES ground_truth_items(id) ON DELETE CASCADE,
    seq INT NOT NULL CHECK (seq >= 1 AND seq <= 50),
    label TEXT,
    value TEXT,
    uom TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ground truth assets
CREATE TABLE ground_truth_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES ground_truth_items(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL,
    url TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ground truth specs
CREATE TABLE ground_truth_specs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES ground_truth_items(id) ON DELETE CASCADE UNIQUE,
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

-- Indexes
CREATE INDEX idx_ground_truth_items_mfg_part_num ON ground_truth_items(mfg_part_num);
CREATE INDEX idx_ground_truth_descriptions_item_id ON ground_truth_descriptions(item_id);
CREATE INDEX idx_ground_truth_attributes_item_id ON ground_truth_attributes(item_id);
CREATE INDEX idx_ground_truth_assets_item_id ON ground_truth_assets(item_id);
CREATE INDEX idx_ground_truth_specs_item_id ON ground_truth_specs(item_id);

-- RLS
ALTER TABLE ground_truth_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ground_truth_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ground_truth_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ground_truth_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ground_truth_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ground_truth_items" ON ground_truth_items FOR SELECT USING (true);
CREATE POLICY "Public read ground_truth_descriptions" ON ground_truth_descriptions FOR SELECT USING (true);
CREATE POLICY "Public read ground_truth_attributes" ON ground_truth_attributes FOR SELECT USING (true);
CREATE POLICY "Public read ground_truth_assets" ON ground_truth_assets FOR SELECT USING (true);
CREATE POLICY "Public read ground_truth_specs" ON ground_truth_specs FOR SELECT USING (true);

CREATE POLICY "Service role full access ground_truth_items" ON ground_truth_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access ground_truth_descriptions" ON ground_truth_descriptions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access ground_truth_attributes" ON ground_truth_attributes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access ground_truth_assets" ON ground_truth_assets FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access ground_truth_specs" ON ground_truth_specs FOR ALL USING (auth.role() = 'service_role');

-- Function to snapshot current ground truth state
CREATE OR REPLACE FUNCTION snapshot_ground_truth()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    -- Snapshot items
    INSERT INTO ground_truth_items (
        id, mfg_part_num, part_desc, e1_brand, unilog_brand, dib_brand, part_manuf,
        dept, class, fine, classpath, manufacturer_name, brand_name,
        status, confidence_score, field_confidence, is_ground_truth, created_at, updated_at
    )
    SELECT 
        id, mfg_part_num, part_desc, e1_brand, unilog_brand, dib_brand, part_manuf,
        dept, class, fine, classpath, manufacturer_name, brand_name,
        status, confidence_score, field_confidence, true, created_at, updated_at
    FROM items
    WHERE is_ground_truth = true
    ON CONFLICT (id) DO UPDATE SET
        mfg_part_num = EXCLUDED.mfg_part_num,
        part_desc = EXCLUDED.part_desc,
        e1_brand = EXCLUDED.e1_brand,
        unilog_brand = EXCLUDED.unilog_brand,
        dib_brand = EXCLUDED.dib_brand,
        part_manuf = EXCLUDED.part_manuf,
        dept = EXCLUDED.dept,
        class = EXCLUDED.class,
        fine = EXCLUDED.fine,
        classpath = EXCLUDED.classpath,
        manufacturer_name = EXCLUDED.manufacturer_name,
        brand_name = EXCLUDED.brand_name,
        status = EXCLUDED.status,
        confidence_score = EXCLUDED.confidence_score,
        field_confidence = EXCLUDED.field_confidence,
        is_ground_truth = EXCLUDED.is_ground_truth,
        updated_at = EXCLUDED.updated_at;

    -- Snapshot descriptions
    INSERT INTO ground_truth_descriptions (item_id, field_name, value, char_count, created_at)
    SELECT item_id, field_name, value, char_count, created_at
    FROM item_descriptions
    WHERE item_id IN (SELECT id FROM items WHERE is_ground_truth = true)
    ON CONFLICT (id) DO UPDATE SET
        field_name = EXCLUDED.field_name,
        value = EXCLUDED.value,
        char_count = EXCLUDED.char_count;

    -- Snapshot attributes
    INSERT INTO ground_truth_attributes (item_id, seq, label, value, uom, created_at)
    SELECT item_id, seq, label, value, uom, created_at
    FROM item_attributes
    WHERE item_id IN (SELECT id FROM items WHERE is_ground_truth = true)
    ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        value = EXCLUDED.value,
        uom = EXCLUDED.uom;

    -- Snapshot assets
    INSERT INTO ground_truth_assets (item_id, asset_type, url, sort_order, created_at)
    SELECT item_id, asset_type, url, sort_order, created_at
    FROM item_assets
    WHERE item_id IN (SELECT id FROM items WHERE is_ground_truth = true)
    ON CONFLICT (id) DO UPDATE SET
        asset_type = EXCLUDED.asset_type,
        url = EXCLUDED.url,
        sort_order = EXCLUDED.sort_order;

    -- Snapshot specs
    INSERT INTO ground_truth_specs (
        item_id, upc, ean, gtin, unspsc, list_price,
        length, length_uom, width, width_uom, height, height_uom,
        weight, weight_uom, country_of_origin, warranty, created_at, updated_at
    )
    SELECT 
        item_id, upc, ean, gtin, unspsc, list_price,
        length, length_uom, width, width_uom, height, height_uom,
        weight, weight_uom, country_of_origin, warranty, created_at, updated_at
    FROM item_specs
    WHERE item_id IN (SELECT id FROM items WHERE is_ground_truth = true)
    ON CONFLICT (item_id) DO UPDATE SET
        upc = EXCLUDED.upc,
        ean = EXCLUDED.ean,
        gtin = EXCLUDED.gtin,
        unspsc = EXCLUDED.unspsc,
        list_price = EXCLUDED.list_price,
        length = EXCLUDED.length,
        length_uom = EXCLUDED.length_uom,
        width = EXCLUDED.width,
        width_uom = EXCLUDED.width_uom,
        height = EXCLUDED.height,
        height_uom = EXCLUDED.height_uom,
        weight = EXCLUDED.weight,
        weight_uom = EXCLUDED.weight_uom,
        country_of_origin = EXCLUDED.country_of_origin,
        warranty = EXCLUDED.warranty,
        updated_at = EXCLUDED.updated_at;
END;
$$;