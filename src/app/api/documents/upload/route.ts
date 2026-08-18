import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import { generateSafeFilename, sanitizeFilename } from '@/lib/pdf';

const ALLOWED_TYPES = ['application/pdf', 'text/csv', 'text/plain'];
const ALLOWED_EXTENSIONS = ['.pdf', '.csv', '.txt'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 50MB limit' }, { status: 400 });
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: PDF, CSV, TXT' }, { status: 400 });
    }

    const mimeType = file.type;
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json({ error: 'Invalid MIME type' }, { status: 400 });
    }

    const safeFilename = generateSafeFilename(file.name);
    const documentId = uuidv4();
    const storagePath = `${user.id}/${documentId}${extension}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to store document' }, { status: 500 });
    }

    const { error: dbError } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        user_id: user.id,
        name: safeFilename,
        original_name: sanitizeFilename(file.name),
        type: extension.slice(1) as 'pdf' | 'csv' | 'text',
        size: file.size,
        storage_path: storagePath,
        mime_type: mimeType,
        status: 'uploaded',
      });

    if (dbError) {
      console.error('Database insert error:', dbError);
      await supabase.storage.from('documents').remove([storagePath]);
      return NextResponse.json({ error: 'Failed to register document' }, { status: 500 });
    }

    return NextResponse.json({
      documentId,
      name: sanitizeFilename(file.name),
      type: extension.slice(1),
      size: file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}