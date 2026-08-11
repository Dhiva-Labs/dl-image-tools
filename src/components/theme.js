// src/components/theme.js
// Wires the header's light/dark/system theme toggle to storage/settings.js.

import { getTheme, setTheme, applyTheme } from '../storage/settings.js';

const CHOICES = ['light', 'dark', 'system'];

export async function initThemeToggle(root) {
  const buttons = Array.from(root.querySelectorAll('[data-theme-choice]'));
  let current = await getTheme();
  if (!CHOICES.includes(current)) current = 'system';

  applyTheme(current);
  syncButtons();

  let media = null;
  function watchSystem() {
    if (media) media.removeEventListener('change', onSystemChange);
    if (current === 'system' && window.matchMedia) {
      media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', onSystemChange);
    }
  }
  function onSystemChange() {
    if (current === 'system') applyTheme('system');
  }

  function syncButtons() {
    buttons.forEach((btn) => {
      const active = btn.dataset.themeChoice === current;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const choice = btn.dataset.themeChoice;
      if (!CHOICES.includes(choice) || choice === current) return;
      current = choice;
      applyTheme(current);
      syncButtons();
      watchSystem();
      await setTheme(current);
    });
  });

  watchSystem();
}
