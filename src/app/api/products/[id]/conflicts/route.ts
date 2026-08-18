import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

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
    const adminSupabase = createSupabaseAdminClient();

    const { data: product, error: productError } = await adminSupabase
      .from('products')
      .select('conflicts')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product.conflicts || []);
  } catch (error) {
    console.error('Get conflicts error:', error);
    return NextResponse.json({ error: 'Failed to fetch conflicts' }, { status: 500 });
  }
}