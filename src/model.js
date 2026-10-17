import { tr } from './i18n.js';

export const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

export const kind = (value) => (value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value);

export const firstUsable = (values) => values.find((value) => value !== undefined && value !== null);

export function fieldSamples(array) {
  const keys = [];
  array.forEach((obj) => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.keys(obj).forEach((key) => {
        if (!keys.includes(key)) keys.push(key);
      });
    }
  });
  return keys.map((key) => {
    const values = array
      .filter((obj) => obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key))
      .map((obj) => obj[key]);
    let sample = firstUsable(values);
    if (values.some(Array.isArray)) {
      const nonempty = values.find((value) => Array.isArray(value) && value.length > 0);
      if (nonempty && (!Array.isArray(sample) || sample.length === 0)) sample = nonempty;
    }
    if (sample === undefined) sample = values.some((value) => value === null) ? null : '';
    return { key, type: kind(sample), sample: clone(sample) };
  });
}

export function blankFor(sample, depth = 0) {
  if (depth > 12) return '';
  if (Array.isArray(sample)) return [];
  if (sample && typeof sample === 'object') {
    const result = {};
    Object.keys(sample).forEach((key) => {
      result[key] = blankFor(sample[key], depth + 1);
    });
    return result;
  }
  if (typeof sample === 'boolean') return false;
  if (typeof sample === 'number') return '';
  if (sample === null) return null;
  return '';
}

export function validateValue(value, sample, path) {
  if (value === null) return null;
  const type = kind(sample);
  if (type === 'number') {
    if (value === '' || value === null || value === undefined || !Number.isFinite(Number(value))) {
      throw new Error(tr('invalidNumber', { path }));
    }
    return Number(value);
  }
  if (type === 'boolean') {
    // Form controls give real booleans, but raw text inputs arrive as strings,
    // where Boolean('false') would wrongly mean true.
    if (typeof value === 'string') return value !== '' && value !== 'false' && value !== '0';
    return Boolean(value);
  }
  if (type === 'array') {
    if (!Array.isArray(value)) throw new Error(tr('invalidArray', { path }));
    const prototype = sample.find((item) => item !== null && item !== undefined);
    return value.map((item, index) => {
      const schemaAtIndex = sample[index] !== undefined ? sample[index] : prototype;
      const actualType = kind(item);
      const itemSample =
        item !== '' && item !== null && item !== undefined && schemaAtIndex !== undefined && actualType !== kind(schemaAtIndex)
          ? item
          : schemaAtIndex;
      return itemSample === undefined ? clone(item) : validateValue(item, itemSample, `${path}[${index + 1}]`);
    });
  }
  if (type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(tr('invalidObject', { path }));
    const output = {};
    Object.keys(value).forEach((key) => {
      output[key] = Object.prototype.hasOwnProperty.call(sample, key)
        ? validateValue(value[key], sample[key], `${path}.${key}`)
        : clone(value[key]);
    });
    return output;
  }
  if (type === 'null') return value === null || value === '' ? null : value;
  return value === undefined || value === null ? '' : String(value);
}

export function assertRootArray(parsed) {
  if (!Array.isArray(parsed)) throw new Error(tr('invalidRoot'));
  if (parsed.some((item) => item === null || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error(tr('invalidItems'));
  }
}
