import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';
import { debugError, debugLog } from '@/lib/debug';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY not set in environment');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export interface LLMOptions {
  model?: string;
  temperature?: number;
  schema?: Schema;
  systemPrompt?: string;
}

export interface LLMResponse<T = unknown> {
  data: T | null;
  raw: string;
  error: string | null;
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
    systemPrompt = 'You are a precise data extraction assistant. Output only valid JSON.',
  } = options;

  try {
    const generativeModel = genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature,
        ...(schema ? { responseSchema: buildSchema(schema) } : {}),
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
  maxRetries = 1
): Promise<LLMResponse<T>> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await callLLM<T>(prompt, options);

    const isTransient = result.error?.includes('429') ||
      result.error?.includes('network') ||
      result.error?.includes('timeout') ||
      result.error?.includes('ECONNREFUSED');

    if (isTransient && attempt < maxRetries) {
      debugLog('[GEMINI] Transient error, waiting 3s before retry:', result.error);
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }

    if (result.data !== null) {
      return result;
    }

    if (attempt < maxRetries) {
      const retryPrompt = `${prompt}\n\nIMPORTANT: Your previous response was not valid JSON. Output ONLY valid JSON with no extra text, no markdown, no explanation.`;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return { data: null, raw: '', error: 'Max retries exceeded - see logs for underlying errors' };
}