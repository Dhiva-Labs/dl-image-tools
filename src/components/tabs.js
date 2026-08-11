// src/components/tabs.js
// Generic ARIA tabs pattern: role="tablist"/"tab"/"tabpanel", roving
// tabindex, arrow-key navigation, and lazy activation callbacks.

export function createTabBar(tabBarEl, panelHostEl) {
  let tabs = []; // [{ id, label, panel: { el, onActivate? } }]
  let activeId = null;

  function buttonFor(id) {
    return tabBarEl.querySelector(`[data-tab-id="${CSS.escape(id)}"]`);
  }

  function render() {
    tabBarEl.innerHTML = '';
    panelHostEl.innerHTML = '';

    tabs.forEach(({ id, label, panel }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = `tab-${id}`;
      btn.className = 'tab-btn';
      btn.setAttribute('role', 'tab');
      btn.dataset.tabId = id;
      btn.setAttribute('aria-controls', `panel-${id}`);
      btn.setAttribute('aria-selected', 'false');
      btn.tabIndex = -1;
      btn.textContent = label;
      btn.addEventListener('click', () => activate(id));
      btn.addEventListener('keydown', onKeydown);
      tabBarEl.appendChild(btn);

      panel.el.id = `panel-${id}`;
      panel.el.setAttribute('role', 'tabpanel');
      panel.el.setAttribute('aria-labelledby', `tab-${id}`);
      panel.el.hidden = true;
      panelHostEl.appendChild(panel.el);
    });

    if (tabs.length === 0) return;
    const preferred = tabs.find((t) => t.id === activeId) ? activeId : tabs[0].id;
    activate(preferred, { force: true });
  }

  function onKeydown(e) {
    const ids = tabs.map((t) => t.id);
    const idx = ids.indexOf(activeId);
    if (idx === -1) return;
    let nextIdx = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % ids.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = ids.length - 1;
    if (nextIdx === null) return;
    e.preventDefault();
    activate(ids[nextIdx]);
    const btn = buttonFor(ids[nextIdx]);
    if (btn) btn.focus();
  }

  function activate(id, { force = false } = {}) {
    if (id === activeId && !force) return;
    const entry = tabs.find((t) => t.id === id);
    if (!entry) return;
    activeId = id;

    tabs.forEach((t) => {
      const btn = buttonFor(t.id);
      const selected = t.id === id;
      if (btn) {
        btn.setAttribute('aria-selected', selected ? 'true' : 'false');
        btn.tabIndex = selected ? 0 : -1;
      }
      t.panel.el.hidden = !selected;
    });

    if (typeof entry.panel.onActivate === 'function') entry.panel.onActivate();
  }

  return {
    setTabs(nextTabs) {
      tabs = nextTabs;
      render();
    },
    activate,
    get activeId() {
      return activeId;
    },
  };
}
