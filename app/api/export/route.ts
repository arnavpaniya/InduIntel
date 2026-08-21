import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateCsv, mapToDeliveryFormat, DELIVERY_HEADERS } from '@/lib/export/mapToDeliveryFormat';
import ExcelJS from 'exceljs';
import { debugError } from '@/lib/debug';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const batchId = searchParams.get('batch_id');
    const status = searchParams.get('status');
    const format = searchParams.get('format') || 'csv';
    const limit = parseInt(searchParams.get('limit') || '1000', 10);

    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from('items')
      .select(`
        *,
        item_descriptions(*),
        item_attributes(*),
        item_specs(*)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (batchId) {
      query = query.eq('batch_id', batchId);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['enriched', 'review']);
    }

    const { data: items, error } = await query;

    if (error) {
      debugError('[EXPORT] Supabase query failed:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No enriched items found to export' }, { status: 404 });
    }

    const typedItems = items as any[];

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `induintel-export-${dateStr}`;

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Export');

      worksheet.columns = DELIVERY_HEADERS.map(header => ({
        header,
        key: header,
        width: Math.min(Math.max(header.length + 2, 15), 50),
      }));

      for (const item of typedItems) {
        const rowData = mapToDeliveryFormat(item);
        worksheet.addRow(rowData);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        },
      });
    }

    const csv = generateCsv(typedItems);
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error) {
    debugError('Export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}