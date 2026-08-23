import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { transformItemToInternal } from '@/lib/unihack/transform-item';
import { productToRow, emptyRow, type InternalProductFields, UNIHACK_HEADERS } from '@/lib/unihack/output-mapper';
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
        item_specs(*),
        item_assets(*)
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
      debugError('[EXPORT] Supabase query failed:', error);
      return NextResponse.json({ error: 'Export failed, please try again' }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No enriched items found to export' }, { status: 404 });
    }

    // Transform each item into the internal canonical format
    const typedItems = items as any[];
    const internalItems: InternalProductFields[] = [];
    const rows: string[][] = [];

    for (const item of typedItems) {
      const descriptions = item.item_descriptions || [];
      const attributes = item.item_attributes || [];
      const specs = item.item_specs ? item.item_specs[0] : null;
      const assets = item.item_assets || [];

      const internal = transformItemToInternal(item, descriptions, attributes, specs, assets);
      internalItems.push(internal);

      // Convert to UniHack 252-column row
      const row = productToRow(internal);
      rows.push(row);
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `induintel-export-${dateStr}`;

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Export');

      // Use the canonical UniHack headers as column definitions
      worksheet.columns = UNIHACK_HEADERS.map(header => ({
        header,
        key: header,
        width: Math.min(Math.max(header.length + 2, 15), 50),
      }));

      for (const row of rows) {
        worksheet.addRow(row);
      }

      const buffer = await workbook.xlsx.writeBuffer();

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        },
      });
    }

    // CSV format: use the canonical UniHack headers.
    // Values are RFC4180-escaped so commas, quotes, newlines and carriage
    // returns inside product data can never produce malformed rows.
    const escapeCsv = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
        return '"' + value.replace(/"/g, '""') + '"';
      }
      return value;
    };
    const csvHeader = UNIHACK_HEADERS.map((h) => escapeCsv(h)).join(',');
    const csvData = [csvHeader, ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');

    return new NextResponse(csvData, {
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