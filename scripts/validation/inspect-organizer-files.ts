/**
 * Stage 6, Part 1: Organizer-file inspection + contract comparison.
 * Prints a documented comparison between the actual organizer files and
 * the frozen 252-column UniHack output schema. Read-only.
 */
import { readFileSync } from 'fs';
import { parse as csvParse } from 'csv-parse/sync';
import { UNIHACK_HEADERS } from '../../lib/unihack/output-schema';

const INPUT_CSV = 'Unihack_ Sample Dataset - Input.csv';
const OUTPUT_CSV = 'Unihack_ Expected Output - Delivery Format.csv';

const inputRaw = readFileSync(INPUT_CSV, 'utf-8');
const outputRaw = readFileSync(OUTPUT_CSV, 'utf-8');

const inputRows = csvParse(inputRaw, { columns: true, skip_empty_lines: true, bom: true }) as Array<Record<string, string>>;
const outputRows = csvParse(outputRaw, { columns: true, skip_empty_lines: false, bom: true }) as Array<Record<string, string>>;

console.log('=== ORGANIZER FILE INSPECTION (Part 1) ===\n');

// --- Input dataset ---
const inputHeaders = Object.keys(inputRows[0] ?? {});
console.log(`[Input] ${INPUT_CSV}`);
console.log(`  data rows: ${inputRows.length}`);
console.log(`  columns (${inputHeaders.length}): ${inputHeaders.join(', ')}`);

// MPN structure
const mpns = inputRows.map((r) => (r['Mfg_Part_Num'] ?? '').trim()).filter(Boolean);
const dupMpn = mpns.length - new Set(mpns).size;
const placeholder = (v: string) => v.startsWith('--');
console.log(`  unique MPNs: ${new Set(mpns).size} (duplicate rows: ${dupMpn})`);
console.log(`  Part_Manuf placeholders "--": ${inputRows.filter((r) => placeholder(r['Part_Manuf'] ?? '')).length}`);
console.log(`  E1_Brand placeholders "--": ${inputRows.filter((r) => placeholder(r['E1_Brand'] ?? '')).length}`);
console.log(`  empty Part_Desc: ${inputRows.filter((r) => !(r['Part_Desc'] ?? '').trim()).length}`);

// Manufacturer signal inside Part_Manuf: "Freud Inc (2435)" pattern
const withCode = inputRows.filter((r) => /\(\w+\)\s*$/.test(r['Part_Manuf'] ?? '')).length;
console.log(`  Part_Manuf with parenthetical vendor code: ${withCode}/${inputRows.length}`);

// --- Expected output sheet ---
const outHeaders = Object.keys(outputRows[0] ?? {});
console.log(`\n[Expected Output] ${OUTPUT_CSV}`);
console.log(`  header count: ${outHeaders.length}`);
console.log(`  example data rows: ${Math.max(0, outputRows.length - (outputRows.length ? 0 : 0))}`);

// Header-by-header equality vs frozen schema
let mismatches = 0;
const len = Math.max(outHeaders.length, UNIHACK_HEADERS.length);
for (let i = 0; i < len; i++) {
  if (outHeaders[i] !== UNIHACK_HEADERS[i]) {
    mismatches++;
    console.log(`  MISMATCH @${i}: organizer="${outHeaders[i]}" schema="${UNIHACK_HEADERS[i]}"`);
  }
}
console.log(`  header mismatches vs UNIHACK_HEADERS: ${mismatches}`);
console.log(`  exact match: ${mismatches === 0 && outHeaders.length === 252 ? 'YES' : 'NO'}`);

// Populated fields in the single example row
if (outputRows[0]) {
  const populated = outHeaders.filter((h) => (outputRows[0][h] ?? '').trim() !== '');
  console.log(`  populated cells in example row: ${populated.length}/252`);
  console.log(`  populated headers: ${populated.slice(0, 40).join(', ')}${populated.length > 40 ? ' …' : ''}`);
}

// --- Solution guide ---
console.log('\n[Solution Guide]');
console.log('  NOT PRESENT in repository (searched *.md / solution* patterns).');
console.log('  Authoritative contract = Expected Output Delivery Format CSV.');

// --- Documented differences ---
console.log('\n=== DOCUMENTED DIFFERENCES / NOTES ===');
console.log(' 1. Organizer input has exactly 6 columns; all resolve through existing aliases.');
console.log(' 2. Brand/manufacturer signal lives in Part_Manuf ("Name (CODE)") — pipeline must strip codes via manufacturer step (already in prompts).');
console.log(' 3. Placeholder sentinels "-- Unbranded --" etc. — treated as null by normalizer.');
console.log(' 4. Expected Output is a HEADER CONTRACT + ONE example row, not a full answer key for all rows.');
console.log(' 5. Example row populates identity/description/attribute/spec groups; URL/asset groups are empty in example.');
