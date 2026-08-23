import { parse as parseCsv } from 'csv-parse/sync';
const raw = require('fs').readFileSync('/tmp/batch_export.csv', 'utf-8');
console.log('BOM?', raw.charCodeAt(0) === 0xFEFF, '| first chars:', JSON.stringify(raw.slice(0, 40)));
const rows = parseCsv(raw, { bom: false }) as string[][];
console.log('parsed header len:', rows[0].length);
console.log('last 3 header cells:', JSON.stringify(rows[0].slice(-3)));
const ragged = rows.map((r,i)=>[i,r.length]).filter(([,l])=>l!==252);
console.log('ragged:', JSON.stringify(ragged.slice(0,5)), 'of', rows.length);
// show the row that parses long
const bad = ragged[0];
if (bad) console.log('row', bad[0], 'first cells:', JSON.stringify(rows[bad[0]].slice(0,6)), '… last:', JSON.stringify(rows[bad[0]].slice(-3)));
