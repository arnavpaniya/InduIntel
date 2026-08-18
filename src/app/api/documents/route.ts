import { NextRequest, NextResponse } from 'next/server';
import { listDocumentsRecords } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const documents = await listDocumentsRecords();
    const total = documents.length;
    const from = (page - 1) * limit;
    const paginatedDocs = documents.slice(from, from + limit);

    return NextResponse.json({
      documents: paginatedDocs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('List documents error:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}