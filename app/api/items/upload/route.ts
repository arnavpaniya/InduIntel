import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { debugError } from '@/lib/debug';

const REQUIRED_COLUMNS = [
  'Mfg_Part_Num',
  'Part_Desc',
  'E1_Brand',
  'Unilog_Brand',
  'DIB_Brand',
  'Part_Manuf',
];

const PLACEHOLDER_VALUES = new Set([
  '-- Unbranded --',
  '-- No Unilog Brand --',
  '-- No DIB Brand --',
]);

function cleanValue(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || PLACEHOLDER_VALUES.has(trimmed)) {
    return null;
  }
  return trimmed;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      return handleFileUpload(request);
    } else if (contentType.includes('application/json')) {
      return handleManualEntry(request);
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
    }
  } catch (error) {
    debugError('Upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleFileUpload(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const source = formData.get('source') as string || 'csv';

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
    return handleCSVUpload(supabase, file);
  } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    return handlePDFUpload(supabase, file);
  } else {
    return NextResponse.json({ error: 'Unsupported file type. Use CSV or PDF.' }, { status: 400 });
  }
}

async function handleCSVUpload(supabase: any, file: File) {
  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    return NextResponse.json({ error: 'CSV must have at least a header row and one data row' }, { status: 400 });
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
  if (missingColumns.length > 0) {
    return NextResponse.json({
      error: `Missing required columns: ${missingColumns.join(', ')}. Expected: ${REQUIRED_COLUMNS.join(', ')}`,
      expectedColumns: REQUIRED_COLUMNS,
      foundColumns: headers,
    }, { status: 400 });
  }

  const batchId = crypto.randomUUID();
  const itemsToInsert: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });

    const mfgPartNum = cleanValue(row.Mfg_Part_Num);
    if (!mfgPartNum) continue;

    itemsToInsert.push({
      mfg_part_num: mfgPartNum,
      part_desc: cleanValue(row.Part_Desc),
      e1_brand: cleanValue(row.E1_Brand),
      unilog_brand: cleanValue(row.Unilog_Brand),
      dib_brand: cleanValue(row.DIB_Brand),
      part_manuf: cleanValue(row.Part_Manuf),
      status: 'raw',
      is_ground_truth: false,
      batch_id: batchId,
    });
  }

  if (itemsToInsert.length === 0) {
    return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 });
  }

  const { data: insertedItems, error } = await supabase
    .from('items')
    .upsert(itemsToInsert, { onConflict: 'mfg_part_num' })
    .select('id, mfg_part_num, created_at');

  if (error) {
    debugError('Insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `Uploaded ${insertedItems?.length || 0} items`,
    count: insertedItems?.length || 0,
    batchId,
    items: insertedItems || [],
  });
}

async function handlePDFUpload(supabase: any, file: File) {
  try {
    const pdfParse = (await import('pdf-parse')) as any;
    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdfParse(buffer);
    
    const extractedText = data.text;
    const parsedItems = parsePDFText(extractedText);

    if (parsedItems.length === 0) {
      return NextResponse.json({ error: 'Could not extract product data from PDF' }, { status: 400 });
    }

    const batchId = crypto.randomUUID();
    const itemsToInsert = parsedItems.map(item => ({
      ...item,
      status: 'raw',
      is_ground_truth: false,
      batch_id: batchId,
    }));

    const { data: insertedItems, error } = await supabase
      .from('items')
      .upsert(itemsToInsert, { onConflict: 'mfg_part_num' })
      .select('id, mfg_part_num, created_at');

    if (error) {
      debugError('PDF insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Extracted and uploaded ${insertedItems?.length || 0} items from PDF`,
      count: insertedItems?.length || 0,
      batchId,
      items: insertedItems || [],
    });
  } catch (error) {
    debugError('PDF parsing error:', error);
    return NextResponse.json({ error: 'Failed to parse PDF. Ensure it contains structured product data.' }, { status: 500 });
  }
}

async function handleManualEntry(request: NextRequest) {
  const body = await request.json();
  const supabase = await createServerSupabaseClient();

  const mfgPartNum = cleanValue(body.mfg_part_num);
  if (!mfgPartNum) {
    return NextResponse.json({ error: 'Mfg_Part_Num is required' }, { status: 400 });
  }

  const item = {
    mfg_part_num: mfgPartNum,
    part_desc: cleanValue(body.part_desc),
    e1_brand: cleanValue(body.e1_brand),
    unilog_brand: cleanValue(body.unilog_brand),
    dib_brand: cleanValue(body.dib_brand),
    part_manuf: cleanValue(body.part_manuf),
    status: 'raw',
    is_ground_truth: false,
    batch_id: crypto.randomUUID(),
  };

  const { data: insertedItem, error } = await supabase
    .from('items')
    .upsert(item, { onConflict: 'mfg_part_num' })
    .select('id, mfg_part_num, created_at')
    .single();

  if (error) {
    debugError('Manual entry error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Product added successfully',
    count: 1,
    batchId: item.batch_id,
    items: [insertedItem],
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result.map(v => v.trim().replace(/^"|"$/g, ''));
}

function parsePDFText(text: string): any[] {
  const items: any[] = [];
  
  const mpnMatches = text.matchAll(/Mfg[_\s]*Part[_\s]*Num[:\s]+([A-Z0-9\-]+)/gi);
  for (const match of mpnMatches) {
    const mfgPartNum = match[1].trim();
    const startIdx = match.index || 0;
    const chunk = text.slice(startIdx, startIdx + 2000);
    
    const partDesc = extractField(chunk, /Part[_\s]*Desc[:\s]+([^\n]+)/i);
    const e1Brand = extractField(chunk, /E1[_\s]*Brand[:\s]+([^\n]+)/i);
    const unilogBrand = extractField(chunk, /Unilog[_\s]*Brand[:\s]+([^\n]+)/i);
    const dibBrand = extractField(chunk, /DIB[_\s]*Brand[:\s]+([^\n]+)/i);
    const partManuf = extractField(chunk, /Part[_\s]*Manuf[:\s]+([^\n]+)/i);

    items.push({
      mfg_part_num: mfgPartNum,
      part_desc: partDesc,
      e1_brand: e1Brand,
      unilog_brand: unilogBrand,
      dib_brand: dibBrand,
      part_manuf: partManuf,
    });
  }

  return items;
}

function extractField(text: string, regex: RegExp): string | null {
  const match = text.match(regex);
  if (match && match[1]) {
    return cleanValue(match[1]);
  }
  return null;
}