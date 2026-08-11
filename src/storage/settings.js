// src/storage/settings.js
// Thin wrapper around chrome.storage.local with a localStorage fallback for
// the dev harness (see dev/chrome-shim.js), per CONTRACTS.md.

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local);
}

export async function getSetting(key, fallback) {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result && Object.prototype.hasOwnProperty.call(result, key) ? result[key] : fallback);
      });
    });
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function setSetting(key, value) {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    });
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode, quota); fail silently.
  }
}

export async function getTheme() {
  return getSetting('theme', 'system');
}

export async function setTheme(theme) {
  return setSetting('theme', theme);
}

export function applyTheme(theme) {
  const resolved = theme === 'system' ? resolveSystemTheme() : theme;
  document.documentElement.dataset.theme = resolved === 'dark' ? 'dark' : 'light';
}

function resolveSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
