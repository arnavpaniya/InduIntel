import { NextRequest, NextResponse } from 'next/server';
import { getDocumentRecord, saveProductRecord, getProductRecord } from '@/lib/db/store';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const document = await getDocumentRecord(documentId);
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({
      error: 'No cached demo analysis found for this document. Please process via /api/analyze to generate real AI product intelligence.',
    }, { status: 404 });
  } catch (error) {
    console.error('Demo analyze error:', error);
    return NextResponse.json({ error: 'Demo analysis failed' }, { status: 500 });
  }
}