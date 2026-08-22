import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { callLLMWithRetry } from '@/lib/ai/gemini';
import { isDeterministicSufficient } from '@/lib/ai/external-retrieval';
import { detectMissingFields } from '@/lib/product-intelligence/missing-fields';

interface ExternalEvidenceRequest {
  item_id: string;
  manufacturer: string | null;
  mpn: string | null;
  brand: string | null;
  categoryContext?: {
    dept?: string | null;
    class?: string | null;
    fine?: string | null;
    classpath?: string | null;
  };
  missingFields: string[];
}

interface ExternalEvidenceResponse {
  success: boolean;
  evidence: Record<string, any>;
  deterministicExtracted: Record<string, any>;
  geminiRequired: boolean;
  geminiPrompt: string | null;
  confidence?: number;
  reasoning?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, manufacturer, mpn, brand, categoryContext, missingFields } =
      body as ExternalEvidenceRequest;

    if (!item_id) {
      return NextResponse.json(
        { success: false, error: 'item_id required' },
        { status: 400 }
      );
    }

    // 1. Validate missing fields
    const validatedMissing = detectMissingFields({
      mfg_part_num: null,
      manufacturer_name: manufacturer,
      brand_name: brand,
      part_desc: '',
      dept: categoryContext?.dept,
      class: categoryContext?.class,
      fine: categoryContext?.fine,
      classpath: categoryContext?.classpath,
    });

    // 2. Check if deterministic extraction would suffice
    const deterministicSufficient = isDeterministicSufficient(
      { upc: null, ean: null, gtin: null, weight: null, warranty: null },
      missingFields
    );

    let geminiRequired = false;
    let geminiPrompt: string | null = null;
    let confidence: number | undefined;
    let evidence: Record<string, any> = {};
    let reasoning: string | undefined;

    if (!deterministicSufficient) {
      geminiRequired = true;

      // Build Gemini prompt - use String() to convert, then cast
      const mfr = String(manufacturer || 'not provided');
      const mpnVal = String(mpn != null ? mpn : 'not provided');
      const brandVal = String(brand != null ? brand : 'not provided');
      const catPath = categoryContext?.classpath != null ? String(categoryContext.classpath) : 'not provided';

      geminiPrompt =
        'Extract structured product evidence.\n\n' +
        'Product identity:\n' +
        '- Manufacturer: ' + String(mfr) + '\n' +
        '- MPN: ' + String(mpnVal) + '\n' +
        '- Brand: ' + String(brandVal) + '\n' +
        '- Category: ' + String(catPath) + '\n\n' +
        'Missing fields: ' + missingFields.join(', ') + '\n\n' +
        'Return JSON only with: upc, ean, gtin, weight (value+uom), warranty, dimensions (array {value,uom}), mpn, title, manufacturer.\n' +
        'Each value must be supported by evidence. Return null for unsupported fields.\n' +
        'Return confidence (0.0-1.0) and reasoning.\n' +
        'JSON only.';

      geminiRequired = true;
      evidence = {
        upc: null, ean: null, gtin: null,
        weight: null, warranty: null,
        dimensions: null, mpn: null, title: null, manufacturer: null
      };
      confidence = 0.5;
      reasoning = 'Gemini extraction required - evidence not yet retrieved';
    } else {
      evidence = {};
      confidence = 0.9;
      reasoning = 'Deterministic extraction sufficient';
    }

    return NextResponse.json({
      success: true,
      evidence,
      deterministicExtracted: {},
      geminiRequired,
      geminiPrompt: geminiPrompt || null,
      confidence,
      reasoning,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'External evidence enrichment error' },
      { status: 500 }
    );
  }
}
