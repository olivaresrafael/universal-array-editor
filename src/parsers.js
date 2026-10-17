import { load as loadYaml, dump as dumpYaml } from 'js-yaml';
import JSON5 from 'json5';
import Papa from 'papaparse';
import { tr } from './i18n.js';

// ParserRegistry: every format exposes { id, extensions, parse, stringify }.
// New formats (CSV, NDJSON, TOML, XML) should be added here behind the
// same interface so load/serialize code never hardcodes formats again.
export const parsers = {
  json: {
    id: 'json',
    extensions: ['.json'],
    parse: (text) => JSON.parse(text),
    stringify: (data) => `${JSON.stringify(data, null, 2)}\n`,
    mime: 'application/json;charset=utf-8',
    extension: '.json',
  },
  json5: {
    id: 'json5',
    extensions: ['.json5'],
    parse: (text) => JSON5.parse(text),
    stringify: (data) => `${JSON5.stringify(data, null, 2)}\n`,
    mime: 'application/json5;charset=utf-8',
    extension: '.json5',
  },
  yaml: {
    id: 'yaml',
    extensions: ['.yaml', '.yml'],
    parse: (text) => loadYaml(text),
    stringify: (data) => dumpYaml(data, { noRefs: true, lineWidth: -1, sortKeys: false }),
    mime: 'application/yaml;charset=utf-8',
    extension: '.yaml',
  },
  ndjson: {
    id: 'ndjson',
    extensions: ['.jsonl', '.ndjson'],
    parse: (text) => parseNdjsonText(text),
    stringify: (data) => (data.length ? `${data.map((item) => JSON.stringify(item)).join('\n')}\n` : ''),
    mime: 'application/x-ndjson;charset=utf-8',
    extension: '.jsonl',
  },
  csv: {
    id: 'csv',
    extensions: ['.csv'],
    parse: (text) => parseCsvText(text, '').parsed,
    stringify: (data) => stringifyDelimited(data, inputSourceFormatMemory.format === 'csv' ? inputSourceFormatMemory.delimiter : ','),
    mime: 'text/csv;charset=utf-8',
    extension: '.csv',
  },
  tsv: {
    id: 'tsv',
    extensions: ['.tsv'],
    parse: (text) => parseCsvText(text, '\t').parsed,
    stringify: (data) => stringifyDelimited(data, '\t'),
    mime: 'text/tab-separated-values;charset=utf-8',
    extension: '.tsv',
  },
};

// Remembers the last sniffed/forces delimiter so “Same as input” CSV exports
// keep it (e.g. `;`-separated files stay `;`-separated).
const inputSourceFormatMemory = { format: 'json', delimiter: ',' };

export function getCsvDelimiter() {
  return inputSourceFormatMemory.delimiter;
}

// Cell type policy (documented in docs/FORMATS.md):
// '' → '', true/false (any case) → boolean, null (any case) → null,
// JSON numbers (finite) → number, JSON objects/arrays → nested value,
// everything else (including '01234') stays a string.
export function inferCell(raw) {
  const cell = raw ?? '';
  if (cell === '') return '';
  if (/^(true|false)$/i.test(cell)) return cell.toLowerCase() === 'true';
  if (/^null$/i.test(cell)) return null;
  try {
    const parsed = JSON.parse(cell);
    if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch { /* Not JSON: keep the raw string. */ }
  return cell;
}

function parseDelimited(text, delimiter) {
  const result = Papa.parse(text, { delimiter, header: false, skipEmptyLines: 'greedy' });
  const rows = (result.data || []).filter((row) => Array.isArray(row));
  const detected = result.meta?.delimiter || delimiter || ',';
  return { rows, delimiter: detected };
}

function rowsToObjects(rows) {
  if (rows.length < 2) throw new Error(tr('csvNeedsRows'));
  const seen = new Map();
  const headers = rows[0].map((header, index) => {
    let name = String(header ?? '').trim();
    if (!name) name = `column_${index + 1}`;
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count === 1 ? name : `${name}_${count}`;
  });
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = inferCell(row[index] ?? '');
    });
    return obj;
  });
}

function stringifyDelimited(data, delimiter) {
  if (!data.length) return '';
  const headers = [];
  data.forEach((obj) => {
    Object.keys(obj || {}).forEach((key) => {
      if (!headers.includes(key)) headers.push(key);
    });
  });
  const cell = (value) => {
    if (value === undefined) return '';
    if (value === null) return 'null';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  const rows = [headers, ...data.map((obj) => headers.map((key) => cell(obj?.[key])))];
  return `${Papa.unparse(rows, { delimiter, newline: '\n' })}\n`;
}

export function parseText(text, preference = 'auto') {
  if (!String(text).trim()) throw new Error(tr('parseTextEmpty'));
  const chosen = preference === 'auto' ? 'auto' : preference;
  if (parsers[chosen] && chosen !== 'csv' && chosen !== 'tsv') {
    return { parsed: parsers[chosen].parse(text), format: chosen };
  }
  if (chosen === 'csv' || chosen === 'tsv') return parseCsvText(text, chosen === 'tsv' ? '\t' : '');
  // Auto-detect: strictest first so the detected format is the most specific one.
  // NDJSON needs 2+ records, otherwise a single-line JSON/JSON5 document would be
  // ambiguous with it; it is tried before CSV/TSV because a NDJSON record with
  // commas would sniff as 2+ delimited columns.
  // CSV/TSV requires 2+ columns here so YAML documents are never hijacked;
  // single-column files need an explicit CSV selection.
  try {
    return { parsed: parsers.json.parse(text), format: 'json' };
  } catch (jsonError) {
    try {
      return { parsed: parsers.json5.parse(text), format: 'json5' };
    } catch {
      try {
        if (countNdjsonRecords(text) >= 2) return { parsed: parsers.ndjson.parse(text), format: 'ndjson' };
      } catch { /* Not one JSON object per line: keep looking. */ }
      try {
        const { rows } = parseDelimited(text, '');
        if (rows.length < 2 || rows[0].length < 2) throw new Error(tr('csvNeedsRows'));
        return parseCsvText(text, '');
      } catch {
        try {
          return { parsed: parsers.yaml.parse(text), format: 'yaml' };
        } catch {
          throw jsonError;
        }
      }
    }
  }
}

// NDJSON / JSON Lines: one JSON object per line. Blank lines are ignored and
// every record must be an object, so the result satisfies assertRootArray.
// Errors report the 1-based line number.
function countNdjsonRecords(text) {
  return String(text)
    .split(/\r\n?|\n/)
    .filter((line) => line.trim()).length;
}

function parseNdjsonText(text) {
  const records = [];
  const lines = String(text).split(/\r\n?|\n/);
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error(tr('ndjsonLineInvalid', { line: index + 1 }));
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(tr('ndjsonLineNotObject', { line: index + 1 }));
    }
    records.push(value);
  });
  if (!records.length) throw new Error(tr('ndjsonEmpty'));
  return records;
}

function parseCsvText(text, forcedDelimiter) {
  const { rows, delimiter } = parseDelimited(text, forcedDelimiter);
  const format = delimiter === '\t' ? 'tsv' : 'csv';
  inputSourceFormatMemory.format = format;
  inputSourceFormatMemory.delimiter = delimiter;
  return { parsed: rowsToObjects(rows), format };
}

export function serializeData(data, outputSetting, inputSourceFormat) {
  const output = outputSetting === 'source' ? inputSourceFormat : outputSetting;
  const parser = parsers[output] ?? parsers.json;
  return { text: parser.stringify(data), format: parser.id };
}

export function resolveFilePreference(file, selectedFormat) {
  if (selectedFormat !== 'auto') return selectedFormat;
  const filename = file?.name?.toLowerCase() || '';
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.json5')) return 'json5';
  if (filename.endsWith('.jsonl') || filename.endsWith('.ndjson')) return 'ndjson';
  if (filename.endsWith('.csv')) return 'csv';
  if (filename.endsWith('.tsv')) return 'tsv';
  if (filename.endsWith('.yaml') || filename.endsWith('.yml')) return 'yaml';
  return 'auto';
}
