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

class MemoryStore {
  products: Map<string, Product> = new Map();
  documents: Map<string, StoredDocument> = new Map();
  buffers: Map<string, Buffer> = new Map();
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

export async function saveDocumentBuffer(documentId: string, buffer: Buffer): Promise<void> {
  memoryStore.buffers.set(documentId, buffer);
}

export async function getDocumentBuffer(documentId: string): Promise<Buffer | null> {
  return memoryStore.buffers.get(documentId) || null;
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
      const { error: prodErr } = await (supabaseAdmin as any).from('products').insert({
        id: product.id,
        user_id: userId,
        name: product.name,
        manufacturer: product.manufacturer,
        model: product.model,
        category: product.category,
        completeness: product.completeness,
        confidence: product.confidence,
        missing_attributes: product.missingAttributes,
        commerce: product.commerce,
        created_at: product.createdAt,
        updated_at: product.updatedAt,
      });

      if (!prodErr) {
        await (supabaseAdmin as any).from('product_documents').insert({
          product_id: product.id,
          document_id: documentId,
        });

        for (const attr of product.attributes) {
          for (const ev of attr.evidence) {
            await (supabaseAdmin as any).from('attribute_evidence').insert({
              product_id: product.id,
              document_id: ev.documentId,
              attribute_key: attr.key,
              page: ev.page,
              quote: ev.quote,
            });
          }
        }
        return;
      }
      console.warn('Supabase product save failed, saving to memory store:', prodErr.message);
    } catch (e: any) {
      console.warn('Supabase product save error:', e.message);
    }
  }

  memoryStore.products.set(product.id, product);
  memoryStore.productDocuments.push({ productId: product.id, documentId });
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
        const p = data as any;
        return {
          id: p.id,
          name: p.name,
          manufacturer: p.manufacturer,
          model: p.model,
          category: p.category,
          attributes: [],
          completeness: p.completeness,
          confidence: p.confidence,
          conflicts: [],
          missingAttributes: p.missing_attributes || [],
          documents: [],
          commerce: p.commerce,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        };
      }
    } catch (e: any) {
      console.warn('Supabase product query failed:', e.message);
    }
  }

  return memoryStore.products.get(productId) || null;
}

export async function getAllProducts(): Promise<Product[]> {
  if (hasSupabaseCredentials()) {
    try {
      const { data, error } = await (supabaseAdmin as any).from('products').select('*');
      if (!error && Array.isArray(data)) {
        return data.map((p: any) => ({
          id: p.id,
          name: p.name,
          manufacturer: p.manufacturer,
          model: p.model,
          category: p.category,
          attributes: [],
          completeness: p.completeness,
          confidence: p.confidence,
          conflicts: [],
          missingAttributes: p.missing_attributes || [],
          documents: [],
          commerce: p.commerce,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        }));
      }
    } catch (e: any) {
      console.warn('Supabase query all products failed:', e.message);
    }
  }

  return Array.from(memoryStore.products.values());
}

export async function getAllDocuments(): Promise<StoredDocument[]> {
  if (hasSupabaseCredentials()) {
    try {
      const { data, error } = await (supabaseAdmin as any).from('documents').select('*');
      if (!error && Array.isArray(data)) {
        return data.map((d: any) => ({
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
      console.warn('Supabase query all documents failed:', e.message);
    }
  }

  return Array.from(memoryStore.documents.values());
}

export const listProductsRecords = getAllProducts;
export const listDocumentsRecords = getAllDocuments;

export async function updateProductRecord(product: Product): Promise<void> {
  if (hasSupabaseCredentials()) {
    try {
      await (supabaseAdmin as any)
        .from('products')
        .update({
          name: product.name,
          manufacturer: product.manufacturer,
          model: product.model,
          category: product.category,
          completeness: product.completeness,
          confidence: product.confidence,
          missing_attributes: product.missingAttributes,
          commerce: product.commerce,
          updated_at: product.updatedAt,
        })
        .eq('id', product.id);
    } catch (e: any) {
      console.warn('Supabase update product error:', e.message);
    }
  }

  memoryStore.products.set(product.id, product);
}
