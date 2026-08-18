import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createSupabaseAdminClient();

    const { data: products, error: productsError } = await adminSupabase
      .from('products')
      .select('id, completeness, confidence, conflicts, created_at, category')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (productsError) {
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    const { data: documents, error: docsError } = await adminSupabase
      .from('documents')
      .select('id, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (docsError) {
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    const productsAnalyzed = products?.length || 0;
    const avgCompleteness = products && products.length > 0
      ? Math.round(products.reduce((sum, p) => sum + (p.completeness || 0), 0) / products.length)
      : 0;
    const avgConfidence = products && products.length > 0
      ? Math.round(products.reduce((sum, p) => sum + (p.confidence || 0), 0) / products.length)
      : 0;
    const totalConflicts = products?.reduce((sum, p) => sum + (p.conflicts?.length || 0), 0) || 0;
    const verifiedAttributes = products?.reduce((sum, p) => {
      // This would need attributes count - simplified for now
      return sum + 10;
    }, 0) || 0;

    const recentProducts = products?.slice(0, 5).map(p => ({
      id: p.id,
      completeness: p.completeness,
      confidence: p.confidence,
      conflicts: p.conflicts?.length || 0,
      category: p.category,
      createdAt: p.created_at,
    })) || [];

    const conflictQueue = products
      ?.filter(p => p.conflicts && p.conflicts.length > 0)
      .slice(0, 10)
      .map(p => ({
        id: p.id,
        conflictCount: p.conflicts.length,
        severity: p.conflicts.some((c: any) => c.severity === 'HIGH') ? 'HIGH' :
                 p.conflicts.some((c: any) => c.severity === 'MEDIUM') ? 'MEDIUM' : 'LOW',
      })) || [];

    return NextResponse.json({
      productsAnalyzed,
      avgCompleteness,
      avgConfidence,
      verifiedAttributes: verifiedAttributes,
      totalConflicts,
      recentProducts,
      conflictQueue,
      documentsProcessed: documents?.filter(d => d.status === 'completed').length || 0,
      documentsPending: documents?.filter(d => d.status === 'processing').length || 0,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}