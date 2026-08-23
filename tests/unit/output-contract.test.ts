/**
 * Stage 5 unit tests: category generalization (Part 7) + output contract
 * (Parts 13–15).
 */
import {
  describe, test, assert, assertEqual, assertThrows,
} from '../helpers/harness';
import { extractAttributes } from '../../lib/product-intelligence/category-attributes';
import type { CanonicalProduct } from '../../lib/product-intelligence/types';
import { createEmptyProduct } from '../../lib/product-intelligence/canonical';
import {
  UNIHACK_HEADERS,
  TOTAL_HEADERS,
  HEADER_TO_INTERNAL,
  validateHeaderOrder,
  validateMappingIntegrity,
} from '../../lib/unihack/output-schema';
import { productToRow } from '../../lib/unihack/output-mapper';

function productWithAttributes(category: Partial<CanonicalProduct>): CanonicalProduct {
  let p = createEmptyProduct('test');
  p = { ...p, ...category };
  p.attributes = [
    { label: 'Voltage Rating', value: '24', uom: 'V' },
    { label: 'Material', value: 'Stainless Steel' },
    { label: 'Sterilization Compatible', value: 'Yes' },   // medical-only
    { label: 'Load Capacity', value: '500', uom: 'kg' },    // construction-only
    { label: 'Warp Core Alignment', value: '5.0' },          // totally unknown
  ];
  return p;
}

describe('category generalization (Part 7)', () => {
  test('known categories keep their relevance filtering', () => {
    const p = productWithAttributes({ dept: 'electronics' });
    const attrs = extractAttributes(p);
    const labels = attrs.map((a) => a.label.toLowerCase());
    // Electronics-relevant attribute present; construction-only filtered
    assert(labels.includes('voltage'));
    assert(!labels.includes('load capacity'), 'construction attr must be filtered in electronics');
  });

  test('unknown category does NOT produce zero attributes', () => {
    const p = productWithAttributes({ dept: 'quantum underwater welding' });
    const attrs = extractAttributes(p);
    assert(attrs.length > 0, 'unknown category must retain attributes (generic handling)');
  });

  test('unknown category keeps arbitrary attributes through generic handling', () => {
    const p = productWithAttributes({ dept: null, classpath: null });
    const attrs = extractAttributes(p);
    const labels = attrs.map((a) => a.label.toLowerCase());
    assert(labels.includes('warp core alignment'));
    assert(labels.includes('sterilization compatible'));
  });

  test('quality controls still apply for unknown categories', () => {
    const p = createEmptyProduct('t');
    p.dept = 'mystery-category';
    p.attributes = [
      { label: '', value: 'x' },            // empty label dropped
      { label: 'Color', value: '' },        // empty value dropped
      { label: 'Status', value: 'TBD' },    // fake value dropped
      { label: 'Color', value: 'Blue' },    // duplicate dropped
      { label: 'Finish', value: 'Matte' },  // kept
    ];
    const attrs = extractAttributes(p);
    assertEqual(attrs.length, 1);
    assertEqual(attrs[0].label, 'finish');
  });

  test('synonym labels normalize for known categories', () => {
    const p = createEmptyProduct('t');
    p.dept = 'industrial';
    p.attributes = [{ label: 'Horsepower', value: '3' }];
    const attrs = extractAttributes(p);
    assertEqual(attrs.length, 1);
    assertEqual(attrs[0].label, 'power_rating');
  });
});

describe('output contract: 252 columns (Part 13)', () => {
  test('schema exposes exactly 252 headers', () => {
    assertEqual(TOTAL_HEADERS, 252);
    assertEqual(UNIHACK_HEADERS.length, 252);
  });

  test('headers are byte-stable against the delivery format', () => {
    // Exact spelling/capitalization of critical headers, at their canonical
    // positions (indices derived from the schema itself).
    const h = UNIHACK_HEADERS as readonly string[];
    assertEqual(h[0], 'MFR URL');
    assertEqual(h.indexOf('PART_NUMBER'), 6);
    assertEqual(h.indexOf('MANUFACTURER_NAME'), 17);
    assertEqual(h.indexOf('ITEM_FEATURES_20'), 48);
    assertEqual(h[h.length - 1], 'Actual Image (Yes/No)');
    assertEqual(new Set(h).size, 252, 'no duplicate headers');
    assertEqual(h.filter((x) => x === 'UPC').length, 1);
    assertEqual(h.filter((x) => x === 'ATTRIBUTE_LABEL 50').length, 1);
  });

  test('validateHeaderOrder + mapping integrity hold', () => {
    assert(validateHeaderOrder(UNIHACK_HEADERS));
    assert(validateMappingIntegrity());
    assertEqual(Object.keys(HEADER_TO_INTERNAL).length, 252);
  });

  test('every mapped product row has exactly 252 columns', () => {
    const p = createEmptyProduct('p1');
    p.mfg_part_num = 'ABC-123';
    p.manufacturer_name = 'Acme';
    const row = productToRow(p);
    assertEqual(row.length, UNIHACK_HEADERS.length);
    assertEqual(row.length, 252);
    row.forEach((cell) => assert(typeof cell === 'string'));
  });

  test('sparse/empty products still produce exactly 252 string cells', () => {
    const row = productToRow(createEmptyProduct('empty'));
    assertEqual(row.length, 252);
    assert(row.every((c) => typeof c === 'string'));
    // All unmapped/absent fields are empty; only the image flag defaults to 'No'
    assert(row.filter((c) => c !== '').every((c) => c === 'No'));
  });

  test('unicode and special characters survive the mapper', () => {
    const p = createEmptyProduct('u');
    p.manufacturer_name = 'Müller & Söhne "Spezial"';
    p.part_desc = 'Multi-line\ndescription with, commas; and "quotes"';
    const row = productToRow(p);
    assertEqual(row.length, 252);
    assert(row.includes('Müller & Söhne "Spezial"'));
    assert(row.includes('Multi-line\ndescription with, commas; and "quotes"'));
  });
});
