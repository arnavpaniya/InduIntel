import { parse as parseCsv } from 'csv-parse/sync';
import { UNIHACK_HEADERS } from '../lib/unihack/output-schema';
const raw = require('fs').readFileSync('/tmp/live_export.csv', 'utf-8');
const rows = parseCsv(raw) as string[][];
console.log('header len:', rows[0].length);
for (let i = 0; i < Math.max(rows[0].length, 252); i++) {
  if (rows[0][i] !== UNIHACK_HEADERS[i]) console.log(`diff @${i}: got=${JSON.stringify(rows[0][i])} want=${JSON.stringify(UNIHACK_HEADERS[i])}`);
}
const ragged = rows.map((r, i) => [i, r.length]).filter(([, l]) => l !== 252);
console.log('ragged rows:', JSON.stringify(ragged.slice(0, 5)), `total ${ragged.length}/${rows.length}`);
