/** Deterministic missing-field detection for product enrichment.
 * 
 * Determines which fields require external evidence based on:
 * - existing value status
 * - category relevance
 * - product identity confidence
 * - MPN as identity anchor
 * 
 * Does NOT perform web search or source retrieval.
 */
export interface MissingFieldInfo {
  needed: string[];
  skip: string[];
  rationale: string[];
}

/**
 * Detect which fields missing from a product item should be prioritized
 * for external evidence retrieval.
 * 
 * @param itemState Current item state from enrichment pipeline
 * @returns Information about which fields are needed, skipped, and why
 */
export function detectMissingFields(itemState: {
  mfg_part_num: string | null;
  manufacturer_name: string | null;
  brand_name: string | null;
  part_desc: string | null;
  dept?: string | undefined;
  class?: string | undefined;
  fine?: string | undefined;
  classpath?: string | undefined;
  confidence_score?: number | undefined;
  item_attributes?: Array<{ label: string; value: string; uom?: string }> | undefined;
  item_specs?: any;
}): MissingFieldInfo {
  const needed: string[] = [];
  const skip: string[] = [];
  const rationale: string[] = [];

  // --- MPN (mfg_part_num) - Identity Anchor ---
  if (itemState.mfg_part_num == null) {
    const hasManufacturer = itemState.manifesturer_name != null || 
                            itemState.brand_name != null;
    const hasStrongDescription = itemState.part_desc != null && 
      itemState.part_desc.length > 20;
    const hasCategoryInfo = itemState.dept != null || itemState.classpath != null;
    
    if (hasManufacturer && (hasStrongDescription || hasCategoryInfo)) {
      needed.push('mfg_part_num');
      rationale.push('MPN missing but manufacturer + strong description/category exists');
    } else {
      skip.push('mfg_part_num');
      rationale.push('MPN missing without sufficient identity anchors - leave unresolved');
    }
  }

  // --- UPC / EAN / GTIN ---
  const specFields = ['upc', 'ean', 'gtin'];
  for (const field of specFields) {
    const hasValue = itemState.item_specs && 
      ((field === 'upc' && itemState.item_specs.upc) ||
       (field === 'ean' && itemState.item_specs.ean) ||
       (field === 'gtin' && itemState.item_specs.gtin));
    if (!hasValue) {
      needed.push(field);
      rationale.push(field.toUpperCase() + ' missing - will attempt external retrieval if evidence available');
    }
  }

  // --- weight
  if (!itemState.item_specs?.weight) {
    needed.push('weight');
    rationale.push('weight missing - common field, worth external lookup');
  } else {
    skip.push('weight');
    rationale.push('weight already present');
  }

  // --- warranty
  if (!itemState.item_specs?.warranty) {
    needed.push('warranty');
    rationale.push('warranty missing - critical field, always prioritize');
  } else {
    skip.push('warranty');
    rationale.push('warranty already present');
  }

  // --- dimensions
  const hasDims = itemState.item_specs && 
    (itemState.item_specs.length || itemState.item_specs.width || itemState.item_specs.height);
  if (!hasDims) {
    needed.push('dimensions');
    rationale.push('dimensions missing - common for products');
  } else {
    skip.push('dimensions');
    rationale.push('dimensions already present');
  }

  // --- category-specific attributes
  if (itemState.dept) {
    const cat = itemState.dept.toLowerCase();
    if (cat === 'electronics') {
      if (!itemState.item_attributes?.some((a: any) => /voltage|voltage.?rating/i.test(a.label))) {
        needed.push('voltage');
        rationale.push('Voltage Rating - electronics category');
      }
    }
    if (cat === 'industrial') {
      if (!itemState.item_attributes?.some((a: any) => /horsepower|rpm/i.test(a.label))) {
        needed.push('horsepower');
        rationale.push('Horsepower/RPM - industrial category');
      }
    }
  }

  return { needed, skip, rationale };
}
