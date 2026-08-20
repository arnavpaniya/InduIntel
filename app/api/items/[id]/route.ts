import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { debugError } from '@/lib/debug';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    
    const { data: item, error } = await supabase
      .from('items')
      .select(`
        *,
        item_descriptions(*),
        item_attributes(*),
        item_specs(*)
      `)
      .eq('id', id)
      .maybeSingle();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    
    return NextResponse.json(item);
  } catch (error) {
    debugError('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}