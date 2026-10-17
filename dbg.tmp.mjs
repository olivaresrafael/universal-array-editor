import { parseText, serializeData, getCsvDelimiter } from './src/parsers.js';
import { highlight } from './src/highlight.js';
import { readFileSync } from 'node:fs';

let failures = 0;
const check = (name, ok) => {
  console.log((ok ? 'OK  ' : 'FAIL') + ' ' + name);
  if (!ok) failures += 1;
};

// 1. Fixture inference
const csvText = readFileSync('tests/fixtures/sample.csv', 'utf8');
const { parsed, format } = parseText(csvText, 'auto');
check('csv detect', format === 'csv');
check('delim remembered', getCsvDelimiter() === ',');
const [r1, r2, r3] = parsed;
check('id number', r1.id === 201);
check('bool', r1.enabled === true);
check('float', r1.score === 9.5);
check('empty->""', r1.nick === '');
check('nested obj', r1.meta && r1.meta.source === 'sample');
check('quoted comma', r1.notes === 'needs "review", ok');
check('empty score/meta', r2.score === '' && r2.meta === '');
check('leading-zero stays string', r3.name === '01234');
check('TRUE->true', r3.enabled === true);
check('NULL->null', r3.nick === null);

// 2. TSV
const t = parseText(readFileSync('tests/fixtures/sample.tsv', 'utf8'), 'auto');
check('tsv detect', t.format === 'tsv');
check('tsv row', t.parsed[0].id === 301 && t.parsed[0].enabled === true);

// 3. Round-trips csv -> every format
for (const fmt of ['csv', 'tsv', 'json', 'json5', 'yaml']) {
  const out = serializeData(parsed, fmt, 'csv');
  const back = parseText(out.text, fmt === 'csv' ? 'auto' : fmt).parsed;
  check('csv->' + fmt, JSON.stringify(back) === JSON.stringify(parsed));
}

// 4. YAML must NOT be hijacked by csv sniff
for (const y of ['- id: 1\n  name: x\n- id: 2\n  name: y', 'name: x\nfoo: bar']) {
  check('yaml stays yaml', parseText(y, 'auto').format === 'yaml');
}

// 5. Single-column csv needs explicit selection
let singleAuto = 'loaded';
try { parseText('name\nfoo\nbar', 'auto'); } catch { singleAuto = 'throws'; }
check('single-col auto falls through (' + singleAuto + ')', singleAuto === 'throws');
check('single-col explicit', parseText('name\nfoo\nbar', 'csv').format === 'csv');

// 6. Header-only / JSON-as-csv errors
let headerOnly = 'loaded';
try { parseText('a,b', 'csv'); } catch { headerOnly = 'throws'; }
check('header-only throws', headerOnly === 'throws');
let jsonAsCsv = 'loaded';
try { parseText('[{"a":1}]', 'csv'); } catch { jsonAsCsv = 'throws'; }
check('json-as-csv throws', jsonAsCsv === 'throws');

// 7. Semicolon delimiter remembered for same-as-input export
const semi = parseText('a;b\n1;2\n3;4', 'csv');
check('semicolon csv', semi.format === 'csv' && semi.parsed[0].a === 1);
const semiOut = serializeData(semi.parsed, 'csv', 'csv');
check('semicolon preserved', semiOut.text.includes(';') && !semiOut.text.includes(','));

// 8. Highlight csv/tsv
const hcsv = highlight(serializeData(parsed, 'csv', 'csv').text.trimEnd(), 'csv', ',');
check('csv header keys', hcsv.includes('tok-key'));
check('csv numbers/bools', hcsv.includes('tok-number') && hcsv.includes('tok-bool'));
const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
check('csv highlight lossless', strip(hcsv) === serializeData(parsed, 'csv', 'csv').text.trimEnd());
const htsv = highlight('a\tb\n1\tx', 'tsv', '\t');
check('tsv highlight', htsv.includes('tok-key') && htsv.includes('tok-number'));
const hmulti = highlight('a,b\n"x\ny",2', 'csv', ',');
check('quoted newline safe', hmulti.includes('tok-string') && strip(hmulti).replace(/→/g, ',') !== '');

// 9. Regression: other formats still detect
check('json', parseText('[{"a":1}]', 'auto').format === 'json');
check('json5', parseText('[{a: 1,}]', 'auto').format === 'json5');
check('yaml', parseText('- a: 1\n- b: 2', 'auto').format === 'yaml');

console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
