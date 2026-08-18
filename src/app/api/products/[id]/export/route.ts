import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { exportToJSON, exportToCSV, exportCommerceToJSON, exportCommerceToCSV } from '@/lib/export';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') as 'json' | 'csv' || 'json';
    const includeEvidence = searchParams.get('evidence') === 'true';
    const includeConflicts = searchParams.get('conflicts') === 'true';
    const type = searchParams.get('type') || 'product';

    const adminSupabase = createSupabaseAdminClient();

    const { data: product, error: productError } = await adminSupabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (productError || !product) {
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
      if (format === 'csv') {
        result = exportToCSV(product as any, { includeEvidence, includeConflicts });
      } else {
        result = exportToJSON(product as any, { includeEvidence, includeConflicts });
      }
    }

    const { error: exportError } = await adminSupabase
      .from('exports')
      .insert({
        user_id: user.id,
        product_id: id,
        format,
        status: 'completed',
      });

    if (exportError) {
      console.error('Export log error:', exportError);
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