// Node test suite for the pure modules of the editor (parsers, model, highlight,
// i18n). Run with `pnpm test`. Browser-only behavior (rendering, drag and drop,
// the item modal, downloads) is still covered manually by docs/TESTING.md.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  parseText,
  serializeData,
  getCsvDelimiter,
  resolveFilePreference,
  fidelityNoteKey,
  inferCell,
  parsers,
} from '../src/parsers.js';
import { assertRootArray, fieldSamples, blankFor, validateValue, clone, kind } from '../src/model.js';
import { highlight, escapeHtml, highlightJson } from '../src/highlight.js';
import { translations, tr, setLanguage, getLanguage } from '../src/i18n.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, 'fixtures', name), 'utf8');

// --- tiny harness -----------------------------------------------------------

let failures = 0;
let checks = 0;
let group = '';

const describe = (name, fn) => {
  group = name;
  fn();
  group = '';
};

const check = (name, ok) => {
  checks += 1;
  if (ok) return;
  failures += 1;
  console.error(`FAIL [${group}] ${name}`);
};

const eq = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(name, ok);
  if (!ok) {
    console.error(`      expected: ${JSON.stringify(expected)}`);
    console.error(`      actual:   ${JSON.stringify(actual)}`);
  }
};

const throws = (name, fn) => {
  checks += 1;
  try {
    fn();
    failures += 1;
    console.error(`FAIL [${group}] ${name} (expected an error)`);
  } catch {
    /* expected */
  }
};

const throwsMessage = (name, fn, expectedMessage) => {
  checks += 1;
  try {
    fn();
    failures += 1;
    console.error(`FAIL [${group}] ${name} (expected an error)`);
  } catch (error) {
    if (error.message !== expectedMessage) {
      failures += 1;
      console.error(`FAIL [${group}] ${name}`);
      console.error(`      expected message: ${expectedMessage}`);
      console.error(`      actual message:   ${error.message}`);
    }
  }
};

// --- parsers: registry ------------------------------------------------------

describe('registry', () => {
  eq('every parser exposes the interface', Object.values(parsers).every((p) => p.id && p.parse && p.stringify && p.mime && p.extension), true);
  eq('parser ids match keys', Object.entries(parsers).every(([key, p]) => key === p.id), true);
  eq('supported formats', Object.keys(parsers).sort(), ['csv', 'json', 'json5', 'ndjson', 'tsv', 'yaml']);
});

// --- parsers: fixtures ------------------------------------------------------

describe('fixture detection', () => {
  eq('json', parseText(fixture('sample.json'), 'auto').format, 'json');
  eq('json5', parseText(fixture('sample.json5'), 'auto').format, 'json5');
  eq('yaml', parseText(fixture('sample.yaml'), 'auto').format, 'yaml');
  eq('ndjson', parseText(fixture('sample.jsonl'), 'auto').format, 'ndjson');
  eq('csv', parseText(fixture('sample.csv'), 'auto').format, 'csv');
  eq('tsv', parseText(fixture('sample.tsv'), 'auto').format, 'tsv');
  eq('json fixture content', parseText(fixture('sample.json'), 'auto').parsed[0].tags, ['one', 'two']);
  eq('yaml fixture content', parseText(fixture('sample.yaml'), 'auto').parsed[1].meta.labels, []);
  eq('json5 fixture content', parseText(fixture('sample.json5'), 'auto').parsed[0].enabled, true);
});

describe('explicit format selection', () => {
  eq('force json on valid json', parseText(fixture('sample.json'), 'json').format, 'json');
  throws('force json on json5 fixture', () => parseText(fixture('sample.json5'), 'json'));
  throws('force json5 on invalid text', () => parseText('[{a:', 'json5'));
  eq('force yaml on yaml text', parseText(fixture('sample.yaml'), 'yaml').format, 'yaml');
  eq('force csv on csv text', parseText(fixture('sample.csv'), 'csv').format, 'csv');
  eq('force tsv forces tab delimiter', parseText(fixture('sample.csv'), 'tsv').format, 'tsv');
  throws('force json on invalid json', () => parseText('{bad', 'json'));
});

// --- parsers: root validation ----------------------------------------------

describe('root array rules', () => {
  throws('mapping root', () => assertRootArray(parseText(fixture('invalid-root.yaml'), 'yaml').parsed));
  throwsMessage('mapping root message', () => assertRootArray(parseText(fixture('invalid-root.yaml'), 'yaml').parsed), translations.en.invalidRoot);
  throws('scalar items', () => assertRootArray([1, 2]));
  throws('null items', () => assertRootArray([{ a: 1 }, null]));
  throws('nested array items', () => assertRootArray([[1], [2]]));
  check('empty array is valid', (() => { assertRootArray([]); return true; })());
  check('object array is valid', (() => { assertRootArray([{ a: 1 }]); return true; })());
  throwsMessage('empty text', () => parseText('   '), translations.en.parseTextEmpty);
});

// --- parsers: csv/tsv cell policy -----------------------------------------

describe('csv cell types', () => {
  eq('integer', inferCell('201'), 201);
  eq('float', inferCell('9.5'), 9.5);
  eq('exponent', inferCell('1e3'), 1000);
  eq('negative', inferCell('-7'), -7);
  eq('true any case', inferCell('TRUE'), true);
  eq('false any case', inferCell('False'), false);
  eq('null any case', inferCell('NULL'), null);
  eq('empty cell', inferCell(''), '');
  eq('undefined cell', inferCell(undefined), '');
  eq('leading zero stays string', inferCell('01234'), '01234');
  eq('not-a-number stays string', inferCell('12abc'), '12abc');
  eq('json object cell', inferCell('{"source":"sample"}'), { source: 'sample' });
  eq('json array cell', inferCell('[1,2]'), [1, 2]);
  eq('quoted stays string', inferCell('"true"'), '"true"');
  eq('word true with text stays string', inferCell('true story'), 'true story');
});

describe('csv fixture rows', () => {
  const { parsed } = parseText(fixture('sample.csv'), 'auto');
  eq('row count', parsed.length, 3);
  eq('header keys', Object.keys(parsed[0]), ['id', 'name', 'enabled', 'score', 'nick', 'meta', 'notes']);
  eq('number cell', parsed[0].id, 201);
  eq('bool cell', parsed[0].enabled, true);
  eq('float cell', parsed[0].score, 9.5);
  eq('empty cell', parsed[0].nick, '');
  eq('nested object cell', parsed[0].meta, { source: 'sample' });
  eq('escaped quotes', parsed[0].notes, 'needs "review", ok');
  eq('missing cells', [parsed[1].score, parsed[1].meta], ['', '']);
  eq('leading zero kept', parsed[2].name, '01234');
  eq('TRUE uppercased', parsed[2].enabled, true);
  eq('NULL maps to null', parsed[2].nick, null);
});

describe('csv headers', () => {
  eq('trimmed', parseText(' a , b \n1,2', 'csv').parsed[0], { a: 1, b: 2 });
  eq('empty header named', Object.keys(parseText('a,,b\n1,2,3', 'csv').parsed[0]), ['a', 'column_2', 'b']);
  eq('duplicate headers suffixed', Object.keys(parseText('name,name,name\n1,2,3', 'csv').parsed[0]), ['name', 'name_2', 'name_3']);
  eq('cells beyond header ignored', parseText('a,b\n1,2,3', 'csv').parsed[0], { a: 1, b: 2 });
  eq('header union on export is first-seen order', (() => {
    const { text } = serializeData([{ b: 1, a: 2 }, { c: 3, a: 4 }], 'csv', 'csv');
    return text.split('\n')[0];
  })(), 'b,a,c');
});

describe('csv shape rules', () => {
  throws('header only', () => parseText('a,b', 'csv'));
  throws('json text as csv', () => parseText('[{"a":1}]', 'csv'));
  // A single-column table is not detected as CSV (YAML would be hijacked), so
// auto-detect falls through to YAML and the root-array rule rejects it.
eq('single column not detected as csv', parseText('name\nfoo\nbar', 'auto').format, 'yaml');
  throws('single column rejected by root rule', () => assertRootArray(parseText('name\nfoo\nbar', 'auto').parsed));
  eq('single column with explicit csv', parseText('name\nfoo\nbar', 'csv').parsed, [{ name: 'foo' }, { name: 'bar' }]);
  eq('semicolon delimiter sniffed', parseText('a;b\n1;2\n3;4', 'csv').parsed, [{ a: 1, b: 2 }, { a: 3, b: 4 }]);
});

describe('csv export keeps sniffed delimiter', () => {
  const { parsed } = parseText('a;b\n1;2\n3;4', 'csv');
  eq('delimiter remembered', getCsvDelimiter(), ';');
  const { text } = serializeData(parsed, 'csv', 'csv');
  check('uses semicolons', text.includes(';') && !text.includes(','));
  eq('round-trips', parseText(text, 'csv').parsed, parsed);
});

describe('yaml is never hijacked by csv sniffing', () => {
  eq('list of mappings', parseText('- id: 1\n  name: x\n- id: 2\n  name: y', 'auto').format, 'yaml');
  eq('single mapping', parseText('name: x\nfoo: bar', 'auto').format, 'yaml');
  eq('nested mapping', parseText('root:\n  a: 1\n  b: 2', 'auto').format, 'yaml');
});

describe('tsv', () => {
  const { parsed, format } = parseText(fixture('sample.tsv'), 'auto');
  eq('detected as tsv', format, 'tsv');
  eq('first row', parsed[0], { id: 301, name: 'Third item', enabled: true });
  eq('lowercase bool', parsed[1].enabled, false);
  eq('delimiter remembered', getCsvDelimiter(), '\t');
});

// --- parsers: ndjson --------------------------------------------------------

describe('ndjson records', () => {
  const { parsed, format } = parseText(fixture('sample.jsonl'), 'auto');
  eq('detected', format, 'ndjson');
  eq('record count', parsed.length, 3);
  eq('nested object record', parsed[0].payload, { user: 'alice', retries: 0 });
  eq('booleans kept', parsed[1].ok, false);
  eq('arrays kept', parsed[2].tags, ['a', 'b']);
  eq('blank lines ignored', parseText('{"a":1}\n\n\n{"a":2}\n', 'ndjson').parsed, [{ a: 1 }, { a: 2 }]);
  eq('crlf line endings', parseText('{"a":1}\r\n{"a":2}\r\n', 'ndjson').parsed, [{ a: 1 }, { a: 2 }]);
  eq('no trailing newline', parseText('{"a":1}\n{"a":2}', 'ndjson').parsed.length, 2);
  eq('nested objects are allowed', parseText('{"a":{"b":{"c":1}}}\n{"a":{"b":2}}\n', 'ndjson').parsed[0].a.b.c, 1);
});

describe('ndjson errors report the line', () => {
  throwsMessage('invalid json line 2', () => parseText('{"a":1}\n{"a":}\n{"a":3}', 'ndjson'), 'Line 2 is not valid JSON. NDJSON needs one complete JSON object per line.');
  throwsMessage('line number counts blank lines', () => parseText('{"a":1}\n\n{"a":}\n', 'ndjson'), 'Line 3 is not valid JSON. NDJSON needs one complete JSON object per line.');
  throwsMessage('array line rejected', () => parseText('{"a":1}\n[1,2]', 'ndjson'), 'Line 2 must be a JSON object, not a number, string, null, or array.');
  throwsMessage('scalar line rejected', () => parseText('{"a":1}\n42', 'ndjson'), 'Line 2 must be a JSON object, not a number, string, null, or array.');
  throwsMessage('null line rejected', () => parseText('null\n42', 'ndjson'), 'Line 1 must be a JSON object, not a number, string, null, or array.');
  // Whitespace-only input is rejected before format parsing, which is the shared
  // guard for every format.
  throwsMessage('only blank lines', () => parseText('\n\n', 'ndjson'), 'Paste JSON, JSON5, NDJSON, YAML, or CSV text first.');
  eq('spanish message is used in spanish mode', (() => {
    setLanguage('es');
    try {
      return (() => {
        try { parseText('{"a":}\n{"b":2}', 'ndjson'); return 'no error'; } catch (error) { return error.message; }
      })();
    } finally { setLanguage('en'); }
  })(), 'La línea 1 no es JSON válido. NDJSON necesita un objeto JSON completo por línea.');
});

describe('ndjson detection boundaries', () => {
  eq('single record is ambiguous with json', parseText('{"a":1}', 'auto').format, 'json');
  eq('single record with trailing comma is json5', parseText('{"a":1,}', 'auto').format, 'json5');
  eq('single record forced as ndjson', parseText('{"a":1}', 'ndjson').parsed, [{ a: 1 }]);
  eq('two records are ndjson, not yaml', parseText('{"a":1}\n{"a":2}', 'auto').format, 'ndjson');
  eq('commas inside records do not sniff as csv', parseText('{"a":1,"b":2}\n{"a":3,"b":4}', 'auto').format, 'ndjson');
  eq('yaml list of objects is still yaml', parseText('- a: 1\n- a: 2', 'auto').format, 'yaml');
  eq('yaml nested document is still yaml', parseText('root:\n  a: 1\n  b: 2', 'auto').format, 'yaml');
  eq('json array is still json', parseText('[{"a":1},{"a":2}]', 'auto').format, 'json');
  eq('csv is still csv', parseText('a,b\n1,2\n3,4', 'auto').format, 'csv');
});

describe('ndjson output', () => {
  const data = [{ id: 1, name: 'First' }, { id: 2, name: 'Second' }];
  const { text, format } = serializeData(data, 'ndjson', 'json');
  eq('format reported', format, 'ndjson');
  eq('one compact record per line', text, '{"id":1,"name":"First"}\n{"id":2,"name":"Second"}\n');
  // A newline inside a value is escaped, so one record stays on one line.
  eq('embedded newline is escaped', serializeData([{ a: 'x\ny' }], 'ndjson', 'json').text, '{"a":"x\\ny"}\n');
  eq('re-parses to the same records', parseText(text, 'auto').parsed, data);
  eq('same as input keeps ndjson', serializeData(data, 'source', 'ndjson').format, 'ndjson');
});

// --- parsers: serialization -------------------------------------------------

describe('round-trips', () => {
  const sources = {
    json: fixture('sample.json'),
    json5: fixture('sample.json5'),
    ndjson: fixture('sample.jsonl'),
    yaml: fixture('sample.yaml'),
    csv: fixture('sample.csv'),
    tsv: fixture('sample.tsv'),
  };
  // CSV/TSV export writes an empty cell for a missing field, so records that
  // do not share the same keys do not round-trip back to the exact same shape.
  const headersOf = (data) => [...new Set(data.flatMap((obj) => Object.keys(obj)))];
  const normalizeForDelimited = (data) => {
    const headers = headersOf(data);
    return data.map((obj) => Object.fromEntries(headers.map((key) => [key, key in obj ? obj[key] : ''])));
  };
  for (const [format, text] of Object.entries(sources)) {
    const data = parseText(text, 'auto').parsed;
    for (const target of ['json', 'json5', 'ndjson', 'yaml', 'csv', 'tsv']) {
      const out = serializeData(data, target, format);
      const back = parseText(out.text, target === 'csv' || target === 'ndjson' ? 'auto' : target).parsed;
      const expected = target === 'csv' || target === 'tsv' ? normalizeForDelimited(data) : data;
      eq(`${format} -> ${target}`, back, expected);
    }
  }
});

describe('serialize metadata', () => {
  const data = [{ id: 1 }];
  eq('explicit format', serializeData(data, 'yaml', 'json').format, 'yaml');
  eq('same as input', serializeData(data, 'source', 'yaml').format, 'yaml');
  eq('unknown format falls back to json', serializeData(data, 'nope', 'json').format, 'json');
  eq('json ends with newline', serializeData(data, 'json', 'json').text.endsWith('\n'), true);
  eq('empty array exports empty csv', serializeData([], 'csv', 'csv').text, '');
  eq('empty array exports empty ndjson', serializeData([], 'ndjson', 'ndjson').text, '');
  eq('empty array exports empty json', serializeData([], 'json', 'json').text, '[]\n');
});

describe('csv export of special values', () => {
  const data = [{ keep: 1, nested: { a: 1 }, list: [1, 2], nothing: null }];
  const { text } = serializeData(data, 'csv', 'csv');
  check('nested object as json cell', text.includes('"{""a"":1}"'));
  check('list as json cell', text.includes('"[1,2]"'));
  check('null as literal null', text.includes(',null'));
  eq('missing fields become empty cells', parseText(text, 'csv').parsed[0].nothing, null);
  eq('extra keys become columns', parseText(serializeData([{ a: 1 }, { a: 2, b: 3 }], 'csv', 'csv').text, 'csv').parsed[1], { a: 2, b: 3 });
});

// --- parsers: file preference ---------------------------------------------

describe('file preference', () => {
  const name = (fileName) => resolveFilePreference({ name: fileName }, 'auto');
  eq('.json', name('data.json'), 'json');
  eq('.json5', name('data.json5'), 'json5');
  eq('.csv', name('data.csv'), 'csv');
  eq('.tsv', name('data.tsv'), 'tsv');
  eq('.yaml', name('data.yaml'), 'yaml');
  eq('.yml', name('data.yml'), 'yaml');
  eq('uppercase extension', name('DATA.JSON'), 'json');
  eq('.txt stays auto', name('data.txt'), 'auto');
  eq('.jsonl', name('data.jsonl'), 'ndjson');
  eq('.ndjson', name('data.ndjson'), 'ndjson');
  eq('unknown extension stays auto', name('data.bin'), 'auto');
  eq('explicit selection wins', resolveFilePreference({ name: 'data.json' }, 'yaml'), 'yaml');
});

// --- parsers: fidelity warnings ---------------------------------------------

describe('fidelity warnings', () => {
  eq('yaml warns about comments', fidelityNoteKey('yaml'), 'fidelityYAML');
  eq('json5 warns about comments', fidelityNoteKey('json5'), 'fidelityJSON5');
  eq('csv warns about normalization', fidelityNoteKey('csv'), 'fidelityCSV');
  eq('tsv shares the csv warning', fidelityNoteKey('tsv'), 'fidelityCSV');
  eq('json loses nothing but whitespace', fidelityNoteKey('json'), null);
  eq('ndjson loses nothing but whitespace', fidelityNoteKey('ndjson'), null);
  eq('unknown format warns about nothing', fidelityNoteKey('nope'), null);
  // Every warning key must exist in both languages.
  eq('warnings are translated', ['fidelityYAML', 'fidelityJSON5', 'fidelityCSV']
    .every((key) => Boolean(translations.en[key]) && Boolean(translations.es[key])), true);
  // The warning must describe the loss that actually happens.
  check('yaml really drops comments', !serializeData([{ a: 1 }], 'yaml', 'json').text.includes('#'));
  check('json5 really drops comments', !serializeData([{ a: 1 }], 'json5', 'json').text.includes('//'));
});

// --- model ------------------------------------------------------------------

describe('model: fieldSamples', () => {
  const fields = fieldSamples([{ id: 1, tags: [] }, { id: 2, tags: ['a'], extra: null }]);
  eq('union of keys in first-seen order', fields.map((f) => f.key), ['id', 'tags', 'extra']);
  eq('types inferred', fields.map((f) => f.type), ['number', 'array', 'null']);
  eq('nonempty array used as sample', fields[1].sample, ['a']);
  eq('empty array input', fieldSamples([]), []);
  eq('ignores non-objects', fieldSamples([null, 'x', { a: 1 }]).map((f) => f.key), ['a']);
  eq('undefined falls back to empty string', fieldSamples([{ a: undefined }])[0].sample, '');
  eq('samples are clones', (() => {
    const [field] = fieldSamples([{ list: [1] }]);
    field.sample.push(2);
    return fieldSamples([{ list: [1] }])[0].sample;
  })(), [1]);
});

describe('model: blankFor', () => {
  eq('number', blankFor(1), '');
  eq('string', blankFor('a'), '');
  eq('boolean', blankFor(true), false);
  eq('null', blankFor(null), null);
  eq('array', blankFor([1, 2]), []);
  eq('object', blankFor({ a: 1, b: { c: 2 } }), { a: '', b: { c: '' } });
  eq('depth limit', blankFor(Array.from({ length: 20 }, () => 'x')).length, 0);
});

describe('model: validateValue', () => {
  eq('number coercion', validateValue('42', 1, 'n'), 42);
  eq('boolean coercion', validateValue('false', true, 'b'), false);
  eq('boolean true string', validateValue('true', true, 'b'), true);
  eq('boolean real value', validateValue(false, true, 'b'), false);
  eq('string passthrough', validateValue(' x ', 'y', 's'), ' x ');
  eq('null accepted', validateValue(null, 1, 'n'), null);
  // Array rows keep their own type when it differs from the sample, so a string
// inside a number array is not silently coerced (and vice versa).
eq('array items keep own type', validateValue(['1', 2], [1, 2], 'a'), ['1', 2]);
  eq('array items follow sample type', validateValue([1, 2], [1, 2], 'a'), [1, 2]);
  eq('nested array', validateValue([[1]], [[1]], 'a'), [[1]]);
  eq('array extends past sample', validateValue([1, 2, 3], [1], 'a'), [1, 2, 3]);
  eq('object passthrough', validateValue({ a: '1' }, { a: 1 }, 'o'), { a: 1 });
  eq('unknown object keys cloned', validateValue({ z: 5 }, { a: 1 }, 'o'), { z: 5 });
  eq('null sample keeps null', validateValue('', null, 'o'), null);
  throwsMessage('invalid number', () => validateValue('abc', 1, 'n'), 'Field “n” must be a valid number.');
  throwsMessage('empty number is invalid', () => validateValue('', 1, 'age'), 'Field “age” must be a valid number.');
  throwsMessage('array expected', () => validateValue('nope', [1], 'tags'), 'Field “tags” must be an array.');
  throwsMessage('object expected', () => validateValue('[1]', { a: 1 }, 'meta'), 'Field “meta” must be an object.');
  throwsMessage('nested path in message', () => validateValue({ a: 'x' }, { a: 1 }, 'meta'), 'Field “meta.a” must be a valid number.');
  throwsMessage('nested array path in message', () => validateValue([{ a: 'x' }], [{ a: 1 }], 'rows'), 'Field “rows[1].a” must be a valid number.');
});

describe('model: helpers', () => {
  eq('kind null', kind(null), 'null');
  eq('kind array', kind([]), 'array');
  eq('kind object', kind({}), 'object');
  eq('kind string', kind(''), 'string');
  eq('clone undefined', clone(undefined), undefined);
  eq('clone deep', (() => { const source = { a: [1] }; const copy = clone(source); copy.a.push(2); return source.a; })(), [1]);
});

// --- highlight --------------------------------------------------------------

const stripHtml = (html) => html
  .replace(/<[^>]+>/g, '')
  .replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

describe('highlight: escaping', () => {
  eq('escapes markup', escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  eq('escapes ampersand first', escapeHtml('a & <b>'), 'a &amp; &lt;b&gt;');
  check('no raw tag survives', !/<(?!\/?span)/.test(highlight('{"a":"<script>"}', 'json')));
  check('escaped script tag only', highlight('{"a":"<script>"}', 'json').includes('&lt;script&gt;'));
});

describe('highlight: json', () => {
  const html = highlight('{"a":1,"b":"x","c":true,"d":null}', 'json');
  check('keys include their colon', html.includes('<span class="tok-key">&quot;a&quot;:</span>'));
  check('strings', html.includes('<span class="tok-string">&quot;x&quot;</span>'));
  check('numbers', html.includes('<span class="tok-number">1</span>'));
  check('booleans', html.includes('<span class="tok-bool">true</span>'));
  check('null', html.includes('<span class="tok-null">null</span>'));
  eq('lossless', stripHtml(html), '{"a":1,"b":"x","c":true,"d":null}');
  eq('json5 bare keys', stripHtml(highlight('{a: 1}', 'json')), '{a: 1}');
  check('json5 bare key token', highlight('{a: 1}', 'json').includes('tok-key'));
  eq('json5 single quotes', stripHtml(highlight("{a: 'x'}", 'json')), "{a: 'x'}");
});

describe('highlight: yaml', () => {
  const html = highlight('- id: 1\n  name: First item # note\n', 'yaml');
  check('key', html.includes('<span class="tok-key">id</span>'));
  check('number', html.includes('tok-number'));
  check('comment', html.includes('tok-comment'));
  check('list dash', html.includes('<span class="tok-punct">-</span>'));
  eq('lossless', stripHtml(html), '- id: 1\n  name: First item # note\n');
  eq('null value', stripHtml(highlight('a: null\n', 'yaml')), 'a: null\n');
  check('yaml bool words', highlight('a: yes\n', 'yaml').includes('tok-bool'));
});

describe('highlight: delimited', () => {
  const csv = 'id,name,enabled\n201,First,true\n';
  const html = highlight(csv, 'csv', ',');
  check('header as keys', html.includes('<span class="tok-key">name</span>'));
  check('comma punctuation', html.includes('<span class="tok-punct">,</span>'));
  check('number cell', html.includes('tok-number'));
  check('bool cell', html.includes('tok-bool'));
  // The trailing newline is not part of the highlighted rows.
  eq('lossless', stripHtml(html), csv.trimEnd());
  check('tsv uses arrow for tab', highlight('a\tb\n', 'tsv').includes('<span class="tok-punct">→</span>'));
  const multiline = 'a,b\n"x\ny",2\n';
  eq('quoted newline kept in one row', stripHtml(highlight(multiline, 'csv', ',')), multiline.trimEnd());
  const quoted = 'a\n"he said ""hi"""\n';
  eq('escaped quotes kept', stripHtml(highlight(quoted, 'csv', ',')), quoted.trimEnd());
  eq('null cell token', highlight('a\nnull\n', 'csv', ',').includes('tok-null'), true);
});

describe('highlight: ndjson', () => {
  const jsonl = '{"id":1,"ok":true}\n{"id":2,"ok":false}\n';
  const html = highlight(jsonl, 'ndjson');
  check('keys', html.includes('tok-key'));
  check('booleans', html.includes('tok-bool'));
  check('line structure preserved', html.split('\n').length === jsonl.trimEnd().split('\n').length);
  eq('lossless', stripHtml(html), jsonl.trimEnd());
  eq('matches per-line json highlighting', html, jsonl.trimEnd().split('\n').map((line) => highlightJson(line)).join('\n'));
  eq('injection safe', stripHtml(highlight('{"a":"<script>"}\n{"a":"<script>"}', 'ndjson')), '{"a":"<script>"}\n{"a":"<script>"}');
  check('no raw script tag', !/<script/.test(highlight('{"a":"<script>alert(1)</script>"}\n{"b":1}', 'ndjson')));
});

describe('highlight: dispatch', () => {
  const { text } = serializeData([{ a: 1 }], 'yaml', 'json');
  eq('trims no yaml output', stripHtml(highlight(text, 'yaml')).trim(), text.trim());
  eq('unknown format falls back to json', stripHtml(highlight('{"a":1}', 'nope')), '{"a":1}');
});

// --- i18n -------------------------------------------------------------------

describe('i18n', () => {
  const en = Object.keys(translations.en).sort();
  const es = Object.keys(translations.es).sort();
  eq('same key set', es, en);
  const missing = en.filter((key) => !translations.es[key]);
  eq('no empty spanish translations', missing, []);
  eq('language defaults to en', getLanguage(), 'en');
  setLanguage('es');
  eq('switch to es', getLanguage(), 'es');
  eq('spanish lookup', tr('addItemButton'), translations.es.addItemButton);
  eq('spanish error', tr('invalidNumber', { path: 'age' }), 'El campo «age» debe ser un número válido.');
  setLanguage('en');
  eq('switch back to en', getLanguage(), 'en');
  eq('interpolates values', tr('itemDeleted'), 'Item deleted.');
  eq('interpolates index', tr('confirmDelete', { index: 3 }), 'Delete item 3?');
  eq('falls back to en for unknown key', tr('nopeNotAKey'), 'nopeNotAKey');
  eq('csv error exists in both languages', [translations.en.csvNeedsRows, translations.es.csvNeedsRows].every(Boolean), true);
});

// --- summary ----------------------------------------------------------------

console.log(`${checks} checks, ${failures} failure(s)`);
if (failures) {
  console.error(`${failures} FAILURE(S)`);
  process.exit(1);
}
console.log('ALL PASS');