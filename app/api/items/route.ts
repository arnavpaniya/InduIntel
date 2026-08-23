import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { debugError } from '@/lib/debug';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function emptyItemsResponse(page: number, limit: number) {
  return NextResponse.json({
    items: [],
    pagination: {
      page,
      limit,
      total: 0,
      totalPages: 0,
    },
  });
}

function formatError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const batchId = searchParams.get('batch');

    if (batchId && !UUID_RE.test(batchId)) {
      return emptyItemsResponse(page, limit);
    }
    
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    let query = supabase
      .from('items')
      .select('id, mfg_part_num, part_desc, status, manufacturer_name, brand_name, classpath, confidence_score, field_confidence, created_at, batch_id', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (search) {
      query = query.or(`mfg_part_num.ilike.%${search}%,part_desc.ilike.%${search}%,manufacturer_name.ilike.%${search}%`);
    }
    
    if (batchId) {
      query = query.eq('batch_id', batchId);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      debugError('[ITEMS] Supabase query failed:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        batchId,
        page,
        limit,
        status,
        search,
      });
      if (batchId) {
        return emptyItemsResponse(page, limit);
      }
      return NextResponse.json({ error: error.message, code: error.code, details: error.details }, { status: 500 });
    }
    
    // Per-status counts from the DATABASE (BUG 8: never derived from the
    // current page — these must match reality even when filtered/paginated).
    let statusCounts: Record<string, number> | undefined;
    try {
      const { count: rawC } = await supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'raw');
      const { count: enrC } = await supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'enriching');
      const { count: doneC } = await supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'enriched');
      const { count: revC } = await supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'review');
      const { count: failC } = await supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'failed');
      statusCounts = {
        raw: rawC ?? 0,
        enriching: enrC ?? 0,
        enriched: doneC ?? 0,
        review: revC ?? 0,
        failed: failC ?? 0,
      };
    } catch {
      statusCounts = undefined; // unavailable — frontend falls back to page-derived
    }

    return NextResponse.json({
      items: data || [],
      statusCounts,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const batchId = searchParams.get('batch');

    debugError('[ITEMS] API exception:', {
      error: formatError(error),
      batchId,
      page,
      limit,
    });

    if (batchId) {
      return emptyItemsResponse(page, limit);
    }

    return NextResponse.json({ error: formatError(error) }, { status: 500 });
  }
}
