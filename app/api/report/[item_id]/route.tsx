import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreItem as computeGroundTruthScore } from '@/lib/scoring/compare';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import React from 'react';
import { renderToStream } from '@react-pdf/renderer';

export const dynamic = 'force-dynamic';

const brandBlue = '#0ea5e9';
const darkGray = '#1e293b';
const midGray = '#64748b';
const lightGray = '#f1f5f9';
const white = '#ffffff';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    padding: 48,
    backgroundColor: white,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: darkGray,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: lightGray,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: brandBlue,
  },
  tagline: {
    fontSize: 9,
    color: midGray,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dateText: {
    fontSize: 9,
    color: midGray,
    textAlign: 'right',
    marginTop: 4,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: darkGray,
    marginBottom: 4,
  },
  mpnSubtitle: {
    fontSize: 11,
    color: midGray,
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: brandBlue,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: brandBlue,
    paddingBottom: 4,
  },
  rawBox: {
    backgroundColor: lightGray,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
  },
  rawLabel: {
    fontSize: 9,
    color: midGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  rawText: {
    fontSize: 10,
    color: darkGray,
    lineHeight: 1.5,
  },
  noteText: {
    fontSize: 9,
    color: midGray,
    fontStyle: 'italic',
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: lightGray,
  },
  detailLabel: {
    width: 140,
    fontSize: 10,
    color: midGray,
    fontWeight: 'bold',
  },
  detailValue: {
    flex: 1,
    fontSize: 10,
    color: darkGray,
  },
  confidenceContainer: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 8,
  },
  confidenceBox: {
    flex: 1,
    backgroundColor: lightGray,
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
  },
  confidenceValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: brandBlue,
  },
  confidenceLabel: {
    fontSize: 9,
    color: midGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    textAlign: 'center',
  },
  confidenceExplanation: {
    fontSize: 8,
    color: midGray,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 1.4,
  },
  reviewBox: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 4,
    padding: 12,
    marginTop: 12,
  },
  reviewText: {
    fontSize: 9,
    color: '#92400e',
    lineHeight: 1.5,
  },
  descriptionBox: {
    backgroundColor: lightGray,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  descriptionLabel: {
    fontSize: 9,
    color: midGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  descriptionText: {
    fontSize: 9,
    color: darkGray,
    lineHeight: 1.5,
  },
  gtTable: {
    width: '100%',
    marginTop: 8,
  },
  gtRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: lightGray,
  },
  gtHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    backgroundColor: lightGray,
    borderBottomWidth: 1,
    borderBottomColor: brandBlue,
  },
  gtCell: {
    flex: 1,
    fontSize: 9,
    color: darkGray,
    paddingHorizontal: 8,
  },
  gtHeaderCell: {
    flex: 1,
    fontSize: 9,
    color: brandBlue,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 8,
  },
  footer: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: lightGray,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: midGray,
  },
  pageNumber: {
    fontSize: 8,
    color: midGray,
  },
  emptyState: {
    fontSize: 9,
    color: midGray,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  attributesList: {
    flexDirection: 'column',
    gap: 4,
  },
  attributeItem: {
    flexDirection: 'row',
    gap: 8,
  },
  attributeLabel: {
    fontWeight: 'bold',
    fontSize: 9,
    color: darkGray,
    minWidth: 100,
  },
  attributeValue: {
    fontSize: 9,
    color: midGray,
  },
});


function StatusBanner({ status, failedStep, failedError }: { status: string; failedStep?: string | null; failedError?: string | null }) {
  const map: Record<string, { bg: string; border: string; title: string; text: string }> = {
    raw:       { bg: '#f1f5f9', border: '#cbd5e1', title: 'Not cleaned yet',
                 text: 'This product has not been cleaned yet.' },
    enriching: { bg: '#e0f2fe', border: '#7dd3fc', title: 'Currently cleaning',
                 text: 'AI cleaning is currently in progress.' },
    failed:    { bg: '#fee2e2', border: '#fca5a5', title: `Cleaning failed${failedStep ? ` at ${failedStep.replace(/_/g, ' ')}` : ''}`,
                 text: failedError ?? `AI cleaning failed during ${failedStep ?? 'the pipeline'}. No further enrichment steps were completed after the failure.` },
    review:    { bg: '#fef3c7', border: '#fcd34d', title: 'Partial enrichment — review required',
                 text: 'This product was enriched but requires a human review.' },
    enriched:  { bg: '#dcfce7', border: '#86efac', title: 'Enrichment completed successfully',
                 text: 'This product was successfully enriched by the AI pipeline.' },
  };
  const cfg = map[status] ?? map.raw;
  return (
    <View style={[styles.section, { backgroundColor: cfg.bg, borderWidth: 1, borderColor: cfg.border, borderRadius: 4, padding: 12 }]}>
      <Text style={{ fontSize: 11, fontWeight: 'bold', color: darkGray }}>{cfg.title}</Text>
      <Text style={{ fontSize: 9, color: midGray, marginTop: 3 }}>{cfg.text}</Text>
      <Text style={{ fontSize: 8, color: midGray, marginTop: 4 }}>Lifecycle status: {status}</Text>
    </View>
  );
}

function SpecsSection({ spec }: { spec: any | null }) {
  if (!spec) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Specifications & Identifiers</Text>
        <Text style={styles.emptyState}>No specifications were extracted.</Text>
      </View>
    );
  }
  const row = (label: string, value: any, fmt?: (v: any) => string) => (
    <View key={label} style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>
        {value === null || value === undefined || value === '' ? 'Not available' : fmt ? fmt(value) : String(value)}
      </Text>
    </View>
  );
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Specifications & Identifiers</Text>
      {row('UPC barcode', spec.upc)}
      {row('EAN', spec.ean)}
      {row('GTIN', spec.gtin)}
      {row('UNSPSC', spec.unspsc)}
      {row('List price', spec.list_price, (v) => `$${v}`)}
      {row('Dimensions (L×W×H)', [spec.length, spec.width, spec.height].every((v) => v == null)
        ? null
        : `${spec.length ?? '—'} × ${spec.width ?? '—'} × ${spec.height ?? '—'} ${spec.length_uom ?? ''}`)}
      {row('Weight', spec.weight, (v) => `${v} ${spec.weight_uom ?? ''}`.trim())}
      {row('Country of origin', spec.country_of_origin)}
      {row('Warranty', spec.warranty)}
    </View>
  );
}

function RawInputSection({ partDesc }: { partDesc: string | null }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>What We Started With</Text>
      <View style={styles.rawBox}>
        <Text style={styles.rawLabel}>Original text from supplier</Text>
        <Text style={styles.rawText}>{partDesc || 'No description provided'}</Text>
      </View>
      <Text style={styles.noteText}>This is what our system had to work with.</Text>
    </View>
  );
}

function IdentitySection({ manufacturerName, brandName, classpath }: { 
  manufacturerName: string | null; 
  brandName: string | null; 
  classpath: string | null;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>What We Found Out</Text>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Manufacturer</Text>
        <Text style={styles.detailValue}>{manufacturerName || 'Not determined'}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Brand</Text>
        <Text style={styles.detailValue}>{brandName || 'Not determined'}</Text>
      </View>
      {classpath && (
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Category</Text>
          <Text style={styles.detailValue}>{classpath}</Text>
        </View>
      )}
    </View>
  );
}

function AttributesSection({ attributes }: { attributes: Array<{ label: string | null; value: string | null; uom: string | null }> }) {
  const validAttrs = attributes.filter(a => a.label && a.value);
  
  if (validAttrs.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What We Found Out</Text>
        <Text style={styles.emptyState}>Not enough information was available for product details.</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>What We Found Out</Text>
      <View style={styles.attributesList}>
        {validAttrs.slice(0, 15).map((attr, index) => (
          <View key={index} style={styles.attributeItem}>
            <Text style={styles.attributeLabel}>{attr.label}:</Text>
            <Text style={styles.attributeValue}>{attr.value} {attr.uom || ''}</Text>
          </View>
        ))}
        {validAttrs.length > 15 && (
          <Text style={styles.emptyState}>+ {validAttrs.length - 15} more attributes</Text>
        )}
      </View>
    </View>
  );
}

function DescriptionsSection({ descriptions }: { descriptions: Array<{ fieldName: string; value: string; charCount: number }> }) {
  const descLabels: Record<string, string> = {
    invoice_desc: 'Receipt text',
    mobile_desc: 'Mobile app text',
    short_desc: 'Product title',
    long_desc1: 'Full description',
    marketing_description: 'Marketing description',
  };

  const validDescs = descriptions.filter(d => d.value && d.value.trim());

  if (validDescs.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What We Found Out</Text>
        <Text style={styles.emptyState}>No descriptions were generated.</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>What We Found Out</Text>
      {validDescs.map((desc) => (
        <View key={desc.fieldName} style={styles.descriptionBox}>
          <Text style={styles.descriptionLabel}>{descLabels[desc.fieldName] || desc.fieldName}</Text>
          <Text style={styles.descriptionText}>{desc.value}</Text>
        </View>
      ))}
    </View>
  );
}

function ConfidenceSection({ 
  confidenceScore, 
  fieldConfidence, 
  status 
}: { 
  confidenceScore: number | null; 
  fieldConfidence: number | null; 
  status: string;
}) {
  const fieldConfidenceLabel = fieldConfidence ? `${Math.round(fieldConfidence * 100)}%` : '—';

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>How Sure Is The AI?</Text>
      <View style={styles.confidenceContainer}>
        <View style={styles.confidenceBox}>
          <Text style={styles.confidenceValue}>{confidenceScore !== null ? `${confidenceScore}%` : '—'}</Text>
          <Text style={styles.confidenceLabel}>Information Completeness</Text>
          <Text style={styles.confidenceExplanation}>
            How much of the product&apos;s details our AI was able to fill in
          </Text>
        </View>
        <View style={styles.confidenceBox}>
          <Text style={styles.confidenceValue}>{fieldConfidenceLabel}</Text>
          <Text style={styles.confidenceLabel}>AI Confidence</Text>
          <Text style={styles.confidenceExplanation}>
            How sure our AI is that what it found is correct
          </Text>
        </View>
      </View>
      {(status === 'failed' || status === 'enriching' || status === 'raw') && (
        <View style={styles.reviewBox}>
          <Text style={styles.reviewText}>
            {status === 'failed'
              ? 'The last cleaning run FAILED. Scores below reflect only partial data saved before the failure and do not indicate success.'
              : status === 'enriching'
                ? 'Cleaning is in progress — scores are incomplete snapshots.'
                : 'This product has not been cleaned yet — there is nothing to score.'}
          </Text>
        </View>
      )}
      {status === 'review' && (
        <View style={styles.reviewBox}>
          <Text style={styles.reviewText}>
            This item needs a quick human check before publishing — some details were unclear or missing from the original text.
          </Text>
        </View>
      )}
    </View>
  );
}

function GroundTruthSection({ gtResult }: { gtResult: any | null }) {
  if (!gtResult) return null;

  const groupScores = gtResult.group_scores || [];
  const validGroups = groupScores.filter((g: any) => g.total > 0);

  if (validGroups.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Checked Against Real Answers</Text>
      <Text style={styles.noteText}>
        We compared our AI&apos;s results to a known correct answer for this product. Here&apos;s how it did:
      </Text>
      <View style={styles.gtTable}>
        <View style={styles.gtHeader}>
          <Text style={styles.gtHeaderCell}>Category</Text>
          <Text style={styles.gtHeaderCell}>Result</Text>
        </View>
        {validGroups.map((group: any, index: number) => (
          <View key={index} style={styles.gtRow}>
            <Text style={styles.gtCell}>{group.group.charAt(0).toUpperCase() + group.group.slice(1)}</Text>
            <Text style={styles.gtCell}>
              {group.matched} of {group.total} details matched ({group.accuracy_pct}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Footer() {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>Report generated by InduIntel — AI Product Intelligence Pipeline</Text>
      <Text style={styles.pageNumber}>Page 1</Text>
    </View>
  );
}

function ReportDocument({ item, gtResult }: { item: any; gtResult: any | null }) {
  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>InduIntel</Text>
            <Text style={styles.tagline}>AI Product Report</Text>
          </View>
          <View>
            <Text style={styles.dateText}>Generated on {formattedDate}</Text>
          </View>
        </View>

        <Text style={styles.mainTitle}>{item.mfg_part_num}</Text>
        <Text style={styles.mpnSubtitle}>{item.part_desc || 'No description'}</Text>

        <StatusBanner status={item.status} failedStep={item.failed_step} failedError={item.failed_error} />

        <RawInputSection partDesc={item.part_desc} />

        <IdentitySection 
          manufacturerName={item.manufacturer_name}
          brandName={item.brand_name}
          classpath={item.classpath}
        />

        <AttributesSection attributes={item.item_attributes || []} />

        <DescriptionsSection 
          descriptions={(item.item_descriptions || []).map((d: any) => ({
            fieldName: d.field_name,
            value: d.value,
            charCount: d.char_count,
          }))}
        />

        <SpecsSection spec={Array.isArray(item.item_specs) ? item.item_specs[0] : item.item_specs ?? null} />

        <ConfidenceSection 
          confidenceScore={item.confidence_score}
          fieldConfidence={item.field_confidence}
          status={item.status}
        />

        <GroundTruthSection gtResult={gtResult} />

        <Footer />
      </Page>
    </Document>
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ item_id: string }> }
) {
  try {
    const { item_id } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select(`
        id,
        mfg_part_num,
        part_desc,
        manufacturer_name,
        brand_name,
        classpath,
        status,
        confidence_score,
        field_confidence,
        failed_step,
        failed_error,
        item_descriptions(field_name, value, char_count),
        item_attributes(label, value, uom),
        item_specs(*)
      `)
      .eq('id', item_id)
      .maybeSingle();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    let gtResult = null;
    if (item.status === 'enriched' || item.status === 'review') {
      // Direct call — never an HTTP self-reference (Vercel-safe).
      try {
        const { data: gtItem } = await supabase
          .from('items')
          .select('id')
          .eq('mfg_part_num', item.mfg_part_num)
          .eq('is_ground_truth', true)
          .maybeSingle();

        if (gtItem) {
          gtResult = await computeGroundTruthScore(item.id, gtItem.id);
        }
      } catch (err) {
        console.error('GT scoring skipped:', err);
      }
    }

    const doc = <ReportDocument item={item} gtResult={gtResult} />;
    const stream = await renderToStream(doc);

    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      if (chunk instanceof Uint8Array) {
        chunks.push(chunk);
      }
    }
    const pdfBuffer = Buffer.concat(chunks);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${item.mfg_part_num}-report.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
