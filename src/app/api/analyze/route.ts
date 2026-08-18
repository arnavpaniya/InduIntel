import { NextRequest, NextResponse } from 'next/server';
import { getDocumentRecord } from '@/lib/db/store';
import { processDocument, ProcessingContext } from '@/lib/processing';
import { ProductCategory } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId, category, manufacturer, model, textContent } = body;

    if (!documentId && !textContent) {
      return NextResponse.json({ error: 'documentId or textContent is required' }, { status: 400 });
    }

    let buffer: Buffer;
    let context: ProcessingContext;

    if (documentId) {
      const document = await getDocumentRecord(documentId);
      if (!document) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }

      // If text or sample buffer is available
      buffer = Buffer.from(`Product datasheet content for document ${document.originalName}`);
      context = {
        userId: document.userId,
        documentId: document.id,
        documentName: document.originalName,
        documentType: document.type,
        category: category as ProductCategory | undefined,
        manufacturer,
        model,
      };
    } else {
      buffer = Buffer.from(textContent);
      context = {
        userId: '00000000-0000-0000-0000-000000000000',
        documentId: 'doc_manual',
        documentName: 'manual-input.txt',
        documentType: 'text',
        category: category as ProductCategory | undefined,
        manufacturer,
        model,
      };
    }

    const result = await processDocument(buffer, context);

    return NextResponse.json({
      productId: result.product.id,
      stages: result.stages,
      product: result.product,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Analysis failed';

    if (errorMessage.includes('OLLAMA') || errorMessage.includes('Ollama')) {
      return NextResponse.json(
        { error: 'AI Provider Initialization Failed. Please ensure OLLAMA_HOST and OLLAMA_MODEL are configured in .env.local, or set USE_MOCK_AI=true for testing.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Analysis failed: ' + errorMessage }, { status: 500 });
  }
}