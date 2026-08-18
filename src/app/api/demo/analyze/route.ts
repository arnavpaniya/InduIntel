import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const adminSupabase = createSupabaseAdminClient();

    const { data: document, error: docError } = await adminSupabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const { data: fileData, error: downloadError } = await adminSupabase.storage
      .from('documents')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Failed to download document' }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    const { data: cached, error: cacheError } = await adminSupabase
      .from('demo_cache')
      .select('product_data')
      .eq('document_hash', hash)
      .single();

    if (!cacheError && cached) {
      const productData = cached.product_data as any;
      const productId = uuidv4();
      const now = new Date().toISOString();

      const product = {
        ...productData,
        id: productId,
        user_id: user.id,
        created_at: now,
        updated_at: now,
      };

      const { error: insertError } = await adminSupabase
        .from('products')
        .insert(product);

      if (insertError) throw insertError;

      const { error: linkError } = await adminSupabase
        .from('product_documents')
        .insert({
          product_id: productId,
          document_id: documentId,
        });

      if (linkError) throw linkError;

      await adminSupabase
        .from('documents')
        .update({ status: 'completed' })
        .eq('id', documentId);

      return NextResponse.json({
        productId,
        stages: [
          { stage: 'Upload', status: 'completed', message: 'Document uploaded' },
          { stage: 'Reading', status: 'completed', message: 'Document loaded from cache' },
          { stage: 'Understanding', status: 'completed', message: 'Analysis retrieved from cache' },
          { stage: 'Validating', status: 'completed', message: 'Validation retrieved from cache' },
          { stage: 'Ready', status: 'completed', message: 'Product intelligence ready (demo mode)' },
        ],
        demoMode: true,
      });
    }

    return NextResponse.json({ error: 'No cached analysis available for this document' }, { status: 404 });
  } catch (error) {
    console.error('Demo analyze error:', error);
    return NextResponse.json({ error: 'Demo analysis failed' }, { status: 500 });
  }
}