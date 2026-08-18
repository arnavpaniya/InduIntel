import { Product, DocumentReference, Evidence, Conflict } from '@/types';
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface StoredDocument {
  id: string;
  userId: string;
  name: string;
  originalName: string;
  type: 'pdf' | 'csv' | 'text';
  size: number;
  pageCount?: number;
  storagePath: string;
  mimeType?: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// In-Memory store fallback when Supabase credentials are not supplied
class MemoryStore {
  products: Map<string, Product> = new Map();
  documents: Map<string, StoredDocument> = new Map();
  productDocuments: Array<{ productId: string; documentId: string }> = [];
  evidence: Array<{ id: string; productId: string; documentId: string; attributeKey: string; page: number; quote: string }> = [];
}

const memoryStore = new MemoryStore();

function hasSupabaseCredentials(): boolean {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function saveDocumentRecord(doc: StoredDocument): Promise<void> {
  if (hasSupabaseCredentials()) {
    try {
      const { error } = await (supabaseAdmin as any).from('documents').insert({
        id: doc.id,
        user_id: doc.userId,
        name: doc.name,
        original_name: doc.originalName,
        type: doc.type,
        size: doc.size,
        page_count: doc.pageCount,
        storage_path: doc.storagePath,
        mime_type: doc.mimeType,
        status: doc.status,
        error_message: doc.errorMessage,
        created_at: doc.createdAt,
        updated_at: doc.updatedAt,
      });
      if (!error) return;
      console.warn('Supabase document insert failed, saving to memory store:', error.message);
    } catch (e: any) {
      console.warn('Supabase document insert error:', e.message);
    }
  }

  memoryStore.documents.set(doc.id, doc);
}

export async function getDocumentRecord(documentId: string): Promise<StoredDocument | null> {
  if (hasSupabaseCredentials()) {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (!error && data) {
        const d = data as any;
        return {
          id: d.id,
          userId: d.user_id,
          name: d.name,
          originalName: d.original_name,
          type: d.type,
          size: Number(d.size),
          pageCount: d.page_count,
          storagePath: d.storage_path,
          mimeType: d.mime_type,
          status: d.status,
          errorMessage: d.error_message,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        };
      }
    } catch (e: any) {
      console.warn('Supabase document query failed:', e.message);
    }
  }

  return memoryStore.documents.get(documentId) || null;
}

export async function saveProductRecord(userId: string, product: Product, documentId: string): Promise<void> {
  if (hasSupabaseCredentials()) {
    try {
      const { error: productError } = await (supabaseAdmin as any).from('products').insert({
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

      if (!productError) {
        await (supabaseAdmin as any).from('product_documents').insert({
          product_id: product.id,
          document_id: documentId,
        });

        if (product.attributes.length > 0) {
          const evidenceRows = product.attributes.flatMap((attr) =>
            attr.evidence.map((e) => ({
              product_id: product.id,
              document_id: e.documentId,
              attribute_key: attr.key,
              page: e.page,
              quote: e.quote,
            }))
          );

          if (evidenceRows.length > 0) {
            await (supabaseAdmin as any).from('evidence').insert(evidenceRows);
          }
        }
        return;
      }
      console.warn('Supabase product insert failed, using memory store:', productError.message);
    } catch (e: any) {
      console.warn('Supabase product insert error:', e.message);
    }
  }

  // Memory store fallback
  memoryStore.products.set(product.id, product);
  memoryStore.productDocuments.push({ productId: product.id, documentId });

  product.attributes.forEach((attr) => {
    attr.evidence.forEach((e) => {
      memoryStore.evidence.push({
        id: `${product.id}-${attr.key}-${e.page}`,
        productId: product.id,
        documentId: e.documentId,
        attributeKey: attr.key,
        page: e.page,
        quote: e.quote,
      });
    });
  });
}

export async function getProductRecord(productId: string): Promise<Product | null> {
  if (hasSupabaseCredentials()) {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (!error && data) {
        const d = data as any;
        return {
          id: d.id,
          name: d.name,
          manufacturer: d.manufacturer,
          model: d.model,
          category: d.category,
          attributes: d.attributes || [],
          completeness: Number(d.completeness || 0),
          confidence: Number(d.confidence || 0),
          conflicts: d.conflicts || [],
          missingAttributes: d.missing_attributes || [],
          documents: d.documents || [],
          commerce: d.commerce || null,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        };
      }
    } catch (e: any) {
      console.warn('Supabase getProduct failed:', e.message);
    }
  }

  return memoryStore.products.get(productId) || null;
}

export async function updateProductRecord(product: Product): Promise<void> {
  if (hasSupabaseCredentials()) {
    try {
      const { error } = await (supabaseAdmin as any)
        .from('products')
        .update({
          name: product.name,
          manufacturer: product.manufacturer,
          model: product.model,
          category: product.category,
          attributes: product.attributes,
          conflicts: product.conflicts,
          missing_attributes: product.missingAttributes,
          completeness: product.completeness,
          confidence: product.confidence,
          commerce: product.commerce,
          updated_at: product.updatedAt,
        })
        .eq('id', product.id);

      if (!error) return;
    } catch (e: any) {
      console.warn('Supabase updateProduct failed:', e.message);
    }
  }

  memoryStore.products.set(product.id, product);
}

export async function listProductsRecords(): Promise<Product[]> {
  if (hasSupabaseCredentials()) {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return (data as any[]).map((d: any) => ({
          id: d.id,
          name: d.name,
          manufacturer: d.manufacturer,
          model: d.model,
          category: d.category,
          attributes: d.attributes || [],
          completeness: Number(d.completeness || 0),
          confidence: Number(d.confidence || 0),
          conflicts: d.conflicts || [],
          missingAttributes: d.missing_attributes || [],
          documents: d.documents || [],
          commerce: d.commerce || null,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    } catch (e: any) {
      console.warn('Supabase listProducts failed:', e.message);
    }
  }

  return Array.from(memoryStore.products.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function listDocumentsRecords(): Promise<StoredDocument[]> {
  if (hasSupabaseCredentials()) {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return (data as any[]).map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          name: d.name,
          originalName: d.original_name,
          type: d.type,
          size: Number(d.size),
          pageCount: d.page_count,
          storagePath: d.storage_path,
          mimeType: d.mime_type,
          status: d.status,
          errorMessage: d.error_message,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    } catch (e: any) {
      console.warn('Supabase listDocuments failed:', e.message);
    }
  }

  return Array.from(memoryStore.documents.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
