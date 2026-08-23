/** Stage 5 unit tests: input normalization layer (Parts 1 + 2). */
import {
  describe, test, assert, assertEqual, assertIncludes, assertDeepEqual,
} from '../helpers/harness';
import {
  normalizeCsvInput,
  normalizeInputRecord,
  resolveHeader,
  cleanCellValue,
  isValidGtinCode,
  splitValueAndUom,
  fieldValue,
  fieldNumber,
} from '../../lib/input/input-normalizer';

describe('input normalizer: header alias resolution', () => {
  test('manufacturer variants resolve to manufacturer_name', () => {
    for (const h of ['Manufacturer', 'manufacturer', 'MFR', 'Mfg', 'MANUFACTURER_NAME', 'mfr name', 'Mfg-Name']) {
      assertEqual(resolveHeader(h), 'manufacturer_name', `header "${h}"`);
    }
  });

  test('MPN variants resolve to mfg_part_num', () => {
    for (const h of ['MPN', 'mpn', 'Part Number', 'PART_NUMBER', 'Manufacturer Part Number', 'part-no', 'Mfg_Part_Num']) {
      assertEqual(resolveHeader(h), 'mfg_part_num', `header "${h}"`);
    }
  });

  test('brand / sku / description / category / barcode variants resolve', () => {
    assertEqual(resolveHeader('Brand'), 'brand_name');
    assertEqual(resolveHeader('BRAND_NAME'), 'brand_name');
    assertEqual(resolveHeader('SKU'), 'sku');
    assertEqual(resolveHeader('Description'), 'part_desc');
    assertEqual(resolveHeader('Product Description'), 'part_desc');
    assertEqual(resolveHeader('Category'), 'classpath');
    assertEqual(resolveHeader('Product Type'), 'classpath');
    assertEqual(resolveHeader('UPC'), 'upc');
    assertEqual(resolveHeader('EAN Code'), 'ean');
    assertEqual(resolveHeader('GTIN'), 'gtin');
  });

  test('ambiguous headers are never aggressively merged', () => {
    for (const h of ['Model', 'Part', 'Size', 'Type', 'Name', 'Code', 'UOM']) {
      assertEqual(resolveHeader(h), 'ambiguous', `header "${h}" must stay ambiguous`);
    }
  });

  test('unrecognized headers return null', () => {
    assertEqual(resolveHeader('Totally Custom Column'), null);
    assertEqual(resolveHeader(''), null);
  });

  test('uom companion headers map to uom fields', () => {
    assertEqual(resolveHeader('WEIGHT_UOM'), 'weight_uom' as any);
    assertEqual(resolveHeader('Length Unit'), 'length_uom' as any);
  });
});

describe('input normalizer: value cleaning', () => {
  test('blank strings and placeholders become null', () => {
    for (const v of ['', '   ', '-- Unbranded --', '-- No Unilog Brand --', '-', 'N/A', 'null', 'TBD']) {
      assertEqual(cleanCellValue(v), null, `value "${v}"`);
    }
  });

  test('whitespace and zero-width characters are stripped', () => {
    assertEqual(cleanCellValue('  Acme Corp \u200b'), 'Acme Corp');
  });

  test('unicode values are preserved (NFKC)', () => {
    assertEqual(cleanCellValue('Müller GmbH'), 'Müller GmbH');
    // Full-width latin folds to ascii under NFKC
    assertEqual(cleanCellValue('Ａｃｍｅ'), 'Acme');
  });
});

describe('input normalizer: barcode validation', () => {
  test('valid UPC-A passes checksum', () => {
    assert(isValidGtinCode('036000291452'));
  });
  test('wrong check digit is rejected', () => {
    assert(!isValidGtinCode('036000291453'));
  });
  test('valid EAN-13 passes', () => {
    assert(isValidGtinCode('4006381333931'));
  });
  test('non-numeric or wrong-length rejected', () => {
    assert(!isValidGtinCode('12345'));
    assert(!isValidGtinCode('ABCDEFGHIJKLMNOP'));
  });
});

describe('input normalizer: measurement splitting', () => {
  test('splits value + uom', () => {
    assertDeepEqual(splitValueAndUom('2.4 kg'), { value: '2.4', uom: 'kg' });
    assertDeepEqual(splitValueAndUom('12 in'), { value: '12', uom: 'in' });
  });
  test('plain numbers keep no uom', () => {
    assertDeepEqual(splitValueAndUom('2.4'), { value: '2.4', uom: null });
  });
});

describe('input normalizer: record normalization', () => {
  test('column order does not matter', () => {
    const a = normalizeInputRecord({ MPN: 'X1', Manufacturer: 'Acme' }, 0, []);
    const b = normalizeInputRecord({ Manufacturer: 'Acme', MPN: 'X1' }, 1, [a]);
    assertEqual(fieldValue(a, 'mfg_part_num'), 'X1');
    assertEqual(fieldValue(b, 'mfg_part_num'), 'X1');
    assertEqual(fieldValue(a, 'manufacturer_name'), fieldValue(b, 'manufacturer_name'));
  });

  test('missing optional columns simply leave fields unresolved', () => {
    const row = normalizeInputRecord({ MPN: 'X1' }, 0, []);
    assertEqual(fieldValue(row, 'manufacturer_name'), null);
    assertEqual(row.fields['manufacturer_name'], undefined);
  });

  test('extra columns are reported unmapped, not dropped silently', () => {
    const row = normalizeInputRecord({ MPN: 'X1', 'Warehouse Location': 'A5' }, 0, []);
    assertIncludes(row.unmappedColumns.map((u) => u.column), 'Warehouse Location');
    assertEqual(row.unmappedColumns[0].reason, 'unrecognized');
  });

  test('two columns mapping to same field with different values preserve conflict', () => {
    const row = normalizeInputRecord(
      { Manufacturer: 'Acme Corp', MFR: 'Beta Industries', MPN: 'X1' },
      0, [],
    );
    const f = row.fields['manufacturer_name'];
    assert(f);
    assertEqual(f!.status, 'conflicting');
    assertEqual(f!.value, 'Acme Corp'); // display = first source order
    assertEqual(f!.contributions.length, 2);
    assertIncludes(row.issues.join(' '), 'conflicting manufacturer_name');
  });

  test('two columns agreeing on the same value merge cleanly', () => {
    const row = normalizeInputRecord({ Manufacturer: 'Acme', MFG: 'acme', MPN: 'X1' }, 0, []);
    const f = row.fields['manufacturer_name'];
    assertEqual(f!.status, 'verified');
    assertEqual(f!.contributions.length, 1);
  });

  test('invalid numeric marks invalid without guessing', () => {
    const row = normalizeInputRecord({ MPN: 'X1', Weight: 'heavy' }, 0, []);
    const f = row.fields['weight'];
    assertEqual(f!.status, 'invalid');
    assertEqual(f!.value, null);
    assertIncludes(row.issues.join(' '), 'invalid numeric');
  });

  test('invalid barcode checksum marks invalid', () => {
    const row = normalizeInputRecord({ MPN: 'X1', UPC: '036000291453' }, 0, []);
    assertEqual(row.fields['upc']!.status, 'invalid');
  });

  test('numeric coercion works for weight/price', () => {
    const row = normalizeInputRecord({ MPN: 'X1', Weight: '2.5', 'List Price': '1,299.99' }, 0, []);
    assertEqual(fieldNumber(row, 'weight'), 2.5);
    assertEqual(fieldNumber(row, 'list_price'), 1299.99);
  });

  test('duplicate rows detected by exact fingerprint', () => {
    const first = normalizeInputRecord({ MPN: 'X1', Description: 'Widget' }, 0, []);
    const dup = normalizeInputRecord({ MPN: 'X1', Description: 'Widget' }, 1, [first]);
    const diff = normalizeInputRecord({ MPN: 'X1', Description: 'Different widget entirely' }, 2, [first]);
    assertEqual(dup.exactDuplicateOf, 0);
    assertEqual(diff.exactDuplicateOf, null);
  });

  test('sparse product with only description stays unresolved elsewhere', () => {
    const row = normalizeInputRecord({ Description: 'Some widget' }, 0, []);
    assertEqual(fieldValue(row, 'part_desc'), 'Some widget');
    assertEqual(fieldValue(row, 'mfg_part_num'), null);
  });
});

describe('input normalizer: full CSV documents', () => {
  test('handles reordered, missing, extra columns; blank lines; BOM; CRLF; quoted commas/newlines', () => {
    const csv =
      '\uFEFFDescription,UPC,MPN,Weight\r\n' +
      '"Bolt, hex\r\n1/2in",,"B-100",\r\n' +
      'Washer plain,4006381333931,W-200,0.1 kg\r\n' +
      '\r\n' +
      'Nut lock nylon,,,,\r\n';
    const result = normalizeCsvInput(csv);
    assertEqual(result.rows.length, 3);

    const bolt = result.rows[0];
    assertEqual(fieldValue(bolt, 'mfg_part_num'), 'B-100');
    assertIncludes(bolt.raw['Description'], '1/2in'); // newline inside quotes preserved

    const washer = result.rows[1];
    assertEqual(fieldValue(washer, 'upc'), '4006381333931');
    assertEqual(washer.fields['weight']!.status, 'verified');
    assertEqual(washer.fields['weight']!.uom, 'kg');

    const nut = result.rows[2];
    assertEqual(nut.exactDuplicateOf, null);
  });

  test('empty CSV body produces zero rows without crashing', () => {
    const result = normalizeCsvInput('ColA,ColB\n');
    assertEqual(result.rows.length, 0);
  });
});
