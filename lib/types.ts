export interface Item {
  id: string;
  mfg_part_num: string;
  part_desc: string | null;
  e1_brand: string | null;
  unilog_brand: string | null;
  dib_brand: string | null;
  part_manuf: string | null;
  dept: string | null;
  class: string | null;
  fine: string | null;
  classpath: string | null;
  manufacturer_name: string | null;
  brand_name: string | null;
  status: 'raw' | 'enriching' | 'enriched' | 'review';
  confidence_score: number | null;
  field_confidence: number | null;
  is_ground_truth: boolean;
  batch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemsResponse {
  items: Item[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ItemDescription {
  id: string;
  item_id: string;
  field_name: string;
  value: string;
  char_count: number;
  created_at: string;
}

export interface ItemAttribute {
  id: string;
  item_id: string;
  seq: number;
  label: string | null;
  value: string | null;
  uom: string | null;
  created_at: string;
}

export interface ItemSpec {
  id: string;
  item_id: string;
  upc: string | null;
  ean: string | null;
  gtin: string | null;
  unspsc: string | null;
  list_price: number | null;
  length: number | null;
  length_uom: string | null;
  width: number | null;
  width_uom: string | null;
  height: number | null;
  height_uom: string | null;
  weight: number | null;
  weight_uom: string | null;
  country_of_origin: string | null;
  warranty: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnrichedItem extends Item {
  item_descriptions: ItemDescription[];
  item_attributes: ItemAttribute[];
  item_specs: ItemSpec[];
  item_assets: { product_image: string }[];
}

export interface EnrichRunResponse {
  success: boolean;
  item_id: string;
  status: 'enriched' | 'review';
  confidence_score: number;
  field_confidence: number;
  step_results: Record<string, any>;
  item: EnrichedItem;
}

export interface BatchEnrichResponse {
  success: boolean;
  summary: {
    processed: number;
    enriched: number;
    needs_review: number;
    avg_confidence: number;
    quota_used: number;
    quota_limit: number;
    skipped_due_to_quota: number;
  };
  results: any[];
}

export interface FieldScore {
  field_name: string;
  match_type: 'exact_match' | 'close_match' | 'mismatch' | 'missing_in_output' | 'extra_in_output';
  expected: string | number | null;
  actual: string | number | null;
  details?: string;
}

export interface GroupScore {
  group: string;
  matched: number;
  total: number;
  accuracy_pct: number;
  reason_tag?: string;
  fields: FieldScore[];
}

export interface ConfidenceAccuracyCorrelation {
  confidence_score: number;
  field_confidence: number;
  status: string;
  correlation_note: string;
}

export interface ScoreItemResponse {
  success: boolean;
  item_id: string;
  ground_truth_id: string;
  field_scores: FieldScore[];
  group_scores: GroupScore[];
  overall_accuracy_pct: number;
  total_fields: number;
  matched_fields: number;
  confidence_accuracy_correlation?: ConfidenceAccuracyCorrelation;
}

export interface BatchScoreSummary {
  items_scored: number;
  avg_accuracy_pct: number;
  field_accuracy_breakdown: Record<string, number>;
  char_limit_compliance: Record<string, number>;
  attribute_lov_compliance_pct: number;
  confidence_accuracy_correlation: Record<string, number>;
}

export interface BatchScoreResponse {
  success: boolean;
  summary: BatchScoreSummary;
  results: ScoreItemResponse[];
}

export interface QuotaStatus {
  /** false when real usage cannot be determined — frontend must show unavailable state */
  available: boolean;
  used: number | null;
  /** null when no configured limit exists */
  limit: number | null;
  remaining: number | null;
  near_limit: boolean;
  /** deterministic completions that required zero Gemini calls (may be null) */
  gemini_calls_avoided?: number | null;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  count: number;
  batchId: string;
  items: Array<{ id: string; mfg_part_num: string; created_at: string }>;
}