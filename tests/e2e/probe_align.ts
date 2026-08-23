/** Verify scenario->rowIndex alignment between generator and normalizer. */
import { buildSyntheticDataset, renderRows, toCsv } from '../synthetic/generate-dataset';
import { normalizeCsvInput, fieldValue } from '../../lib/input/input-normalizer';

const { rows, meta } = buildSyntheticDataset();
const { records, headersInOrder } = renderRows(rows);
const csvText = toCsv(records, headersInOrder);
const parsed = normalizeCsvInput(csvText);

console.log('scenario rows:', rows.length, 'csv rows parsed:', parsed.rows.length);
for (const r of parsed.rows) {
  const scen = meta.get(r.rowIndex);
  const mpn = fieldValue(r, 'mfg_part_num');
  const mfr = fieldValue(r, 'manufacturer_name');
  if (!scen || scen.startsWith('filler') || scen.startsWith('deterministic') || scen.startsWith('gemini')) continue;
  console.log(`idx=${String(r.rowIndex).padEnd(3)} scen=${(scen ?? 'MISSING').padEnd(36)} mpn=${mpn} mfr=${mfr}`);
}

// Deep-dive: what happened to fully_populated (idx 18)?
const rec18 = records[18];
console.log('\nraw record 18:', JSON.stringify(rec18, null, 0).slice(0, 400));
console.log('\nparsed row 18:', JSON.stringify(parsed.rows[18].fields, null, 0).slice(0, 500));
