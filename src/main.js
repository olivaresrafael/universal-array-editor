import './style.css';
import { getLanguage, setLanguage, tr } from './i18n.js';
import { parseText, serializeData, resolveFilePreference, parsers, getCsvDelimiter, fidelityNoteKey } from './parsers.js';
import { clone, kind, firstUsable, fieldSamples, blankFor, validateValue, assertRootArray } from './model.js';
import { initViewTabs } from './views.js';
import { highlight } from './highlight.js';
import { initItemModal } from './modal.js';

const CONFIG = {
  supportLinks: {
    paypal: '', // Example: https://paypal.me/YOUR_USERNAME
    koFi: '', // Example: https://ko-fi.com/YOUR_USERNAME
    other: '',
  },
};

const $ = (id) => document.getElementById(id);
let data = [];
let fields = [];
let editIndex = null;
let draggedIndex = null;
let suppressClick = false;
let fileBaseName = 'array-edited';
let loaded = false;
let rawObjectMode = false;
let rootEditors = [];
let inputSourceFormat = 'json';
let lastStatus = { key: 'readyStatus', type: '' };
let rawDirty = false;
let prettyEditing = false;

const makeLabel = (key) => String(key).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (s) => s.toUpperCase());
const status = (message, type = '', key = null, values = {}) => {
  lastStatus = key ? { key, type, values } : { message, type };
  $('status').textContent = message;
  $('status').className = `status${type ? ` ${type}` : ''}`;
};
const setStatus = (key, type = '', values = {}) => status(tr(key, values), type, key, values);

function captureFormDraft() {
  if (!loaded) return null;
  if (rawObjectMode) return { rawObjectText: $('rawObject')?.value ?? '' };
  const values = {};
  rootEditors.forEach((editor) => { values[editor.key] = clone(editor.get()); });
  return { values };
}

function currentOutput() {
  try {
    return serializeData(data, $('outputFormat').value, inputSourceFormat);
  } catch {
    return { text: '', format: 'json' };
  }
}

const formatLabel = (format) => ({ json: 'JSON', json5: 'JSON5', ndjson: 'NDJSON', yaml: 'YAML', csv: 'CSV', tsv: 'TSV' }[format] ?? String(format).toUpperCase());

// Formats that cannot round-trip the source document lose comments or
// formatting on export. The note follows the effective download format, so it
// appears when the user switches output to YAML, JSON5, or CSV/TSV.
function refreshFidelityNote() {
  const note = $('fidelityNote');
  if (!note) return;
  const key = loaded ? fidelityNoteKey(currentOutput().format) : null;
  note.hidden = !key;
  note.textContent = key ? tr(key) : '';
}

function refreshDownloadBtn() {
  if (!loaded) {
    $('downloadBtn').textContent = tr('downloadOutput');
    return;
  }
  $('downloadBtn').textContent = tr('downloadOutputFormat', { format: formatLabel(currentOutput().format) });
}

function syncPretty() {
  const output = $('prettyOutput');
  if (!output || prettyEditing) return;
  if (!loaded) {
    output.textContent = tr('prettyEmpty');
    $('copyPrettyBtn').disabled = true;
    $('editPrettyBtn').disabled = true;
    return;
  }
  try {
    const current = currentOutput();
    output.innerHTML = highlight(current.text.trimEnd(), current.format, getCsvDelimiter());
    $('copyPrettyBtn').disabled = false;
    $('editPrettyBtn').disabled = false;
  } catch {
    output.textContent = '';
    $('copyPrettyBtn').disabled = true;
    $('editPrettyBtn').disabled = true;
  }
}

function enterPrettyEdit() {
  if (!loaded || prettyEditing) return;
  prettyEditing = true;
  try {
    $('prettyEditor').value = currentOutput().text;
  } catch {
    $('prettyEditor').value = '';
  }
  $('prettyOutput').hidden = true;
  $('prettyEditWrap').hidden = false;
  $('copyPrettyBtn').disabled = true;
  $('editPrettyBtn').disabled = true;
  $('prettyEditor').focus();
}

function exitPrettyEdit() {
  prettyEditing = false;
  $('prettyOutput').hidden = false;
  $('prettyEditWrap').hidden = true;
  syncPretty();
}

function refreshInputFormatLabel() {
  const auto = document.querySelector('#inputFormat option[value="auto"]');
  if (!auto) return;
  const showDetected = $('inputFormat').value === 'auto' && loaded;
  const formatKeys = { yaml: 'formatYAML', json5: 'formatJSON5', ndjson: 'formatNDJSON', csv: 'formatCSV', tsv: 'formatTSV' };
  const formatKey = formatKeys[inputSourceFormat] ?? 'formatJSON';
  auto.textContent = tr('autoDetect') + (showDetected ? ` (${tr(formatKey)})` : '');
}

function syncRaw(force = false) {
  const editor = $('rawEditor');
  if (!editor) return;
  if (!loaded) {
    editor.value = '';
    editor.placeholder = '[]';
    rawDirty = false;
    return;
  }
  if (rawDirty && !force) return;
  try {
    editor.value = currentOutput().text;
  } catch {
    editor.value = '';
  }
  rawDirty = false;
}

function applyTranslations(draft = null) {
  document.documentElement.lang = getLanguage();
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.dataset.i18n;
    const translation = tr(key);
    if (translation !== key) {
      if (translation.includes('<br>')) node.innerHTML = translation;
      else node.textContent = translation;
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    const key = node.dataset.i18nPlaceholder;
    const translation = tr(key);
    if (translation !== key) node.placeholder = translation;
  });
  $('searchInput').setAttribute('aria-label', tr('searchAria'));
  $('languageSelect').setAttribute('aria-label', tr('language'));
  $('languageSelect').value = getLanguage();
  if (lastStatus.key) $('status').textContent = tr(lastStatus.key, lastStatus.values || {});
  else if (lastStatus.message) $('status').textContent = lastStatus.message;
  $('status').className = `status${lastStatus.type ? ` ${lastStatus.type}` : ''}`;
  if (loaded) {
    const activeDraft = draft?.values ?? (editIndex === null ? null : data[editIndex]);
    renderForm(activeDraft);
    if (draft?.rawObjectText !== undefined && $('rawObject')) $('rawObject').value = draft.rawObjectText;
    if (editIndex !== null) {
      $('formTitle').textContent = tr('editItem', { index: editIndex + 1 });
      $('formHelp').textContent = tr('editHelp');
      $('saveBtn').textContent = tr('saveChanges');
      $('cancelEditBtn').hidden = false;
    } else {
      $('formTitle').textContent = tr('addItemTitle');
      $('formHelp').textContent = fields.length ? tr('addItemHelp') : tr('firstObjectHelp');
      $('saveBtn').textContent = tr('addItemButton');
      $('cancelEditBtn').hidden = true;
    }
    renderItems();
  } else {
    renderItems();
  }
  renderSupport();
  refreshInputFormatLabel();
  refreshDownloadBtn();
  refreshFidelityNote();
  syncPretty();
  itemModal.retranslate();
}

function createInput(value, sample, update, opts = {}) {
  const type = value === undefined ? kind(sample) : ((value === '' && kind(sample) === 'number') ? 'number' : kind(value));
  const holder = document.createElement('div');
  holder.className = 'value-editor';

  if (type === 'array') {
    const values = Array.isArray(value) ? clone(value) : [];
    const sampleArray = Array.isArray(sample) ? clone(sample) : [];
    let prototype = sampleArray.find((item) => item !== null && item !== undefined);
    if (prototype === undefined) prototype = values.find((item) => item !== null && item !== undefined);
    if (prototype === undefined && sampleArray.length) prototype = sampleArray[0];
    if (prototype !== undefined && sampleArray.length === 0) sampleArray.push(clone(prototype));

    const list = document.createElement('div');
    list.className = 'array-editor nested-array';
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', tr('arrayItems'));
    const rows = document.createElement('div');
    rows.className = 'array-rows';
    rows.style.display = 'grid';
    rows.style.gap = '8px';

    let typePicker = null;
    if (prototype === undefined) {
      typePicker = document.createElement('select');
      typePicker.className = 'array-type-picker';
      typePicker.setAttribute('aria-label', tr('newItemType'));
      [['string', 'string'], ['number', 'number'], ['boolean', 'boolean'], ['object', 'object'], ['array', 'array'], ['null', 'null']].forEach(([valueKey, labelKey]) => {
        const option = document.createElement('option');
        option.value = valueKey;
        option.textContent = tr(labelKey);
        typePicker.appendChild(option);
      });
    }

    function redraw() {
      rows.replaceChildren();
      if (!values.length) {
        const empty = document.createElement('div');
        empty.className = 'hint';
        empty.textContent = tr('emptyArray');
        rows.appendChild(empty);
      }
      values.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'array-row';
        const number = document.createElement('span');
        number.className = 'array-index';
        number.textContent = String(index + 1);
        number.setAttribute('aria-hidden', 'true');
        const sampleForItem = item === null ? null : (prototype !== undefined && (kind(item) === 'array' || kind(item) === 'object' || (item === '' && kind(prototype) === 'number'))
          ? prototype : ((item !== null && item !== undefined) ? item : prototype));
        const editor = createInput(item, sampleForItem, (next) => { values[index] = next; update(clone(values)); }, { depth: (opts.depth || 0) + 1 });
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'danger small';
        remove.textContent = '×';
        remove.title = tr('removeArrayItem', { index: index + 1 });
        remove.setAttribute('aria-label', remove.title);
        remove.addEventListener('click', () => { values.splice(index, 1); redraw(); update(clone(values)); });
        row.append(number, editor, remove);
        rows.appendChild(row);
      });
    }

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'array-add';
    add.textContent = tr('addArrayItem');
    add.addEventListener('click', () => {
      if (prototype === undefined && typePicker) {
        const templates = { string: '', number: 0, boolean: false, object: {}, array: [], null: null };
        prototype = templates[typePicker.value];
        sampleArray.push(clone(prototype));
        typePicker.hidden = true;
      }
      const next = prototype === undefined ? '' : blankFor(prototype);
      values.push(next);
      redraw();
      update(clone(values));
    });
    list.appendChild(rows);
    if (typePicker) list.appendChild(typePicker);
    list.appendChild(add);
    holder.appendChild(list);
    redraw();
    return holder;
  }

  if (type === 'object') {
    const object = value && typeof value === 'object' && !Array.isArray(value) ? clone(value) : {};
    const sampleObject = sample && typeof sample === 'object' && !Array.isArray(sample) ? sample : {};
    const keys = [...Object.keys(sampleObject), ...Object.keys(object).filter((key) => !Object.prototype.hasOwnProperty.call(sampleObject, key))];
    if (!keys.length) {
      const area = document.createElement('textarea');
      area.className = 'json-input';
      area.setAttribute('aria-label', tr('jsonObject'));
      area.placeholder = '{}';
      area.value = JSON.stringify(object, null, 2);
      area.addEventListener('input', () => {
        try {
          const parsed = parseText(area.value, 'auto').parsed;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) update(parsed);
        } catch { /* Retain the current value until the object is valid. */ }
      });
      holder.appendChild(area);
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = tr('objectFallbackHint');
      holder.appendChild(hint);
      return holder;
    }
    const box = document.createElement('div');
    box.className = 'object-editor';
    if (opts.depth < 1) {
      const title = document.createElement('div');
      title.className = 'object-title';
      title.textContent = tr('objectProperties');
      box.appendChild(title);
    }
    keys.forEach((key) => {
      const row = document.createElement('div');
      row.className = 'obj-field';
      const label = document.createElement('label');
      label.className = 'obj-field-label';
      label.textContent = `${makeLabel(key)} `;
      const meta = document.createElement('span');
      meta.className = 'field-label-meta';
      meta.textContent = kind(object[key] !== undefined ? object[key] : sampleObject[key]);
      label.appendChild(meta);
      const initialValue = Object.prototype.hasOwnProperty.call(object, key) ? object[key] : blankFor(sampleObject[key]);
      const editor = createInput(initialValue, sampleObject[key] !== undefined ? sampleObject[key] : object[key], (next) => {
        object[key] = next;
        update(clone(object));
      }, { depth: (opts.depth || 0) + 1 });
      row.append(label, editor);
      box.appendChild(row);
    });
    holder.appendChild(box);
    return holder;
  }

  let input;
  if (type === 'boolean') {
    input = document.createElement('select');
    [[true, tr('trueLabel')], [false, tr('falseLabel')]].forEach(([valueKey, label]) => {
      const option = document.createElement('option');
      option.value = String(valueKey);
      option.textContent = label;
      input.appendChild(option);
    });
    input.value = String(value === undefined || value === null ? false : value);
    input.addEventListener('change', () => update(input.value === 'true'));
  } else {
    input = document.createElement('input');
    input.className = 'value-input';
    if (type === 'number') {
      input.type = 'number';
      input.step = 'any';
      input.placeholder = tr('enterNumber');
      input.value = value === '' || value === undefined || value === null ? '' : String(value);
      input.addEventListener('input', () => update(input.value.trim() === '' ? '' : Number(input.value)));
    } else {
      input.type = 'text';
      input.value = value === null || value === undefined ? '' : String(value);
      input.placeholder = type === 'null' ? tr('emptyKeepsNull') : tr('enterValue');
      input.addEventListener('input', () => update(type === 'null' && input.value.trim() === '' ? null : input.value));
    }
  }
  if (opts.compact) input.style.minWidth = '0';
  holder.appendChild(input);
  return holder;
}

function renderForm(initialObject = null) {
  const root = $('fields');
  root.replaceChildren();
  rootEditors = [];
  rawObjectMode = fields.length === 0;
  if (rawObjectMode) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const label = document.createElement('label');
    label.textContent = tr('newObject');
    const textarea = document.createElement('textarea');
    textarea.className = 'raw-object';
    textarea.id = 'rawObject';
    textarea.placeholder = tr('objectPlaceholder');
    textarea.value = initialObject ? JSON.stringify(initialObject, null, 2) : JSON.stringify({ id: 1, name: getLanguage() === 'es' ? 'Nuevo elemento' : 'New item' }, null, 2);
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = tr('firstObjectHint');
    wrap.append(label, textarea, hint);
    root.appendChild(wrap);
    $('saveBtn').disabled = false;
    return;
  }

  const result = {};
  fields.forEach((field) => {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const label = document.createElement('label');
    label.textContent = makeLabel(field.key);
    const meta = document.createElement('span');
    meta.className = 'field-label-meta';
    meta.textContent = field.type;
    label.appendChild(meta);
    const start = initialObject && Object.prototype.hasOwnProperty.call(initialObject, field.key) ? clone(initialObject[field.key]) : blankFor(field.sample);
    result[field.key] = start;
    const editor = createInput(start, field.sample, (next) => { result[field.key] = next; }, { depth: 0 });
    wrap.append(label, editor);
    if (field.type === 'array') {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = tr('eachArrayRow');
      wrap.appendChild(hint);
    }
    root.appendChild(wrap);
    rootEditors.push({ key: field.key, field, get: () => result[field.key], getSample: () => field.sample });
  });
  $('saveBtn').disabled = false;
}

function readForm() {
  if (rawObjectMode) {
    let parsed;
    try { parsed = parseText($('rawObject').value, 'auto').parsed; } catch { throw new Error(tr('invalidObjectText')); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(tr('needObject'));
    return parsed;
  }
  const result = {};
  rootEditors.forEach((item) => { result[item.key] = validateValue(item.get(), item.getSample(), item.key); });
  return result;
}

function renderItems() {
  const root = $('items');
  root.replaceChildren();
  if (!loaded) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    const strong = document.createElement('strong');
    strong.textContent = tr('listEmptyTitle');
    const description = document.createElement('span');
    description.textContent = tr('listEmptyDescription');
    empty.append(strong, description);
    root.appendChild(empty);
  } else if (!data.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    const strong = document.createElement('strong');
    strong.textContent = tr('emptyArray');
    empty.appendChild(strong);
    root.appendChild(empty);
  }
  const query = $('searchInput').value.trim().toLowerCase();
  let shown = 0;
  data.forEach((obj, index) => {
    const searchable = JSON.stringify(obj).toLowerCase();
    if (query && !searchable.includes(query)) return;
    shown += 1;
    const row = document.createElement('div');
    row.className = 'item';
    row.draggable = true;
    row.dataset.index = String(index);
    const grip = document.createElement('span');
    grip.className = 'grip';
    grip.textContent = '⠿';
    grip.title = tr('dragReorder');
    grip.setAttribute('aria-label', tr('dragItem'));
    const idx = document.createElement('span');
    idx.className = 'index';
    idx.textContent = String(index + 1).padStart(2, '0');
    const summary = document.createElement('div');
    summary.className = 'summary';
    const entries = obj && typeof obj === 'object' ? Object.entries(obj) : [];
    const titleEntry = entries.find(([key, value]) => /^(name|title|label|id|key)$/i.test(key) && (typeof value === 'string' || typeof value === 'number'));
    const strong = document.createElement('strong');
    strong.textContent = titleEntry ? String(titleEntry[1]) : tr('item', { index: index + 1 });
    const code = document.createElement('code');
    code.textContent = JSON.stringify(obj);
    summary.append(strong, code);
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    actions.append(
      makeButton('↑', 'secondary small', tr('moveUp'), () => move(index, index - 1), index === 0),
      makeButton('↓', 'secondary small', tr('moveDown'), () => move(index, index + 1), index === data.length - 1),
      makeButton(tr('edit'), 'secondary small', tr('edit'), () => startEdit(index)),
      makeButton('×', 'danger small', tr('delete'), () => removeItem(index)),
    );
    row.append(grip, idx, summary, actions);
    const openDetail = () => itemModal.open(index);
    summary.classList.add('item-summary-clickable');
    summary.setAttribute('role', 'button');
    summary.setAttribute('tabindex', '0');
    summary.setAttribute('aria-label', tr('viewDetails'));
    summary.addEventListener('click', openDetail);
    summary.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDetail();
      }
    });
    row.addEventListener('click', (event) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (event.target.closest('button,input,select,textarea,a,.item-summary-clickable')) return;
      openDetail();
    });
    row.addEventListener('dragstart', (event) => {
      suppressClick = true;
      draggedIndex = index;
      row.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    });
    row.addEventListener('dragend', () => {
      draggedIndex = null;
      row.classList.remove('dragging');
      document.querySelectorAll('.item.over').forEach((item) => item.classList.remove('over'));
    });
    row.addEventListener('dragover', (event) => { event.preventDefault(); row.classList.add('over'); event.dataTransfer.dropEffect = 'move'; });
    row.addEventListener('dragleave', () => row.classList.remove('over'));
    row.addEventListener('drop', (event) => {
      event.preventDefault();
      row.classList.remove('over');
      const from = draggedIndex === null ? Number(event.dataTransfer.getData('text/plain')) : draggedIndex;
      move(from, index);
    });
    root.appendChild(row);
  });
  if (loaded && query && shown === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = tr('noMatches', { query });
    root.appendChild(empty);
  }
  $('listCount').textContent = !loaded ? tr('noItemsLoaded') : query ? tr('listCount', { shown, total: data.length }) : tr('listTotal', { count: data.length });
  $('countNote').textContent = loaded && query ? tr('searchNote') : '';
  $('copyBtn').disabled = !loaded;
  $('searchInput').disabled = !loaded;
  $('stats').replaceChildren();
  if (loaded) {
    addPill(data.length === 1 ? tr('oneItem') : tr('listTotal', { count: data.length }));
    addPill(tr('fieldCount', { count: fields.length }));
    addPill(tr('outputIs', { format: formatLabel(currentOutput().format) }));
    addPill(tr('localProcessing'));
  }
  try { $('preview').textContent = currentOutput().text.trimEnd(); } catch { $('preview').textContent = ''; }
  $('downloadBtn').disabled = !loaded;
  $('copyBtn').disabled = !loaded;
  refreshDownloadBtn();
  refreshFidelityNote();
  syncPretty();
  syncRaw();
}

function addPill(text) {
  const pill = document.createElement('span');
  pill.className = 'pill';
  pill.textContent = text;
  $('stats').appendChild(pill);
}

function makeButton(text, className, title, callback, disabled = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.disabled = disabled;
  button.addEventListener('click', callback);
  return button;
}

function move(from, to) {
  if (from < 0 || to < 0 || from >= data.length || to >= data.length || from === to) return;
  const [item] = data.splice(from, 1);
  data.splice(to, 0, item);
  if (editIndex === from) editIndex = to;
  else if (editIndex !== null && from < editIndex && to >= editIndex) editIndex -= 1;
  else if (editIndex !== null && from > editIndex && to <= editIndex) editIndex += 1;
  renderItems();
  setStatus('orderUpdated', 'success');
}

function removeItem(index) {
  if (!window.confirm(tr('confirmDelete', { index: index + 1 }))) return;
  data.splice(index, 1);
  if (editIndex === index) editIndex = null;
  else if (editIndex !== null && index < editIndex) editIndex -= 1;
  fields = fieldSamples(data);
  renderForm(editIndex === null ? null : data[editIndex]);
  if (editIndex === null) resetForm();
  renderItems();
  setStatus('itemDeleted', 'success');
}

function startEdit(index, opts = {}) {
  editIndex = index;
  renderForm(data[index]);
  $('formTitle').textContent = tr('editItem', { index: index + 1 });
  $('formHelp').textContent = tr('editHelp');
  $('saveBtn').textContent = tr('saveChanges');
  $('cancelEditBtn').hidden = false;
  viewTabs.show('list');
  $('fields').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (opts.flash) {
    const panel = document.querySelector('.form-panel');
    if (panel) {
      panel.classList.remove('flash');
      void panel.offsetWidth;
      panel.classList.add('flash');
      setTimeout(() => panel.classList.remove('flash'), 2400);
    }
  }
}

function resetForm() {
  editIndex = null;
  renderForm();
  $('formTitle').textContent = tr('addItemTitle');
  $('formHelp').textContent = fields.length ? tr('addItemHelp') : tr('firstObjectHelp');
  $('saveBtn').textContent = tr('addItemButton');
  $('cancelEditBtn').hidden = true;
}

function loadArray(parsed, name = 'array-edited', format = 'json') {
  assertRootArray(parsed);
  data = clone(parsed);
  fields = fieldSamples(data);
  fileBaseName = (name || 'array-edited').replace(/[\\/:*?"<>|]/g, '-');
  loaded = true;
  inputSourceFormat = parsers[format] ? format : 'json';
  editIndex = null;
  prettyEditing = false;
  $('prettyOutput').hidden = false;
  $('prettyEditWrap').hidden = true;
  $('searchInput').value = '';
  renderForm();
  resetForm();
  renderItems();
  syncRaw(true);
  refreshInputFormatLabel();
  setStatus('loadedSuccess', 'success');
}

function loadFromText(text, baseName, preference) {
  const parsed = parseText(text, preference);
  loadArray(parsed.parsed, baseName, parsed.format);
}

const viewTabs = initViewTabs({
  onEnter: (name) => {
    if (name === 'pretty') syncPretty();
    if (name === 'raw') syncRaw();
  },
});

const itemModal = initItemModal({
  getCount: () => data.length,
  getItem: (i) => data[i],
  onEdit: (i) => startEdit(i, { flash: true }),
  onDelete: (i) => {
    const before = data.length;
    removeItem(i);
    if (data.length === before) return i;
    if (!data.length) return -1;
    return Math.min(i, data.length - 1);
  },
  onCopy: async (i) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data[i], null, 2));
      setStatus('copySuccess', 'success');
    } catch {
      setStatus('copyFailed', 'error');
    }
  },
});

$('fileInput').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const preference = resolveFilePreference(file, $('inputFormat').value);
    const text = await file.text();
    loadFromText(text, file.name.replace(/\.(json5?|jsonl|ndjson|ya?ml|csv|tsv|txt)$/i, '') + '-edited', preference);
    $('pastedText').value = text;
  } catch (error) {
    status(`${tr('fileReadError')} ${error?.message || ''}`.trim(), 'error');
  }
  event.target.value = '';
});

$('parseTextBtn').addEventListener('click', () => {
  try {
    const raw = $('pastedText').value;
    if (!raw.trim()) throw new Error(tr('parseTextEmpty'));
    loadFromText(raw, 'pasted-array-edited', $('inputFormat').value);
  } catch (error) {
    status(`${tr('parseError')} ${error?.message || ''}`.trim(), 'error');
  }
});

$('sampleBtn').addEventListener('click', () => {
  const example = [
    { id: 101, name: 'First item', url: 'https://example.com', enabled: true, tags: ['demo', 'sample'], metadata: { source: 'sample', labels: ['one', 'two'] } },
    { id: 102, name: 'Second item', url: 'https://example.org', enabled: false, tags: [], metadata: { source: 'manual', labels: [] } },
    { id: 103, name: 'Third item', url: 'https://example.net', enabled: true, tags: ['test'], metadata: { source: 'sample', labels: ['three'] } },
  ];
  try {
    $('inputFormat').value = 'auto';
    $('outputFormat').value = 'source';
    $('pastedText').value = `- id: 101\n  name: First item\n  url: https://example.com\n  enabled: true\n  tags:\n    - demo\n    - sample\n  metadata:\n    source: sample\n    labels: [one, two]\n- id: 102\n  name: Second item\n  url: https://example.org\n  enabled: false\n  tags: []\n  metadata:\n    source: manual\n    labels: []\n- id: 103\n  name: Third item\n  url: https://example.net\n  enabled: true\n  tags: [test]\n  metadata:\n    source: sample\n    labels: [three]\n`;
    loadArray(example, 'example-edited', 'yaml');
  } catch (error) { status(error.message, 'error'); }
});

$('itemForm').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!loaded) { setStatus('addFirst', 'error'); return; }
  try {
    const object = readForm();
    if (editIndex !== null) { data[editIndex] = object; setStatus('objectUpdated', 'success'); }
    else { data.push(object); setStatus('objectAdded', 'success'); }
    fields = fieldSamples(data);
    resetForm();
    renderItems();
  } catch (error) { status(error.message || tr('invalidObjectText'), 'error'); }
});

$('cancelEditBtn').addEventListener('click', () => { resetForm(); setStatus('cancelStatus'); });
$('searchInput').addEventListener('input', renderItems);
$('inputFormat').addEventListener('change', refreshInputFormatLabel);
$('outputFormat').addEventListener('change', () => { exitPrettyEdit(); renderItems(); syncRaw(true); });
$('languageSelect').addEventListener('change', () => {
  const draft = captureFormDraft();
  setLanguage($('languageSelect').value);
  applyTranslations(draft);
});

$('downloadBtn').addEventListener('click', () => {
  if (!loaded) return;
  const output = currentOutput();
  const parser = parsers[output.format] ?? parsers.json;
  const blob = new Blob([output.text], { type: parser.mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = (fileBaseName || 'array-edited') + parser.extension;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status(tr('downloadReady', { name: (fileBaseName || 'array-edited') + parser.extension }), 'success');
});

async function copyCurrentOutput() {
  try {
    await navigator.clipboard.writeText(currentOutput().text);
    setStatus('copySuccess', 'success');
  } catch {
    setStatus('copyFailed', 'error');
  }
}

$('copyBtn').addEventListener('click', copyCurrentOutput);
$('copyPrettyBtn').addEventListener('click', copyCurrentOutput);
$('editPrettyBtn').addEventListener('click', enterPrettyEdit);

$('cancelPrettyBtn').addEventListener('click', () => {
  exitPrettyEdit();
  setStatus('cancelStatus');
});

$('applyPrettyBtn').addEventListener('click', () => {
  try {
    const raw = $('prettyEditor').value;
    if (!raw.trim()) throw new Error(tr('parseTextEmpty'));
    const resolved = $('outputFormat').value === 'source' ? inputSourceFormat : $('outputFormat').value;
    const parsed = parseText(raw, resolved).parsed;
    loadArray(parsed, fileBaseName || 'array-edited', resolved);
    setStatus('rawApplied', 'success');
  } catch (error) {
    status(`${tr('parseError')} ${error?.message || ''}`.trim(), 'error');
  }
});

$('rawEditor').addEventListener('input', () => { rawDirty = true; });

$('syncRawBtn').addEventListener('click', () => {
  syncRaw(true);
  setStatus('loadedSuccess', 'success');
});

$('applyRawBtn').addEventListener('click', () => {
  try {
    const raw = $('rawEditor').value;
    if (!raw.trim()) throw new Error(tr('parseTextEmpty'));
    loadFromText(raw, fileBaseName || 'array-edited', 'auto');
    rawDirty = false;
    setStatus('rawApplied', 'success');
    viewTabs.show('list');
  } catch (error) {
    status(`${tr('parseError')} ${error?.message || ''}`.trim(), 'error');
  }
});

function renderSupport() {
  const links = CONFIG.supportLinks;
  const labels = { paypal: tr('supportPayPal'), koFi: tr('supportKoFi'), other: tr('supportOther') };
  const options = Object.entries(links).filter(([, url]) => typeof url === 'string' && url.trim() && /^https:\/\//i.test(url.trim()));
  const root = $('supportActions');
  root.replaceChildren();
  options.forEach(([key, url]) => {
    const anchor = document.createElement('a');
    anchor.className = 'support-link';
    anchor.href = url.trim();
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = labels[key] || tr('supportOther');
    root.appendChild(anchor);
  });
  $('supportHint').hidden = options.length > 0;
  if (!options.length) $('supportHint').textContent = tr('supportConfigure');
}

// A YAML file may be selected while input format is Auto-detect. When that happens, the
// parser's detected source format is used for "same as input" downloads.
$('languageSelect').value = getLanguage();
applyTranslations();
renderItems();
renderSupport();
