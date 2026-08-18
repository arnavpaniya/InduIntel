import { NextRequest, NextResponse } from 'next/server';
import { getProductRecord } from '@/lib/db/store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await getProductRecord(id);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const allEvidence = product.attributes.flatMap((attr) =>
      attr.evidence.map((e) => ({
        ...e,
        attributeKey: attr.key,
        attributeLabel: attr.label,
        status: attr.status,
        confidence: attr.confidence,
      }))
    );

    return NextResponse.json(allEvidence);
  } catch (error) {
    console.error('Get evidence error:', error);
    return NextResponse.json({ error: 'Failed to fetch evidence' }, { status: 500 });
  }
}