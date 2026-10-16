// View tabs: List (current editor) | Prettify (read-only) | Raw (editable text).
// The module owns tab switching + syncing. Data ownership stays in main.js
// via callbacks so future formats or editors can reuse these views.

export const VIEW_IDS = ['list', 'pretty', 'raw'];

export function initViewTabs({ onEnter }) {
  const buttons = {
    list: document.getElementById('tabList'),
    pretty: document.getElementById('tabPretty'),
    raw: document.getElementById('tabRaw'),
  };
  const panels = {
    list: document.getElementById('viewList'),
    pretty: document.getElementById('viewPretty'),
    raw: document.getElementById('viewRaw'),
  };
  let current = 'list';

  function show(name) {
    if (!VIEW_IDS.includes(name)) return;
    current = name;
    VIEW_IDS.forEach((id) => {
      const active = id === name;
      buttons[id]?.setAttribute('aria-selected', String(active));
      buttons[id]?.classList.toggle('active', active);
      if (panels[id]) panels[id].hidden = !active;
    });
    onEnter?.(name);
  }

  VIEW_IDS.forEach((id) => {
    buttons[id]?.addEventListener('click', () => show(id));
  });

  return { show, current: () => current };
}
