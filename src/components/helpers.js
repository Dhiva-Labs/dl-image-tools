// src/components/helpers.js
// Small DOM and formatting helpers shared by the popup components.
// No dependencies outside this file.

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === 'class') {
      node.className = value;
    } else if (key === 'text') {
      node.textContent = value;
    } else if (key === 'html') {
      node.innerHTML = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, value);
    }
  });
  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function debounce(fn, wait = 150) {
  let timer = null;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// Tracks the single most-recent object URL for a preview <img>/<a>, revoking
// the previous one whenever it is replaced or cleared. Keeps popup memory
// hygiene simple across every panel that swaps preview images in and out.
export function createObjectUrlSlot() {
  let current = null;
  return {
    set(blobOrFile) {
      this.clear();
      current = URL.createObjectURL(blobOrFile);
      return current;
    },
    clear() {
      if (current) {
        URL.revokeObjectURL(current);
        current = null;
      }
    },
    get value() {
      return current;
    },
  };
}

export function setBusy(root, busy) {
  root.classList.toggle('is-busy', !!busy);
  root.setAttribute('aria-busy', busy ? 'true' : 'false');
  root.querySelectorAll('button, input, select, textarea').forEach((control) => {
    if (busy) {
      if (control.disabled) control.dataset.wasDisabled = 'true';
      control.disabled = true;
    } else if (!control.dataset.wasDisabled) {
      control.disabled = false;
    } else {
      delete control.dataset.wasDisabled;
    }
  });
}

export function spinnerEl(label = 'Working…') {
  return el('span', { class: 'spinner', role: 'status' }, [
    el('span', { class: 'spinner-ring', 'aria-hidden': 'true' }),
    el('span', { class: 'sr-only', text: label }),
  ]);
}

export function fileExtOf(filename) {
  const match = /\.([a-z0-9]+)$/i.exec(filename || '');
  return match ? match[1].toLowerCase() : '';
}

export function baseNameOf(filename) {
  const withoutExt = (filename || '').replace(/\.[a-z0-9]+$/i, '');
  return withoutExt || 'image';
}

export function extFromMime(mimeToExt, type) {
  return mimeToExt[type] || 'jpg';
}

export function percentSaved(originalBytes, outputBytes) {
  if (!originalBytes) return 0;
  return Math.round((1 - outputBytes / originalBytes) * 100);
}
