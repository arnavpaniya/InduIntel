import { v4 as uuidv4 } from 'uuid';
import { DocumentChunk, Product, ProductCategory, ProductAttribute, Evidence, DocumentReference, ProcessingStage } from '@/types';
import { getAIProvider } from '@/lib/ai';
import { parsePDF, parseCSV, validatePDFBuffer, validateCSVBuffer, generateSafeFilename } from '@/lib/pdf';
import { validateAndScore, mergeAttributesFromSources } from '@/lib/validation';
import { enrichProduct } from '@/lib/enrichment';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export interface ProcessingContext {
  userId: string;
  documentId: string;
  documentName: string;
  documentType: 'pdf' | 'csv' | 'text';
  category?: ProductCategory;
  manufacturer?: string;
  model?: string;
}

export interface ProcessingResult {
  product: Product;
  stages: ProcessingStage[];
}

export async function processDocument(
  buffer: Buffer,
  context: ProcessingContext
): Promise<ProcessingResult> {
  const stages: ProcessingStage[] = [
    { stage: 'Upload', status: 'completed', message: 'Document uploaded' },
    { stage: 'Reading', status: 'processing', message: 'Extracting content' },
    { stage: 'Understanding', status: 'pending', message: 'AI classification & extraction' },
    { stage: 'Validating', status: 'pending', message: 'Normalization & validation' },
    { stage: 'Ready', status: 'pending', message: 'Finalizing product' },
  ];

  const supabase = createSupabaseAdminClient();

  try {
    // Stage 2: Parse
    let chunks: DocumentChunk[] = [];
    let pageCount = 0;

    if (context.documentType === 'pdf') {
      const validation = validatePDFBuffer(buffer);
      if (!validation.valid) throw new Error(validation.error);

      const result = await parsePDF(buffer, context.documentId);
      chunks = result.chunks;
      pageCount = result.pageCount;
    } else if (context.documentType === 'csv') {
      const validation = validateCSVBuffer(buffer);
      if (!validation.valid) throw new Error(validation.error);

      const result = parseCSV(buffer, context.documentId);
      chunks = result.chunks;
      pageCount = result.rowCount;
    } else {
      const text = buffer.toString('utf-8');
      chunks = [{
        documentId: context.documentId,
        page: 1,
        text,
        type: 'text',
      }];
      pageCount = 1;
    }

    stages[1] = { stage: 'Reading', status: 'completed', message: `Extracted ${chunks.length} chunks from ${pageCount} pages` };

    // Stage 3: Classify & Extract
    stages[2] = { stage: 'Understanding', status: 'processing', message: 'Classifying product...' };

    const aiProvider = getAIProvider();
    const aiInput = {
      documentChunks: chunks,
      category: context.category,
      manufacturer: context.manufacturer,
      model: context.model,
    };

    let extraction = await aiProvider.analyzeProduct(aiInput);

    // If category wasn't provided, use AI classification
    const category = context.category || extraction.category;
    const manufacturer = context.manufacturer || extraction.manufacturer;
    const model = context.model || extraction.model;

    stages[2] = { stage: 'Understanding', status: 'completed', message: `Classified as ${category}, extracted ${extraction.attributes.length} attributes` };

    // Stage 4: Normalize & Validate
    stages[3] = { stage: 'Validating', status: 'processing', message: 'Normalizing units & validating...' };

    const attributes: ProductAttribute[] = extraction.attributes.map(attr => ({
      key: attr.key,
      label: attr.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: attr.value,
      unit: attr.unit,
      normalizedValue: attr.value,
      normalizedUnit: attr.unit,
      status: attr.evidence.length > 0 ? 'VERIFIED' : 'INFERRED',
      confidence: attr.confidence,
      evidence: attr.evidence.map(e => ({
        ...e,
        documentId: context.documentId,
        documentName: context.documentName,
      })),
    }));

    const evidenceMap = new Map<string, Evidence[]>();
    attributes.forEach(attr => {
      attr.evidence.forEach(e => {
        if (!evidenceMap.has(attr.key)) evidenceMap.set(attr.key, []);
        evidenceMap.get(attr.key)!.push(e);
      });
    });

    const validation = validateAndScore(attributes, category, evidenceMap);
    const enrichment = enrichProduct(validation.attributes, category, evidenceMap);

    stages[3] = { stage: 'Validating', status: 'completed', message: `Validated ${validation.attributes.length} attributes, ${validation.conflicts.length} conflicts, ${enrichment.missingAttributes.length} missing` };

    // Stage 5: Ready - Create Product
    stages[4] = { stage: 'Ready', status: 'processing', message: 'Creating product record...' };

    const productId = uuidv4();
    const now = new Date().toISOString();

    const documentRef: DocumentReference = {
      id: context.documentId,
      name: context.documentName,
      type: context.documentType,
      pageCount,
    };

    const product: Product = {
      id: productId,
      name: `${manufacturer} ${model}`.trim() || null,
      manufacturer,
      model,
      category,
      attributes: enrichment.enrichedAttributes,
      completeness: enrichment.enrichedAttributes.length > 0 ? Math.round((enrichment.enrichedAttributes.filter(a => a.status !== 'UNKNOWN').length / enrichment.enrichedAttributes.length) * 100) : 0,
      confidence: validation.confidence,
      conflicts: validation.conflicts,
      missingAttributes: enrichment.missingAttributes,
      documents: [documentRef],
      commerce: null,
      createdAt: now,
      updatedAt: now,
    };

    // Store in database
    await storeProduct(supabase, context.userId, product, context.documentId);

    stages[4] = { stage: 'Ready', status: 'completed', message: 'Product intelligence ready' };

    return { product, stages };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stages.forEach(s => {
      if (s.status === 'processing') s.status = 'failed';
    });
    throw new Error(`Processing failed: ${errorMessage}`);
  }
}

async function storeProduct(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  product: Product,
  documentId: string
) {
  const { error: productError } = await supabase
    .from('products')
    .insert({
      id: product.id,
      user_id: userId,
      name: product.name,
      manufacturer: product.manufacturer,
      model: product.model,
      category: product.category,
      completeness: product.completeness,
      confidence: product.confidence,
      attributes: product.attributes,
      conflicts: product.conflicts,
      missing_attributes: product.missingAttributes,
      commerce: product.commerce,
      created_at: product.createdAt,
      updated_at: product.updatedAt,
    });

  if (productError) throw productError;

  const { error: linkError } = await supabase
    .from('product_documents')
    .insert({
      product_id: product.id,
      document_id: documentId,
    });

  if (linkError) throw linkError;

  if (product.attributes.length > 0) {
    const evidenceRows = product.attributes.flatMap(attr =>
      attr.evidence.map(e => ({
        product_id: product.id,
        document_id: e.documentId,
        attribute_key: attr.key,
        page: e.page,
        quote: e.quote,
      }))
    );

    if (evidenceRows.length > 0) {
      const { error: evidenceError } = await supabase
        .from('evidence')
        .insert(evidenceRows);

      if (evidenceError) throw evidenceError;
    }
  }
}

export async function processMultipleDocuments(
  buffers: Buffer[],
  contexts: ProcessingContext[]
): Promise<ProcessingResult> {
  if (buffers.length === 1) {
    return processDocument(buffers[0], contexts[0]);
  }

  const results = await Promise.all(
    buffers.map((buffer, i) => processDocument(buffer, contexts[i]))
  );

  const primary = results[0];
  const allAttributes = results.flatMap(r => r.product.attributes);
  const allConflicts = results.flatMap(r => r.product.conflicts);
  const allDocuments = results.flatMap(r => r.product.documents);

  const mergedAttributes = mergeAttributesFromSources(
    results.map(r => r.product.attributes),
    primary.product.category
  );

  const supabase = createSupabaseAdminClient();
  const evidenceMap = new Map<string, Evidence[]>();
  mergedAttributes.forEach(attr => {
    attr.evidence.forEach(e => {
      if (!evidenceMap.has(attr.key)) evidenceMap.set(attr.key, []);
      evidenceMap.get(attr.key)!.push(e);
    });
  });

  const validation = validateAndScore(mergedAttributes, primary.product.category, evidenceMap);
  const enrichment = enrichProduct(validation.attributes, primary.product.category, evidenceMap);

  const mergedProduct: Product = {
    ...primary.product,
    attributes: enrichment.enrichedAttributes,
    completeness: enrichment.enrichedAttributes.length > 0 ? Math.round((enrichment.enrichedAttributes.filter(a => a.status !== 'UNKNOWN').length / enrichment.enrichedAttributes.length) * 100) : 0,
    confidence: validation.confidence,
    conflicts: validation.conflicts,
    missingAttributes: enrichment.missingAttributes,
    documents: allDocuments,
    updatedAt: new Date().toISOString(),
  };

  await updateProduct(supabase, primary.product.id, mergedProduct);

  return {
    product: mergedProduct,
    stages: primary.stages,
  };
}

async function updateProduct(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  productId: string,
  product: Product
) {
  const { error } = await supabase
    .from('products')
    .update({
      attributes: product.attributes,
      conflicts: product.conflicts,
      missing_attributes: product.missingAttributes,
      completeness: product.completeness,
      confidence: product.confidence,
      updated_at: product.updatedAt,
    })
    .eq('id', productId);

  if (error) throw error;
}