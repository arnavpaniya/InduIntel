import { NextRequest, NextResponse } from 'next/server';
import { listProductsRecords, listDocumentsRecords } from '@/lib/db/store';
import { Product } from '@/types';

export async function GET(_request: NextRequest) {
  try {
    const products: Product[] = await listProductsRecords();
    const documents = await listDocumentsRecords();

    const productsAnalyzed = products.length;
    const avgCompleteness = products.length > 0
      ? Math.round(products.reduce((sum, p) => sum + (p.completeness || 0), 0) / products.length)
      : 0;
    const avgConfidence = products.length > 0
      ? Math.round(products.reduce((sum, p) => sum + (p.confidence || 0), 0) / products.length)
      : 0;
    const totalConflicts = products.reduce((sum, p) => sum + (p.conflicts?.length || 0), 0);
    const verifiedAttributes = products.reduce((sum, p) => {
      const verifiedCount = (p.attributes || []).filter((a) => a.status === 'VERIFIED').length;
      return sum + verifiedCount;
    }, 0);

    const recentProducts = products.slice(0, 5).map((p) => ({
      id: p.id,
      name: p.name,
      manufacturer: p.manufacturer,
      model: p.model,
      completeness: p.completeness,
      confidence: p.confidence,
      conflicts: p.conflicts?.length || 0,
      category: p.category,
      createdAt: p.createdAt,
    }));

    const conflictQueue = products
      .filter((p) => p.conflicts && p.conflicts.length > 0)
      .slice(0, 10)
      .map((p) => ({
        id: p.id,
        name: p.name || `${p.manufacturer || ''} ${p.model || ''}`.trim() || 'Product',
        conflictCount: p.conflicts.length,
        severity: p.conflicts.some((c) => c.severity === 'HIGH')
          ? 'HIGH'
          : p.conflicts.some((c) => c.severity === 'MEDIUM')
          ? 'MEDIUM'
          : 'LOW',
      }));

    return NextResponse.json({
      productsAnalyzed,
      avgCompleteness,
      avgConfidence,
      verifiedAttributes,
      totalConflicts,
      recentProducts,
      conflictQueue,
      documentsProcessed: documents.filter((d) => d.status === 'completed' || d.status === 'uploaded').length,
      documentsPending: documents.filter((d) => d.status === 'processing').length,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}