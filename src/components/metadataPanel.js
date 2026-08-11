// src/components/metadataPanel.js
// Metadata tab: renders getMetadata() as a clean definition list. Light
// operation per CONTRACTS.md, called directly (no worker).

import { getMetadata } from '../tools/metadata.js';
import { toUserMessage } from '../utils/errors.js';
import { el, setBusy } from './helpers.js';

export function createMetadataPanel({ getActiveFile, messageBar }) {
  const list = el('dl', { class: 'stat-list stat-list-wide' });
  const busyEl = el('span', { class: 'spinner', role: 'status' }, [
    el('span', { class: 'spinner-ring', 'aria-hidden': 'true' }),
    el('span', { class: 'sr-only', text: 'Reading metadata…' }),
  ]);
  busyEl.hidden = true;

  const root = el('div', { class: 'panel panel-metadata' }, [list, busyEl]);

  let currentFile = null;

  function row(label, value) {
    list.appendChild(el('dt', { text: label }));
    list.appendChild(el('dd', { text: value }));
  }

  function formatDate(date) {
    if (!date) return 'Unknown';
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return String(date);
    }
  }

  async function render(file) {
    list.innerHTML = '';
    setBusy(root, true);
    busyEl.hidden = false;
    try {
      const meta = await getMetadata(file);
      row('File name', meta.name);
      row('Type', meta.type);
      row('Size', meta.sizeLabel);
      row('Dimensions', `${meta.width} × ${meta.height} px`);
      row('Aspect ratio', meta.aspectRatio);
      row('Megapixels', `${meta.megapixels} MP`);
      row('Last modified', formatDate(meta.lastModified));
      row('Metadata (EXIF)', meta.hasExif ? 'Available' : 'Not available');
    } catch (err) {
      messageBar.showError(toUserMessage(err));
    } finally {
      setBusy(root, false);
      busyEl.hidden = true;
    }
  }

  async function onActivate() {
    const file = getActiveFile();
    if (!file) return;
    if (file !== currentFile) {
      currentFile = file;
      await render(file);
    }
  }

  return { el: root, onActivate };
}
