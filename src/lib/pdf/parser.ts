import { DocumentChunk } from '@/types';
import pdfParse from 'pdf-parse';

export interface ParseResult {
  chunks: DocumentChunk[];
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    info?: any;
  };
}

export interface ParseOptions {
  maxPages?: number;
  maxTextLength?: number;
}

const DEFAULT_MAX_PAGES = 50;
const DEFAULT_MAX_TEXT_LENGTH = 100000;

export async function parsePDF(
  buffer: Buffer,
  documentId: string,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const maxTextLength = options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;

  const pageTexts: { page: number; text: string }[] = [];

  const parsed = await pdfParse(buffer, {
    max: maxPages,
    pagerender: async (pageData: any) => {
      const textContent = await pageData.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      const pageNum = pageData.pageIndex + 1;
      pageTexts.push({ page: pageNum, text: pageText });
      return pageText;
    },
  });

  const chunks: DocumentChunk[] = [];
  let totalTextLength = 0;

  for (const item of pageTexts) {
    if (!item.text) continue;

    if (totalTextLength + item.text.length > maxTextLength) {
      const remaining = maxTextLength - totalTextLength;
      if (remaining > 100) {
        chunks.push({
          documentId,
          page: item.page,
          text: item.text.slice(0, remaining),
          type: 'text',
        });
      }
      break;
    }

    chunks.push({
      documentId,
      page: item.page,
      text: item.text,
      type: 'text',
    });
    totalTextLength += item.text.length;
  }

  return {
    chunks,
    pageCount: parsed.numpages || pageTexts.length || 1,
    metadata: {
      title: parsed.info?.Title || undefined,
      author: parsed.info?.Author || undefined,
      info: parsed.info || {},
    },
  };
}

export function validatePDFBuffer(buffer: Buffer): { valid: boolean; error?: string } {
  if (buffer.length === 0) {
    return { valid: false, error: 'Empty file' };
  }

  if (buffer.length > 50 * 1024 * 1024) {
    return { valid: false, error: 'File exceeds 50MB limit' };
  }

  const header = buffer.slice(0, 5).toString();
  if (header !== '%PDF-') {
    return { valid: false, error: 'Not a valid PDF file' };
  }

  return { valid: true };
}

export function sanitizeFilename(filename: string): string {
  const sanitized = filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 255);

  return sanitized || 'document';
}

export function generateSafeFilename(originalName: string): string {
  const ext = originalName.split('.').pop()?.toLowerCase() || 'pdf';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}.${ext}`;
}