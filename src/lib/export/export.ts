import { Product, ProductAttribute, Conflict, CommerceOutput, ExportOptions } from '@/types';
import { sanitizeCSVValue } from '@/lib/pdf/csv-parser';

export interface ExportResult {
  content: string;
  filename: string;
  mimeType: string;
}

export function exportToJSON(product: Product, options: ExportOptions): ExportResult {
  const exportData: any = {
    product: {
      id: product.id,
      name: product.name,
      manufacturer: product.manufacturer,
      model: product.model,
      category: product.category,
      completeness: product.completeness,
      confidence: product.confidence,
      attributes: product.attributes.map(attr => ({
        key: attr.key,
        label: attr.label,
        value: attr.value,
        unit: attr.unit,
        normalizedValue: attr.normalizedValue,
        normalizedUnit: attr.normalizedUnit,
        status: attr.status,
        confidence: attr.confidence,
        evidence: options.includeEvidence ? attr.evidence : undefined,
      })),
      conflicts: options.includeConflicts ? product.conflicts : undefined,
      missingAttributes: product.missingAttributes,
      documents: product.documents,
      commerce: product.commerce,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    },
    exportedAt: new Date().toISOString(),
  };

  return {
    content: JSON.stringify(exportData, null, 2),
    filename: `${product.name || product.model || 'product'}_${product.id.slice(0, 8)}.json`,
    mimeType: 'application/json',
  };
}

export function exportToCSV(product: Product, options: ExportOptions): ExportResult {
  const rows: string[][] = [];
  const headers = [
    'Key',
    'Label',
    'Value',
    'Unit',
    'Normalized Value',
    'Normalized Unit',
    'Status',
    'Confidence',
    ...(options.includeEvidence ? ['Evidence Count', 'Evidence Sources'] : []),
  ];

  rows.push(headers);

  product.attributes.forEach(attr => {
    const row = [
      attr.key,
      attr.label,
      attr.value?.toString() || '',
      attr.unit || '',
      attr.normalizedValue?.toString() || '',
      attr.normalizedUnit || '',
      attr.status,
      attr.confidence.toString(),
    ];

    if (options.includeEvidence) {
      row.push(
        attr.evidence.length.toString(),
        attr.evidence.map(e => `${e.documentName} p.${e.page}`).join('; ')
      );
    }

    rows.push(row.map(sanitizeCSVValue));
  });

  if (options.includeConflicts && product.conflicts.length > 0) {
    rows.push([]);
    rows.push(['CONFLICTS']);
    rows.push(['Attribute Key', 'Values', 'Recommended', 'Confidence', 'Severity', 'Requires Review']);

    product.conflicts.forEach(conflict => {
      rows.push([
        conflict.attributeKey,
        conflict.values.map(v => `${v.value} ${v.unit || ''}`).join('; '),
        `${conflict.recommendedValue} ${conflict.recommendedUnit || ''}`,
        conflict.confidence.toString(),
        conflict.severity,
        conflict.requiresHumanReview ? 'Yes' : 'No',
      ].map(sanitizeCSVValue));
    });
  }

  const csvContent = rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');

  return {
    content: csvContent,
    filename: `${product.name || product.model || 'product'}_${product.id.slice(0, 8)}.csv`,
    mimeType: 'text/csv',
  };
}

export function exportCommerceToJSON(commerce: CommerceOutput, productId: string): ExportResult {
  const exportData = {
    commerce,
    productId,
    exportedAt: new Date().toISOString(),
  };

  return {
    content: JSON.stringify(exportData, null, 2),
    filename: `commerce_${productId.slice(0, 8)}.json`,
    mimeType: 'application/json',
  };
}

export function exportCommerceToCSV(commerce: CommerceOutput, productId: string): ExportResult {
  const rows: string[][] = [];

  rows.push(['Field', 'Value']);
  rows.push(['Title', sanitizeCSVValue(commerce.title)]);
  rows.push(['Short Description', sanitizeCSVValue(commerce.shortDescription)]);
  rows.push(['Long Description', sanitizeCSVValue(commerce.longDescription)]);
  rows.push(['Keywords', sanitizeCSVValue(commerce.keywords.join(', '))]);
  rows.push([]);

  rows.push(['Technical Specifications']);
  rows.push(['Key', 'Label', 'Value']);
  commerce.technicalSpecifications.forEach(spec => {
    rows.push([sanitizeCSVValue(spec.key), sanitizeCSVValue(spec.label), sanitizeCSVValue(spec.value)]);
  });

  const csvContent = rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');

  return {
    content: csvContent,
    filename: `commerce_${productId.slice(0, 8)}.csv`,
    mimeType: 'text/csv',
  };
}