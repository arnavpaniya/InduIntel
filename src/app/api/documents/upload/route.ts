import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import { generateSafeFilename, sanitizeFilename } from '@/lib/pdf';
import { saveDocumentRecord } from '@/lib/db/store';

const ALLOWED_TYPES = ['application/pdf', 'text/csv', 'text/plain'];
const ALLOWED_EXTENSIONS = ['.pdf', '.csv', '.txt'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const userId = user?.id || '00000000-0000-0000-0000-000000000000';

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

    const documentId = uuidv4();
    const safeFilename = generateSafeFilename(file.name);
    const storagePath = `${userId}/${documentId}${extension}`;

    const now = new Date().toISOString();

    const docRecord = {
      id: documentId,
      userId,
      name: safeFilename,
      originalName: sanitizeFilename(file.name),
      type: extension.slice(1) as 'pdf' | 'csv' | 'text',
      size: file.size,
      storagePath,
      mimeType: file.type || 'application/octet-stream',
      status: 'uploaded' as const,
      createdAt: now,
      updatedAt: now,
    };

    // Save using unified database / memory store
    await saveDocumentRecord(docRecord);

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