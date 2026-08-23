/** Stage 5 unit tests: product identity + duplicate semantics (Parts 3 + 4). */
import {
  describe, test, assert, assertEqual,
} from '../helpers/harness';
import {
  computeIdentity,
  mpnKey,
  nameKey,
  isStrongDescription,
  normalizeTextForIdentity,
} from '../../lib/product-intelligence/identity';

describe('identity: normalization safety', () => {
  test('MPN keeps meaningful characters (ABC-123 never becomes unrelated)', () => {
    assertEqual(mpnKey('ABC-123'), 'ABC123');
    assertEqual(mpnKey('abc 123'), 'ABC123');
    assertEqual(mpnKey('ABC_123'), 'ABC123');
    // Digits/letters are never dropped or truncated
    assertEqual(mpnKey('X9Z-0001/A'), 'X9Z0001A');
    assertEqual(mpnKey('12.5MM-BOLT'), '12.5MMBOLT'.replace('.', ''));
  });

  test('unicode MPN variants fold consistently', () => {
    assertEqual(mpnKey('ＡＢＣ－１２３'), mpnKey('ABC123'));
  });

  test('name keys ignore corporate suffixes and case', () => {
    assertEqual(nameKey('Acme Corporation'), nameKey('acme corp'));
    assertEqual(nameKey('Müller GmbH'), nameKey('müller'));
  });

  test('empty inputs yield null components', () => {
    assertEqual(normalizeTextForIdentity('   '), null);
    assertEqual(mpnKey(null), null);
    assertEqual(nameKey(''), null);
  });
});

describe('identity: strength ladder', () => {
  test('manufacturer + MPN is strong', () => {
    const id = computeIdentity({ manufacturer: 'Acme Corp', mpn: 'ABC-123', description: '' });
    assertEqual(id.strength, 'strong');
    assertEqual(id.basis, 'manufacturer_mpn');
    assert(id.key != null);
  });

  test('manufacturer + brand + strong description is medium', () => {
    const id = computeIdentity({
      manufacturer: 'Acme',
      brand: 'AcmeTools',
      description: 'Heavy duty industrial hex bolt washer assembly kit for machinery',
    });
    assertEqual(id.strength, 'medium');
    assertEqual(id.basis, 'manufacturer_brand_description');
  });

  test('brand + strong description is medium', () => {
    const id = computeIdentity({
      brand: 'AcmeTools',
      description: 'Cordless drill driver with two speed gearbox and LED work light',
    });
    assertEqual(id.strength, 'medium');
    assertEqual(id.basis, 'brand_description');
  });

  test('description ALONE never yields identity', () => {
    const id = computeIdentity({ description: 'Very detailed industrial hydraulic pump with brass fittings' });
    assertEqual(id.strength, 'none');
    assertEqual(id.key, null);
    assertEqual(id.basis, 'insufficient');
  });

  test('weak description does not support medium identity', () => {
    assert(!isStrongDescription('a bolt'));
    assert(isStrongDescription('stainless steel hex bolt m12 x 60mm din 933'));
  });

  test('same product identity matches across formatting variants', () => {
    const a = computeIdentity({ manufacturer: 'ACME Corporation', mpn: 'abc 123' });
    const b = computeIdentity({ manufacturer: 'Acme Corp', mpn: 'ABC-123' });
    assertEqual(a.key, b.key);
    assertEqual(a.strength, b.strength);
  });

  test('different MPNs under same manufacturer NEVER share identity', () => {
    const a = computeIdentity({ manufacturer: 'Acme', mpn: 'ABC-123' });
    const b = computeIdentity({ manufacturer: 'Acme', mpn: 'ABC-124' });
    assert(a.key !== b.key);
  });

  test('similar descriptions with different identities stay separate', () => {
    const a = computeIdentity({ manufacturer: 'Acme', mpn: 'AAA-1', description: 'steel bracket heavy duty mounting hardware' });
    const b = computeIdentity({ manufacturer: 'Beta', mpn: 'BBB-2', description: 'steel bracket heavy duty mounting hardware' });
    assert(a.key !== b.key); // identical descriptions do not merge distinct products
  });
});
