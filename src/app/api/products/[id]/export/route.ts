import { NextRequest, NextResponse } from 'next/server';
import { getProductRecord } from '@/lib/db/store';
import { exportToJSON, exportToCSV, exportCommerceToJSON, exportCommerceToCSV } from '@/lib/export';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') as 'json' | 'csv') || 'json';
    const includeEvidence = searchParams.get('evidence') === 'true';
    const includeConflicts = searchParams.get('conflicts') === 'true';
    const type = searchParams.get('type') || 'product';

    const product = await getProductRecord(id);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    let result;
    if (type === 'commerce' && product.commerce) {
      if (format === 'csv') {
        result = exportCommerceToCSV(product.commerce, id);
      } else {
        result = exportCommerceToJSON(product.commerce, id);
      }
    } else {
      const options = { format, includeEvidence, includeConflicts };
      if (format === 'csv') {
        result = exportToCSV(product, options);
      } else {
        result = exportToJSON(product, options);
      }
    }

    return new NextResponse(result.content, {
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}