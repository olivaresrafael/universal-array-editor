import { tr } from './i18n.js';
import { highlightJson } from './highlight.js';

// Item detail modal: read-only JSON + readable views with prev/next navigation.
// Editing happens in the main form (List tab); onEdit closes the modal and
// hands the index back so the caller can scroll to and flash the edit zone.
export function initItemModal({ getCount, getItem, onEdit, onDelete, onCopy }) {
  const dialog = document.getElementById('itemDialog');
  const title = document.getElementById('itemDialogTitle');
  const position = document.getElementById('itemDialogPos');
  const jsonView = document.getElementById('itemJsonView');
  const legibleView = document.getElementById('itemLegibleView');
  const tabJson = document.getElementById('tabItemJson');
  const tabLegible = document.getElementById('tabItemLegible');
  const prevBtn = document.getElementById('itemPrevBtn');
  const nextBtn = document.getElementById('itemNextBtn');
  let index = 0;
  let view = 'json';
  let lastFocused = null;

  const titleFor = (item, i) => {
    const entries = item && typeof item === 'object' ? Object.entries(item) : [];
    const titleEntry = entries.find(([key, value]) => /^(name|title|label|id|key)$/i.test(key) && (typeof value === 'string' || typeof value === 'number'));
    return titleEntry ? String(titleEntry[1]) : tr('item', { index: i + 1 });
  };

  function renderScalar(value) {
    const span = document.createElement('span');
    if (value === null) {
      span.className = 'tok-null';
      span.textContent = 'null';
    } else if (typeof value === 'boolean') {
      span.className = 'tok-bool';
      span.textContent = String(value);
    } else if (typeof value === 'number') {
      span.className = 'tok-number';
      span.textContent = String(value);
    } else {
      span.className = 'tok-string';
      span.textContent = JSON.stringify(String(value));
    }
    return span;
  }

  function renderLegible(value) {
    if (value === null || typeof value !== 'object') return renderScalar(value);
    if (Array.isArray(value)) {
      if (!value.length) {
        const empty = document.createElement('span');
        empty.className = 'hint';
        empty.textContent = '[]';
        return empty;
      }
      if (value.every((item) => item === null || typeof item !== 'object')) {
        const chips = document.createElement('div');
        chips.className = 'chips';
        value.forEach((item) => {
          const chip = document.createElement('span');
          chip.className = 'chip';
          chip.appendChild(renderScalar(item));
          chips.appendChild(chip);
        });
        return chips;
      }
      const list = document.createElement('ol');
      list.className = 'leg-list';
      value.forEach((item) => {
        const li = document.createElement('li');
        li.appendChild(renderLegible(item));
        list.appendChild(li);
      });
      return list;
    }
    const keys = Object.keys(value);
    if (!keys.length) {
      const empty = document.createElement('span');
      empty.className = 'hint';
      empty.textContent = '{}';
      return empty;
    }
    const box = document.createElement('div');
    box.className = 'leg-box';
    keys.forEach((key) => {
      const row = document.createElement('div');
      row.className = 'leg-row';
      const term = document.createElement('div');
      term.className = 'leg-key tok-key';
      term.textContent = key;
      const def = document.createElement('div');
      def.className = 'leg-val';
      def.appendChild(renderLegible(value[key]));
      row.append(term, def);
      box.appendChild(row);
    });
    return box;
  }

  function show(viewName) {
    view = viewName;
    const showJson = viewName === 'json';
    tabJson.setAttribute('aria-selected', String(showJson));
    tabJson.classList.toggle('active', showJson);
    tabLegible.setAttribute('aria-selected', String(!showJson));
    tabLegible.classList.toggle('active', !showJson);
    jsonView.hidden = !showJson;
    legibleView.hidden = showJson;
  }

  function render() {
    const total = getCount();
    if (index < 0 || index >= total) return false;
    const item = getItem(index);
    title.textContent = titleFor(item, index);
    position.textContent = tr('modalPosition', { index: index + 1, total });
    jsonView.innerHTML = highlightJson(JSON.stringify(item, null, 2));
    legibleView.replaceChildren(renderLegible(item));
    show(view);
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === total - 1;
    return true;
  }

  function open(i) {
    if (getCount() === 0) return;
    index = Math.max(0, Math.min(i, getCount() - 1));
    view = 'json';
    lastFocused = document.activeElement;
    if (!render()) return;
    if (!dialog.open) dialog.showModal();
    dialog.focus();
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  function step(delta) {
    const next = index + delta;
    if (next < 0 || next >= getCount()) return;
    index = next;
    render();
  }

  tabJson.addEventListener('click', () => show('json'));
  tabLegible.addEventListener('click', () => show('legible'));
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  document.getElementById('itemDialogClose').addEventListener('click', close);
  document.getElementById('itemCopyBtn').addEventListener('click', () => onCopy(index));
  document.getElementById('itemEditBtn').addEventListener('click', () => {
    const current = index;
    close();
    onEdit(current);
  });
  document.getElementById('itemDeleteBtn').addEventListener('click', () => {
    const next = onDelete(index);
    if (next === null || next === undefined) return;
    if (next < 0) {
      close();
      return;
    }
    index = next;
    render();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    }
  });
  dialog.addEventListener('close', () => {
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
    lastFocused = null;
  });

  return {
    open,
    close,
    isOpen: () => dialog.open,
    retranslate: () => {
      if (dialog.open) render();
    },
  };
}
