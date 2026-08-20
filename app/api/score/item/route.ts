import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreItem } from '@/lib/scoring/compare';

export async function POST(request: NextRequest) {
  try {
    const { item_id, ground_truth_id } = await request.json();
    
    if (!item_id || !ground_truth_id) {
      return NextResponse.json({ error: 'item_id and ground_truth_id required' }, { status: 400 });
    }
    
    const supabase = await createServerSupabaseClient();
    
    // Verify both items exist
    const { data: enrichedItem } = await supabase
      .from('items')
      .select('id, mfg_part_num')
      .eq('id', item_id)
      .maybeSingle();
    
    const { data: gtItem } = await supabase
      .from('items')
      .select('id, mfg_part_num')
      .eq('id', ground_truth_id)
      .eq('is_ground_truth', true)
      .maybeSingle();
    
    if (!enrichedItem) {
      return NextResponse.json({ error: 'Enriched item not found', item_id }, { status: 404 });
    }
    if (!gtItem) {
      return NextResponse.json({ error: 'Ground truth item not found', ground_truth_id }, { status: 404 });
    }
    
    const result = await scoreItem(item_id, ground_truth_id);
    
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Score item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}