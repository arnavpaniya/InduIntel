import { DocumentChunk } from '@/types';
import { parse } from 'csv-parse/sync';

export interface CSVParseResult {
  chunks: DocumentChunk[];
  rowCount: number;
  headers: string[];
}

export interface CSVParseOptions {
  maxRows?: number;
  maxTextLength?: number;
}

const DEFAULT_MAX_ROWS = 10000;
const DEFAULT_MAX_TEXT_LENGTH = 100000;

const FORMULA_PREFIXES = ['=', '+', '-', '@'];

export function sanitizeCSVValue(value: string): string {
  if (!value) return value;

  const trimmed = value.trim();
  if (FORMULA_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return `'${trimmed}`;
  }
  return trimmed;
}

export function parseCSV(
  buffer: Buffer,
  documentId: string,
  options: CSVParseOptions = {}
): CSVParseResult {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const maxTextLength = options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;

  const text = buffer.toString('utf-8');

  if (text.length > maxTextLength) {
    throw new Error(`CSV content exceeds maximum length of ${maxTextLength} characters`);
  }

  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    to: maxRows,
  });

  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  const chunks: DocumentChunk[] = [];
  let totalTextLength = 0;

  records.forEach((record: Record<string, string>, index: number) => {
    const rowText = headers
      .map((h) => `${h}: ${sanitizeCSVValue(record[h] || '')}`)
      .join(', ');

    if (totalTextLength + rowText.length > maxTextLength) {
      return;
    }

    chunks.push({
      documentId,
      page: Math.floor(index / 50) + 1,
      text: rowText,
      type: 'table',
    });

    totalTextLength += rowText.length;
  });

  return {
    chunks,
    rowCount: records.length,
    headers,
  };
}

export function validateCSVBuffer(buffer: Buffer): { valid: boolean; error?: string } {
  if (buffer.length === 0) {
    return { valid: false, error: 'Empty file' };
  }

  if (buffer.length > 10 * 1024 * 1024) {
    return { valid: false, error: 'File exceeds 10MB limit' };
  }

  try {
    const text = buffer.toString('utf-8');
    if (text.trim().length === 0) {
      return { valid: false, error: 'Empty CSV content' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid CSV encoding' };
  }
}