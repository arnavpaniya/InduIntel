/**
 * Evaluation Dataset Simulator (Stage 5, Part 16)
 *
 * Generates ADVERSARIAL SYNTHETIC product inputs covering 30+ robustness
 * scenario types. Nothing here is derived from the organizer's sample
 * dataset — all manufacturers/MPNs are fictional and generated.
 *
 * Scenarios (Part 16 list):
 *  01 fully populated          02 completely sparse         03 missing manufacturer
 *  04 missing MPN              05 missing description       06 unknown manufacturer
 *  07 unknown category         08 electronics               09 industrial
 *  10 automotive               11 medical                   12 duplicate product
 *  13 conflicting input        14 malformed MPN             15 unicode manufacturer
 *  16 unicode description      17 very long description     18 extra input columns
 *  19 reordered columns        20 missing input columns     21 invalid numeric
 *  22 invalid URL source       23 wrong external product    24 conflicting external sources
 *  25 no external source       26 deterministic-only        27 gemini-required
 *  28 service unavailable      29 gemini unavailable        30 cache hit
 */

export type LogicalField =
  | 'mpn' | 'manufacturer' | 'brand' | 'description' | 'category' | 'dept'
  | 'upc' | 'ean' | 'gtin' | 'weight' | 'warranty' | 'price'
  | 'length' | 'width' | 'height';

export interface ScenarioRow {
  scenario: string;
  /** Logical field -> raw cell value (pre-layout mapping). */
  data: Partial<Record<LogicalField, string>>;
  /** Which layout variant to render the row with. */
  layout?: LayoutName;
  /** Raw physical columns appended verbatim (bypass layout) — used for
   *  same-field-different-column conflict scenarios. */
  rawColumns?: Record<string, string>;
}

export type LayoutName = 'canonical' | 'renamed' | 'shuffled' | 'extra' | 'minimal';

/** GS1 check-digit helper so synthetic barcodes are VALID (checksum-wise). */
export function makeGtin11to12(base11: string): string {
  const digits = base11.padStart(11, '0').split('').map(Number);
  let sum = 0;
  let pos = 0;
  for (let i = digits.length - 1; i >= 0; i--, pos++) {
    sum += digits[i] * (pos % 2 === 0 ? 3 : 1);
  }
  return base11.padStart(11, '0') + String((10 - (sum % 10)) % 10);
}

// ---------------------------------------------------------------------------
// Physical layouts: arbitrary schemas the normalizer must survive
// ---------------------------------------------------------------------------

const LAYOUTS: Record<LayoutName, Record<LogicalField, string>> = {
  canonical: {
    mpn: 'Mfg_Part_Num', manufacturer: 'Manufacturer', brand: 'Brand',
    description: 'Description', category: 'Category', dept: 'Dept',
    upc: 'UPC', ean: 'EAN', gtin: 'GTIN', weight: 'Weight',
    warranty: 'Warranty', price: 'List Price',
    length: 'Length', width: 'Width', height: 'Height',
  },
  renamed: {
    mpn: 'MPN', manufacturer: 'MFR', brand: 'Brand Name',
    description: 'PART_DESC', category: 'Product Type', dept: 'DEPARTMENT',
    upc: 'UPC Code', ean: 'EAN-13', gtin: 'gtin-code', weight: 'Net Weight (kg)',
    warranty: 'warranty_terms', price: 'MSRP',
    length: 'LEN', width: 'WIDTH_UOM_VALUE', height: 'Height (mm)',
  },
  shuffled: {
    mpn: 'part_number', manufacturer: 'MANUFACTURER_NAME', brand: 'brandname',
    description: 'product description', category: 'CATEGORY PATH', dept: 'dept',
    upc: 'UpcCode', ean: 'ean_code', gtin: 'GTIN14', weight: 'WEIGHT',
    warranty: 'Warranty Information', price: 'price_each',
    length: 'length_in', width: 'wd', height: 'HT',
  },
  extra: {
    mpn: 'Item Number', manufacturer: 'Mfg', brand: 'Trade Brand',
    description: 'Long Description', category: 'Commodity', dept: 'Division',
    upc: 'Barcode UPC', ean: 'European Article Number', gtin: 'Global Trade Item Number',
    weight: 'Shipping Weight', warranty: 'Warranty Period', price: 'Unit Price',
    length: 'Package Length', width: 'Package Width', height: 'Package Height',
  },
  minimal: {
    mpn: 'SKU_PART', manufacturer: 'manufacturer_name', brand: 'Brand',
    description: 'DESC', category: 'Classpath', dept: 'Dept',
    upc: 'UPC', ean: 'EAN', gtin: 'GTIN', weight: 'Weight',
    warranty: 'Warranty', price: 'Price',
    length: 'LENGTH', width: 'WIDTH', height: 'HEIGHT',
  },
};

const EXTRA_COLUMNS: Record<string, string> = {
  'Warehouse Location': 'A-12-3',
  'Internal Cost': '42.00',
  'Legacy ID': 'LEG-000111',
};

/** Render scenario rows into physical CSV records (header -> value). */
export function renderRows(rows: ScenarioRow[]): { records: Array<Record<string, string>>; headersInOrder: string[] } {
  const records: Array<Record<string, string>> = [];
  for (const row of rows) {
    const layout = LAYOUTS[row.layout ?? 'canonical'];
    const record: Record<string, string> = {};
    for (const [logical, value] of Object.entries(row.data)) {
      if (value == null) continue;
      const col = layout[logical as LogicalField];
      record[col] = value;
    }
    if ((row.layout ?? 'canonical') === 'extra') {
      for (const [col, val] of Object.entries(EXTRA_COLUMNS)) record[col] = val;
    }
    if (row.rawColumns) {
      for (const [col, val] of Object.entries(row.rawColumns)) record[col] = val;
    }
    // Shuffle key order per-row so even column ORDER varies (Part 1).
    const ordered: Record<string, string> = {};
    const keys = Object.keys(record);
    for (let i = 0; i < keys.length; i++) {
      // deterministic pseudo-shuffle by index arithmetic
      const k = keys[(i * 7 + 3) % keys.length];
      if (!(k in ordered)) ordered[k] = record[k];
    }
    records.push(ordered);
  }

  const headersInOrder = [...new Set(records.flatMap((r) => Object.keys(r)))];
  return { records, headersInOrder };
}

/** RFC4180 CSV serializer. */
export function toCsv(records: Array<Record<string, string>>, headers: string[]): string {
  const esc = (v: string): string => {
    if (/[",\n\r]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
    return v;
  };
  const lines = [headers.map(esc).join(',')];
  for (const rec of records) {
    lines.push(headers.map((h) => (rec[h] != null ? esc(rec[h]) : '')).join(','));
  }
  return lines.join('\r\n');
}

// ---------------------------------------------------------------------------
// Scenario construction — fictional manufacturers/products only
// ---------------------------------------------------------------------------

interface Company {
  name: string; brand: string; prefix: string; domain: string;
}

const COMPANIES: Company[] = [
  { name: 'Zephyr Dynamics', brand: 'ZephAir', prefix: 'ZD', domain: 'zephyrdynamics.example.com' },
  { name: 'Ironvale Toolworks', brand: 'Ironvale', prefix: 'IVT', domain: 'ironvale-tools.example.com' },
  { name: 'Nordwind Elektrotechnik', brand: 'Nordwind', prefix: 'NWE', domain: 'nordwind-et.example.com' },
  { name: 'Meridian Biosystems', brand: 'MeridianBio', prefix: 'MBIO', domain: 'meridianbio.example.com' },
  { name: 'Cascadia Motors Group', brand: 'Cascadia', prefix: 'CMG', domain: 'cascadiamotors.example.com' },
];

/**
 * Build the full synthetic evaluation dataset (>=50 rows, all 30 scenarios).
 */
export function buildSyntheticDataset(): { rows: ScenarioRow[]; meta: Map<number, string> } {
  const rows: ScenarioRow[] = [];
  const meta = new Map<number, string>(); // rowIndex -> scenario label

  const push = (scenario: string, row: ScenarioRow) => {
    meta.set(rows.length, scenario);
    rows.push(row);
  };

  const c0 = COMPANIES[0], c1 = COMPANIES[1], c2 = COMPANIES[2], c3 = COMPANIES[3], c4 = COMPANIES[4];

  // --- 26. deterministic-only external evidence (x6, no category -> no extra asks)
  for (let i = 0; i < 6; i++) {
    const mpn = `DET-${c0.prefix}-${1000 + i}`;
    push('deterministic_only', {
      scenario: 'deterministic_only',
      layout: i % 2 === 0 ? 'canonical' : 'renamed',
      data: {
        mpn,
        manufacturer: c0.name,
        brand: c0.brand,
        description: `Precision alignment gauge assembly model ${1000 + i} with hardened steel frame`,
      },
    });
  }

  // --- 27. gemini-required ambiguous evidence (x4)
  for (let i = 0; i < 4; i++) {
    const mpn = `AMB-${c2.prefix}-${2000 + i}`;
    push('gemini_required', {
      scenario: 'gemini_required',
      layout: i % 2 === 0 ? 'shuffled' : 'minimal',
      data: {
        mpn,
        manufacturer: c2.name,
        brand: c2.brand,
        description: `Industrial servo drive controller unit ${2000 + i}, panel mount`,
      },
    });
  }

  // --- 08-11 category products (electronics x2, industrial x2, automotive x2, medical x2)
  const catSpecs: Array<[Company, string, string]> = [
    [c2, 'ELE', 'electronics'],
    [c2, 'ELE', 'electronics'],
    [c1, 'IND', 'industrial'],
    [c1, 'IND', 'industrial'],
    [c4, 'AUT', 'automotive'],
    [c4, 'AUT', 'automotive'],
    [c3, 'MED', 'medical'],
    [c3, 'MED', 'medical'],
  ];
  catSpecs.forEach(([company, tag], i) => {
    push(`category_${tag}`, {
      scenario: `category_${tag}`,
      layout: i % 2 === 0 ? 'canonical' : 'extra',
      data: {
        mpn: `${tag}-${company.prefix}-${3000 + i}`,
        manufacturer: company.name,
        brand: company.brand,
        description: `${tag} series instrument module ${3000 + i} calibrated for field deployment`,
        category: tag === 'MED' ? 'Medical Equipment' : tag === 'AUT' ? 'Automotive Parts' : tag,
      },
    });
  });

  // --- 01. fully populated product
  push('fully_populated', {
    scenario: 'fully_populated',
    layout: 'canonical',
    data: {
      mpn: 'FULL-ZD-9001',
      manufacturer: c0.name,
      brand: c0.brand,
      description: 'Complete torque calibration station with digital readout and certificate',
      category: 'Calibration Equipment',
      upc: makeGtin11to12('03600029145'),
      ean: '4006381333931',
      gtin: '00012345678905',
      weight: '8.4 kg',
      warranty: '3 years limited',
      price: '1249.99',
      length: '60 cm', width: '40 cm', height: '25 cm',
    },
  });

  // --- 02. completely sparse
  // Rendered as a row whose cells are all EMPTY strings (never a blank line,
  // which RFC-tolerant parsers would skip and desync row indices).
  push('sparse_empty', {
    scenario: 'completely_sparse',
    layout: 'canonical',
    data: { mpn: '' },
  });

  // --- 03. missing manufacturer (brand + mpn only)
  push('missing_manufacturer', {
    scenario: 'missing_manufacturer',
    data: { mpn: 'NOMFG-777', brand: 'Ghostline', description: 'Anodized aluminum spacer kit for rack rails' },
  });

  // --- 04. missing MPN (manufacturer + description only — never merged blindly)
  push('missing_mpn', {
    scenario: 'missing_mpn',
    data: { manufacturer: c1.name, description: 'Pneumatic impact wrench with twin hammer mechanism and composite housing' },
  });

  // --- 05. missing description
  push('missing_description', {
    scenario: 'missing_description',
    data: { mpn: 'NODESC-555', manufacturer: c0.name },
  });

  // --- 06. unknown manufacturer
  push('unknown_manufacturer', {
    scenario: 'unknown_manufacturer',
    data: { mpn: 'UNK-ZORG-1', manufacturer: 'Zorgon Fabrication Collective', description: 'Crystalline resonance mounting clamp assembly for lab benches' },
  });

  // --- 07. unknown category
  push('unknown_category', {
    scenario: 'unknown_category',
    layout: 'renamed',
    data: {
      mpn: 'CAT-QH-42',
      manufacturer: c1.name,
      brand: c1.brand,
      description: 'Hydroponic photon emitter array with spectral tuning dial',
      category: 'Quantum Horticulture',
    },
  });

  // --- 12 + 30. duplicates (same identity appearing multiple times)
  push('duplicate_exact', {
    scenario: 'duplicate_exact',
    layout: 'renamed',
    data: {
      mpn: `DET-${c0.prefix}-1000`,
      manufacturer: c0.name,
      brand: c0.brand,
      description: `Precision alignment gauge assembly model 1000 with hardened steel frame`,
    },
  });
  push('duplicate_same_identity_diff_desc', {
    scenario: 'duplicate_same_identity_diff_desc',
    layout: 'minimal',
    data: {
      mpn: `DET-${c0.prefix}-1000`,
      manufacturer: c0.name,
      brand: c0.brand,
      description: 'totally different marketing blabber for the same gauge',
    },
  });
  // Negative-cache reuse: same weak-but-valid identity as unknown_manufacturer
  push('negative_cache_reuse', {
    scenario: 'negative_cache_reuse',
    data: { mpn: 'UNK-ZORG-1', manufacturer: 'Zorgon Fabrication Collective', description: 'Second listing of the resonance clamp with extra padding' },
  });

  // --- 13. conflicting input fields (two physical columns -> manufacturer,
  //         plus weight that will also conflict with the external page)
  push('conflicting_input', {
    scenario: 'conflicting_input',
    layout: 'shuffled',
    rawColumns: {
      'MFR': 'Cascadia Motors Group',
      'Manufacturer': 'Meridian Biosystems', // conflicting second column
      'Weight': '2 kg',
    },
    data: {
      mpn: 'CONF-CMG-4001',
      brand: 'Cascadia',
      description: 'Alternator assembly remanufactured with new bearings and regulator',
    },
  });

  // --- 14. malformed MPN
  push('malformed_mpn', {
    scenario: 'malformed_mpn',
    data: { mpn: '!!!@@@###', manufacturer: c1.name, description: 'Corrupted catalog entry recovered from legacy system export' },
  });

  // --- 15/16. unicode manufacturer + description
  push('unicode_manufacturer', {
    scenario: 'unicode_manufacturer',
    data: { mpn: 'UNI-MÜ-1', manufacturer: 'Müller & Söhne Maschinenfabrik', brand: 'MüllerPro', description: 'Präzisions-Fräskopf mit Hartmetallbestückung für Aluminium' },
  });
  push('unicode_description', {
    scenario: 'unicode_description',
    layout: 'shuffled',
    data: { mpn: 'UNI-DÉ-2', manufacturer: 'Björk & Hübinette Verktyg', description: 'Skärande utrustning för rostfritt stål — hög precision ✓ 日本語対応' },
  });

  // --- 17. very long description
  const longDesc = ('Industrial grade modular conveyor segment featuring reinforced side rails, ' +
    'sealed bearing rollers, food-safe belt coating, quick-release tensioners, and tool-less ' +
    'guide rail adjustment. ').repeat(18);
  push('very_long_description', {
    scenario: 'very_long_description',
    data: { mpn: 'LONG-D-9000', manufacturer: c1.name, brand: c1.brand, description: longDesc.slice(0, 5200) },
  });

  // --- 21. invalid numeric + invalid barcode
  push('invalid_numeric', {
    scenario: 'invalid_numeric',
    data: { mpn: 'BADNUM-1', manufacturer: c0.name, description: 'Load cell transducer with corrupted spec sheet', weight: 'heavy-ish' },
  });
  push('invalid_barcode', {
    scenario: 'invalid_barcode',
    data: { mpn: 'BADUPC-2', manufacturer: c0.name, description: 'Retail blister pack sensor kit', upc: '036000291453' }, // bad check digit
  });

  // --- 23. wrong external product (page exists but is a DIFFERENT product)
  push('wrong_external_product', {
    scenario: 'wrong_external',
    data: { mpn: 'WRONG-CMG-4002', manufacturer: 'Cascadia Motors Group', brand: 'Cascadia', description: 'Water pump assembly with gasket and thermostat included' },
  });

  // --- 24. conflicting external sources (input weight vs page weight)
  push('conflicting_external_sources', {
    scenario: 'conflicting_external',
    data: { mpn: 'CONF2-NWE-5001', manufacturer: 'Nordwind Elektrotechnik', brand: 'Nordwind', description: 'Three phase contactor with auxiliary contacts mounted left', weight: '2 kg' },
  });

  // --- 25. no external source at all
  push('no_external_source', {
    scenario: 'no_external_source',
    data: { mpn: 'NOEXT-99', manufacturer: 'Vanishing Point Supply', description: 'Obssolete pneumatic fitting kit discontinued decades ago' },
  });

  // --- 22. invalid URL from search (security regression surface)
  push('invalid_url_source', {
    scenario: 'invalid_url_source',
    data: { mpn: 'BADURL-7', manufacturer: 'Sketchy Parts Depot', description: 'Discount manifold block with questionable provenance documentation' },
  });

  // --- 18/19/20. structural variations (extra cols, reorder, missing cols)
  push('structural_extra_columns', {
    scenario: 'extra_columns',
    layout: 'extra',
    data: { mpn: 'STRUCT-X-1', manufacturer: c3.name, brand: c3.brand, description: 'Sterile instrument tray with indicator strip window' },
  });
  for (let i = 0; i < 14; i++) {
    push('filler_mixed', {
      scenario: `filler_${i}`,
      layout: (['canonical', 'renamed', 'shuffled', 'extra', 'minimal'] as LayoutName[])[i % 5],
      data: {
        mpn: `FILL-${['ZD', 'IVT', 'NWE', 'MBIO', 'CMG'][i % 5]}-${6000 + i}`,
        manufacturer: COMPANIES[i % 5].name,
        brand: COMPANIES[i % 5].brand,
        description: [
          'Vibration isolated optical mount with micrometer adjuster',
          'High flow filtration cartridge rated for hot oil service',
          'Programmable limit switch with redundant encoder channel',
          'Autoclave safe tray system for surgical instrumentation',
          'CAN bus gateway module for heavy duty vehicle retrofit',
          'Corrosion resistant chain hoist with overload clutch',
          'Low noise blower assembly with ECM motor and speed control',
          'Precision bore gauge set with tungsten carbide contacts',
          'Weatherproof junction enclosure with gland plate fittings',
          'Digital pressure transducer with 4-20mA isolated output',
          'Anti static workbench mat kit with grounding stud hardware',
          'Variable frequency drive derated for single phase input',
          'Stainless centrifugal pump with mechanical seal flush line',
          'Thermal imaging camera module with radiometric video output',
        ][i],
      },
    });
  }

  return { rows, meta };
}
