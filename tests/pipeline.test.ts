import { normalizeUnit, normalizeValue, convertToStandardUnit } from '../src/lib/normalization/units';
import { sanitizeCSVValue } from '../src/lib/pdf/csv-parser';
import { getRequiredAttributes, getAllAttributes } from '../src/schemas';
import { getAIProvider } from '../src/lib/ai';

async function runTests() {
  console.log('--- Running InduIntel Verification Test Suite ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✓ ${message}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Unit Normalization Tests
  assert(normalizeUnit('hp') === 'HP', 'Normalizes "hp" to "HP"');
  assert(normalizeUnit('kv') === 'kV', 'Normalizes "kv" to "kV"');
  assert(normalizeUnit('rpm') === 'RPM', 'Normalizes "rpm" to "RPM"');

  const hpNorm = normalizeValue('10', 'hp');
  assert(hpNorm.value === 7.457 && hpNorm.unit === 'kW', 'Converts 10 HP to 7.457 kW');

  const kvNorm = normalizeValue('0.415', 'kV');
  assert(kvNorm.value === 415 && kvNorm.unit === 'V', 'Converts 0.415 kV to 415 V');

  const conv = convertToStandardUnit(10, 'HP', 'kW');
  assert(conv === 7.457, 'convertToStandardUnit converts 10 HP to 7.457 kW');

  // 2. CSV Formula Injection Defense Tests
  assert(sanitizeCSVValue('=SUM(A1:A10)') === "'=SUM(A1:A10)", 'Escapes CSV formula starting with =');
  assert(sanitizeCSVValue('+cmd|/c calc') === "'+cmd|/c calc", 'Escapes CSV formula starting with +');
  assert(sanitizeCSVValue('-10') === "'-10", 'Escapes CSV formula starting with -');
  assert(sanitizeCSVValue('@eval(1)') === "'@eval(1)", 'Escapes CSV formula starting with @');
  assert(sanitizeCSVValue('415 V') === '415 V', 'Leaves normal text values untouched');

  // 3. Schema Category Tests
  const motorReqs = getRequiredAttributes('electric_motor');
  assert(motorReqs.includes('power') && motorReqs.includes('voltage') && motorReqs.includes('speed'), 'Electric motor required attributes present');

  const bearingReqs = getRequiredAttributes('bearing');
  assert(bearingReqs.includes('bearing_type') && bearingReqs.includes('inner_diameter'), 'Bearing required attributes present');

  const pumpReqs = getRequiredAttributes('industrial_pump');
  assert(pumpReqs.includes('flow_rate') && pumpReqs.includes('head'), 'Pump required attributes present');

  // 4. AI Provider Fail-Fast Configuration Error Test
  delete process.env.OLLAMA_HOST;
  delete process.env.OLLAMA_MODEL;
  delete process.env.USE_MOCK_AI;

  try {
    getAIProvider();
    assert(false, 'Should throw error when Ollama config is absent and USE_MOCK_AI is not set');
  } catch (err: any) {
    assert(err.message.includes('AI Provider Initialization Failed'), 'Throws explicit setup error when Ollama config is missing');
  }

  console.log(`\nTest Suite Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
