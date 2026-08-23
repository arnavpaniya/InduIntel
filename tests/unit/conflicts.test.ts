/** Stage 5 unit tests: conflict resolution + value quality (Parts 5 + 6). */
import {
  describe, test, assert, assertEqual,
} from '../helpers/harness';
import {
  resolveFieldConflict,
  mergeExternalIntoField,
  statusForOutcome,
  AUTHORITY_PRIORITY,
  type FieldCandidate,
} from '../../lib/product-intelligence/conflicts';

const input = (value: string | number | null): FieldCandidate => ({
  value, authority: 'verified_input', source_type: 'input',
});
const external = (value: string | number | null, url = 'https://mfg.example.com/p'): FieldCandidate => ({
  value, authority: 'verified_authoritative', source_type: 'external', source_url: url,
});
const inferred = (value: string | number | null): FieldCandidate => ({
  value, authority: 'inferred', source_type: 'inferred',
});

describe('conflicts: agreement + priority', () => {
  test('null-only candidates are unresolved', () => {
    const r = resolveFieldConflict([input(null), external(null)]);
    assertEqual(r.status, 'unresolved');
    assertEqual(r.value, null);
    assertEqual(r.conflict, false);
  });

  test('agreeing values collapse to highest authority', () => {
    const r = resolveFieldConflict([input(2.4), external(2.4)]);
    assertEqual(r.conflict, false);
    assertEqual(r.status, 'verified');
    assertEqual(r.value, 2.4); // authoritative wins display
    assertEqual(r.candidates[0].authority, 'verified_authoritative');
  });

  test('numeric strings equal to numbers agree ("2.40" == 2.4)', () => {
    const r = resolveFieldConflict([input('2.40'), external(2.4)]);
    assertEqual(r.conflict, false);
  });

  test('unit-bearing values never merge across different units', () => {
    const r = resolveFieldConflict([input('2 lb'), external('2 kg')]);
    assertEqual(r.conflict, true);
  });

  test('conflicting values preserve BOTH candidates and mark conflicting', () => {
    const r = resolveFieldConflict([input(2), external(3)]);
    assertEqual(r.status, 'conflicting');
    assertEqual(r.conflict, true);
    // Display = most authoritative (external 3), but input value retained
    assertEqual(r.value, 3);
    assertEqual(r.candidates.length, 2);
    assert(JSON.stringify(r.candidates.map((c) => c.value)).includes('2'));
  });

  test('authority ranking verified > verified_input > inferred', () => {
    assert(AUTHORITY_PRIORITY.verified_authoritative > AUTHORITY_PRIORITY.verified_input);
    assert(AUTHORITY_PRIORITY.verified_input > AUTHORITY_PRIORITY.inferred);
    const r = resolveFieldConflict([inferred(10), input(20), external(30)]);
    assertEqual(r.value, 30);
  });

  test('case/whitespace variants do NOT conflict', () => {
    const r = resolveFieldConflict([input('Acme Corp'), input('acme  corp')]);
    assertEqual(r.conflict, false);
  });

  test('mergeExternalIntoField keeps prior provenance candidates', () => {
    const base = resolveFieldConflict([input('Acme')]);
    const merged = mergeExternalIntoField(base, external('Beta'));
    assertEqual(merged.status, 'conflicting');
    assertEqual(merged.candidates.length, 2);
  });
});

describe('value quality statuses', () => {
  test('missing never becomes inferred', () => {
    assertEqual(statusForOutcome({ hasValue: false, semanticInterpretation: true }), 'unresolved');
  });
  test('evidence-backed is verified', () => {
    assertEqual(statusForOutcome({ hasValue: true, fromEvidence: true }), 'verified');
  });
  test('semantic interpretation stays inferred', () => {
    assertEqual(statusForOutcome({ hasValue: true, semanticInterpretation: true }), 'inferred');
  });
  test('invalid format wins over other signals', () => {
    assertEqual(statusForOutcome({ hasValue: true, invalidFormat: true, fromEvidence: true }), 'invalid');
  });
});
