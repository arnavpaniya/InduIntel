import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { processDocument, ProcessingContext } from '@/lib/processing';
import { ProductCategory } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, category, manufacturer, model } = body;

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

    await adminSupabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    const context: ProcessingContext = {
      userId: user.id,
      documentId: document.id,
      documentName: document.original_name,
      documentType: document.type as 'pdf' | 'csv' | 'text',
      category: category as ProductCategory | undefined,
      manufacturer,
      model,
    };

    const result = await processDocument(buffer, context);

    await adminSupabase
      .from('documents')
      .update({ status: 'completed' })
      .eq('id', documentId);

    return NextResponse.json({
      productId: result.product.id,
      stages: result.stages,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Analysis failed';

    if (errorMessage.includes('OLLAMA') || errorMessage.includes('Ollama')) {
      return NextResponse.json(
        { error: 'AI service unavailable. Please check Ollama connection.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}