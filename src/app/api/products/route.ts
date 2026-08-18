import { NextRequest, NextResponse } from 'next/server';
import { listProductsRecords } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const category = searchParams.get('category');
    const search = searchParams.get('search')?.toLowerCase();

    let products = await listProductsRecords();

    if (category && category !== 'all') {
      products = products.filter((p) => p.category === category);
    }

    if (search) {
      products = products.filter(
        (p) =>
          p.name?.toLowerCase().includes(search) ||
          p.manufacturer?.toLowerCase().includes(search) ||
          p.model?.toLowerCase().includes(search)
      );
    }

    const total = products.length;
    const from = (page - 1) * limit;
    const paginatedProducts = products.slice(from, from + limit);

    return NextResponse.json({
      products: paginatedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('List products error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}