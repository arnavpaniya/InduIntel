import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';
import { debugError, debugLog } from '@/lib/debug';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export interface LLMOptions {
  model?: string;
  temperature?: number;
  schema?: Schema;
  responseSchema?: Schema;
  systemPrompt?: string;
}

export interface LLMResponse<T = unknown> {
  data: T | null;
  raw: string;
  error: string | null;
  attempts?: number;
}

function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

function buildSchema(schema: Schema): Schema {
  return schema;
}

export async function callLLM<T = unknown>(
  prompt: string,
  options: LLMOptions = {}
): Promise<LLMResponse<T>> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.1,
    schema,
    responseSchema,
    systemPrompt = 'You are a precise data extraction assistant. Output only valid JSON.',
  } = options;
  const effectiveSchema = responseSchema || schema;

  try {
    if (!genAI) {
      throw new Error('GEMINI_API_KEY not set in environment');
    }

    const generativeModel = genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature,
        ...(effectiveSchema ? { responseSchema: buildSchema(effectiveSchema) } : {}),
      },
    });

    const result = await generativeModel.generateContent(prompt);
    const response = result.response;
    const rawText = response.text();
    const cleaned = stripMarkdownFences(rawText);

    try {
      const parsed = JSON.parse(cleaned) as T;
      return { data: parsed, raw: cleaned, error: null };
    } catch (parseError) {
      debugError('[GEMINI] JSON parse failed, raw response:', rawText);
      return {
        data: null,
        raw: cleaned,
        error: `JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      };
    }
  } catch (error) {
    const err = error as Error & { status?: number; response?: { body?: string } };
    debugError('[GEMINI] API error:', {
      message: err.message,
      status: err.status,
      body: err.response?.body,
    });
    return {
      data: null,
      raw: '',
      error: `Gemini API error: ${err.message}${err.status ? ` (status ${err.status})` : ''}${err.response?.body ? ` - ${err.response.body}` : ''}`,
    };
  }
}

export async function callLLMWithRetry<T = unknown>(
  prompt: string,
  options: LLMOptions = {},
  maxRetries = 2,
  onAttempt?: () => Promise<void>,
  _callFn: typeof callLLM = callLLM
): Promise<LLMResponse<T>> {
  let currentPrompt = prompt;
  let lastError = 'Max retries exceeded';
  let lastRaw = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (onAttempt) {
      await onAttempt();
    }
    const result = await _callFn<T>(currentPrompt, options);

    if (result.data !== null) {
      return { ...result, attempts: attempt + 1 };
    }

    lastError = result.error || 'Unknown error';
    lastRaw = result.raw;

    const isTransient = lastError.includes('429') ||
      lastError.includes('500') ||
      lastError.includes('502') ||
      lastError.includes('503') ||
      lastError.includes('504') ||
      lastError.includes('network') ||
      lastError.includes('timeout') ||
      lastError.includes('ECONNREFUSED');

    if (attempt < maxRetries) {
      if (isTransient) {
        const delay = 1000 * Math.pow(2, attempt);
        debugLog(`[GEMINI] Transient error, waiting ${delay}ms before retry:`, lastError);
        await new Promise(r => setTimeout(r, delay));
        continue;
      } else if (lastError.includes('JSON parse error')) {
        currentPrompt = `${prompt}\n\nIMPORTANT: Your previous response was not valid JSON. Output ONLY valid JSON with no extra text, no markdown, no explanation.\n\nPrevious invalid response:\n${lastRaw}`;
        debugLog(`[GEMINI] JSON error, retrying immediately.`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      } else {
        // Fatal error, don't retry (e.g. 401, 403, 400)
        break;
      }
    }
  }
  return { data: null, raw: lastRaw, error: lastError, attempts: maxRetries + 1 };
}
