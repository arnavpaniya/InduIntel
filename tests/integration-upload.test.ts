import fs from 'fs';
import path from 'path';
import { processDocument, ProcessingContext } from '../src/lib/processing';

// Enable mock AI mode if GEMINI_API_KEY is not set during automated unit test run
if (!process.env.GEMINI_API_KEY) {
  process.env.USE_MOCK_AI = 'true';
}

async function testIntegrationPipeline() {
  console.log('==================================================');
  console.log('   InduIntel Pipeline Integration & Upload Test   ');
  console.log('==================================================\n');

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

  const sampleDir = path.join(__dirname, '../sample_datasheets');

  // Test 1: Industrial Electric Motor PDF Processing
  console.log('--- Test 1: ABB Electric Motor PDF Datasheet ---');
  const pdfPath = path.join(sampleDir, 'abb_electric_motor_m3bp.pdf');
  assert(fs.existsSync(pdfPath), 'PDF sample file exists');

  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfContext: ProcessingContext = {
    userId: 'test_user_01',
    documentId: 'doc_pdf_test_01',
    documentName: 'abb_electric_motor_m3bp.pdf',
    documentType: 'pdf',
    category: 'electric_motor',
    manufacturer: 'ABB',
    model: 'M3BP 160MLA',
  };

  const pdfResult = await processDocument(pdfBuffer, pdfContext);
  assert(pdfResult.product !== undefined, 'Generated product profile from PDF');
  assert(pdfResult.product.category === 'electric_motor', 'Categorized as electric_motor');
  assert(pdfResult.product.attributes.length > 0, 'Extracted motor specifications');
  assert(pdfResult.product.completeness > 0, `Completeness score calculated: ${pdfResult.product.completeness}%`);
  assert(pdfResult.stages.every(s => s.status === 'completed'), 'All processing timeline stages completed successfully');

  // Test 2: Industrial Bearing CSV Processing
  console.log('\n--- Test 2: SKF Bearing CSV Datasheet ---');
  const csvPath = path.join(sampleDir, 'skf_bearing_6205.csv');
  assert(fs.existsSync(csvPath), 'CSV sample file exists');

  const csvBuffer = fs.readFileSync(csvPath);
  const csvContext: ProcessingContext = {
    userId: 'test_user_01',
    documentId: 'doc_csv_test_01',
    documentName: 'skf_bearing_6205.csv',
    documentType: 'csv',
    category: 'bearing',
    manufacturer: 'SKF',
    model: '6205-2RSH',
  };

  const csvResult = await processDocument(csvBuffer, csvContext);
  assert(csvResult.product !== undefined, 'Generated product profile from CSV');
  assert(csvResult.product.category === 'bearing', 'Categorized as bearing');
  assert(csvResult.product.attributes.length > 0, 'Extracted bearing specifications');
  assert(csvResult.stages.every(s => s.status === 'completed'), 'All CSV processing timeline stages completed');

  // Test 3: Industrial Pump TXT Specification Processing
  console.log('\n--- Test 3: Grundfos Industrial Pump TXT Datasheet ---');
  const txtPath = path.join(sampleDir, 'grundfos_pump_cr15.txt');
  assert(fs.existsSync(txtPath), 'TXT sample file exists');

  const txtBuffer = fs.readFileSync(txtPath);
  const txtContext: ProcessingContext = {
    userId: 'test_user_01',
    documentId: 'doc_txt_test_01',
    documentName: 'grundfos_pump_cr15.txt',
    documentType: 'text',
    category: 'industrial_pump',
    manufacturer: 'Grundfos',
    model: 'CR 15-3',
  };

  const txtResult = await processDocument(txtBuffer, txtContext);
  assert(txtResult.product !== undefined, 'Generated product profile from TXT');
  assert(txtResult.product.category === 'industrial_pump', 'Categorized as industrial_pump');
  assert(txtResult.product.attributes.length > 0, 'Extracted pump specifications');
  assert(txtResult.stages.every(s => s.status === 'completed'), 'All TXT processing timeline stages completed');

  console.log(`\n==================================================`);
  console.log(`Integration Test Summary: ${passed} passed, ${failed} failed.`);
  console.log(`==================================================`);

  if (failed > 0) process.exit(1);
}

testIntegrationPipeline().catch(err => {
  console.error('Integration test runner error:', err);
  process.exit(1);
});
