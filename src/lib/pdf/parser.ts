import { DocumentChunk } from '@/types';
import * as pdfjsLib from 'pdfjs-dist';
import { createCanvas } from 'canvas';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ParseResult {
  chunks: DocumentChunk[];
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
  };
}

export interface ParseOptions {
  maxPages?: number;
  maxTextLength?: number;
  includeImages?: boolean;
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

  const data = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const pageCount = Math.min(pdf.numPages, maxPages);
  const chunks: DocumentChunk[] = [];
  let totalTextLength = 0;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);

    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (pageText.length > 0) {
      if (totalTextLength + pageText.length > maxTextLength) {
        const remaining = maxTextLength - totalTextLength;
        if (remaining > 100) {
          chunks.push({
            documentId,
            page: pageNum,
            text: pageText.slice(0, remaining),
            type: 'text',
          });
        }
        break;
      }

      chunks.push({
        documentId,
        page: pageNum,
        text: pageText,
        type: 'text',
      });
      totalTextLength += pageText.length;
    }

    if (options.includeImages) {
      try {
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        chunks.push({
          documentId,
          page: pageNum,
          text: '',
          type: 'image',
        });
      } catch {
        // Ignore image rendering errors
      }
    }
  }

  const metadata = await pdf.getMetadata().catch(() => ({ info: {} }));

  return {
    chunks,
    pageCount: pdf.numPages,
    metadata: metadata.info || {},
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