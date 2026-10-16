import { load as loadYaml, dump as dumpYaml } from 'js-yaml';
import JSON5 from 'json5';
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
};

export function parseText(text, preference = 'auto') {
  if (!String(text).trim()) throw new Error(tr('parseTextEmpty'));
  const chosen = preference === 'auto' ? 'auto' : preference;
  if (parsers[chosen]) return { parsed: parsers[chosen].parse(text), format: chosen };
  // Auto-detect: strictest first so the detected format is the most specific one.
  try {
    return { parsed: parsers.json.parse(text), format: 'json' };
  } catch (jsonError) {
    try {
      return { parsed: parsers.json5.parse(text), format: 'json5' };
    } catch {
      try {
        return { parsed: parsers.yaml.parse(text), format: 'yaml' };
      } catch {
        throw jsonError;
      }
    }
  }
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
  if (filename.endsWith('.yaml') || filename.endsWith('.yml')) return 'yaml';
  return 'auto';
}
