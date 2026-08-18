export type ProductCategory =
  | 'electric_motor'
  | 'bearing'
  | 'industrial_pump'
  | 'unknown';

export type EvidenceStatus =
  | 'VERIFIED'
  | 'INFERRED'
  | 'UNKNOWN'
  | 'CONFLICT';

export type ConflictSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Evidence {
  documentId: string;
  documentName: string;
  page: number;
  quote: string;
}

export interface ProductAttribute {
  key: string;
  label: string;
  value: string | number | null;
  unit: string | null;
  normalizedValue?: string | number | null;
  normalizedUnit?: string | null;
  status: EvidenceStatus;
  confidence: number;
  evidence: Evidence[];
}

export interface Conflict {
  id: string;
  attributeKey: string;
  values: {
    value: string | number;
    unit: string | null;
    source: Evidence;
  }[];
  recommendedValue: string | number | null;
  recommendedUnit: string | null;
  confidence: number;
  severity: ConflictSeverity;
  requiresHumanReview: boolean;
}

export interface DocumentReference {
  id: string;
  name: string;
  type: 'pdf' | 'csv' | 'text';
  pageCount?: number;
}

export interface CommerceOutput {
  title: string;
  shortDescription: string;
  longDescription: string;
  keywords: string[];
  technicalSpecifications: {
    key: string;
    label: string;
    value: string;
  }[];
}

export interface Product {
  id: string;
  name: string | null;
  manufacturer: string | null;
  model: string | null;
  category: ProductCategory;
  attributes: ProductAttribute[];
  completeness: number;
  confidence: number;
  conflicts: Conflict[];
  missingAttributes: string[];
  documents: DocumentReference[];
  commerce: CommerceOutput | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  documentId: string;
  page: number;
  text: string;
  type: 'text' | 'table' | 'image';
}

export interface AIInput {
  documentChunks: DocumentChunk[];
  category?: ProductCategory;
  manufacturer?: string;
  model?: string;
}

export interface ProductExtraction {
  category: ProductCategory;
  manufacturer: string | null;
  model: string | null;
  attributes: {
    key: string;
    value: string | number | null;
    unit: string | null;
    confidence: number;
    evidence: Evidence[];
  }[];
}

export interface ProcessingStage {
  stage: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
}

export interface UploadResponse {
  documentId: string;
  name: string;
  type: string;
  size: number;
  pageCount?: number;
}

export interface AnalyzeResponse {
  productId: string;
  stages: ProcessingStage[];
}

export interface ExportOptions {
  format: 'json' | 'csv';
  includeEvidence: boolean;
  includeConflicts: boolean;
}