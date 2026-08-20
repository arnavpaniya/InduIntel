import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreBatchItems } from '@/lib/scoring/batch';
import { debugError } from '@/lib/debug';

export async function POST(request: NextRequest) {
  try {
    const { limit = 10 } = await request.json();
    const supabase = await createServerSupabaseClient();
    const { summary, results } = await scoreBatchItems(supabase, limit);

    return NextResponse.json({ success: true, summary, results });
  } catch (error) {
    debugError('Batch score error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
