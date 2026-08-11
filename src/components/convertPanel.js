// src/components/convertPanel.js
// Convert tab: shows the source format, offers target-format buttons for
// every encodable type from CONTRACTS.md (JPG/PNG/WebP/AVIF), disabling
// AVIF when unsupported and disabling the button matching the source format.
//
// Worker contract assumption: convert(source, format, quality) takes format
// as a positional arg, not inside an options object, so opts here carries
// { format, quality } and worker.js is expected to call
// convert(args.source, args.opts.format, args.opts.quality).

import { runInWorker } from '../utils/worker-client.js';
import { isTypeSupported, formatBytes, outputFilename, MIME_TO_EXT } from '../utils/image.js';
import { downloadBlob } from '../utils/download.js';
import { toUserMessage } from '../utils/errors.js';
import { el, createObjectUrlSlot, setBusy } from './helpers.js';

const TARGETS = [
  { value: 'image/jpeg', label: 'JPG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/webp', label: 'WebP' },
  { value: 'image/avif', label: 'AVIF' },
];

export function createConvertPanel({ getActiveFile, messageBar }) {
  const preview = el('img', { class: 'preview-img', alt: 'Converted preview' });
  const sourceFormatEl = el('span', { class: 'stat-value', text: '—' });
  const outputFormatEl = el('span', { class: 'stat-value', text: '—' });
  const outputSizeEl = el('span', { class: 'stat-value', text: '—' });

  const targetButtons = new Map();
  const targetRow = el('div', { class: 'format-btn-row', role: 'group', 'aria-label': 'Target format' },
    TARGETS.map((t) => {
      const btn = el('button', { type: 'button', class: 'btn btn-format', text: t.label });
      btn.dataset.format = t.value;
      targetButtons.set(t.value, btn);
      return btn;
    }));

  const downloadBtn = el('button', { type: 'button', class: 'btn btn-primary', text: 'Download' });
  downloadBtn.disabled = true;
  const busyEl = el('span', { class: 'spinner', role: 'status' }, [
    el('span', { class: 'spinner-ring', 'aria-hidden': 'true' }),
    el('span', { class: 'sr-only', text: 'Converting…' }),
  ]);
  busyEl.hidden = true;

  const root = el('div', { class: 'panel panel-convert' }, [
    el('div', { class: 'panel-preview' }, [preview]),
    el('div', { class: 'panel-controls' }, [
      el('dl', { class: 'stat-list' }, [
        el('dt', { text: 'Source format' }), el('dd', {}, [sourceFormatEl]),
        el('dt', { text: 'Output format' }), el('dd', {}, [outputFormatEl]),
        el('dt', { text: 'Output size' }), el('dd', {}, [outputSizeEl]),
      ]),
      el('div', { class: 'field' }, [
        el('span', { class: 'field-label-static', text: 'Convert to' }),
        targetRow,
      ]),
      el('div', { class: 'panel-actions' }, [downloadBtn, busyEl]),
    ]),
  ]);

  const outputSlot = createObjectUrlSlot();
  let currentFile = null;
  let currentResult = null;
  let currentFormat = null;

  async function convertTo(format) {
    if (!currentFile) return;
    currentFormat = format;
    targetButtons.forEach((btn, value) => btn.classList.toggle('is-active', value === format));
    setBusy(root, true);
    busyEl.hidden = false;
    try {
      const result = await runInWorker('convert', {
        source: currentFile,
        opts: { format, quality: 0.92 },
      });
      currentResult = result;
      preview.src = outputSlot.set(result.blob);
      outputFormatEl.textContent = TARGETS.find((t) => t.value === format)?.label || format;
      outputSizeEl.textContent = formatBytes(result.blob.size);
      downloadBtn.disabled = false;
    } catch (err) {
      messageBar.showError(toUserMessage(err));
    } finally {
      setBusy(root, false);
      busyEl.hidden = true;
    }
  }

  targetButtons.forEach((btn, format) => {
    btn.addEventListener('click', () => convertTo(format));
  });

  downloadBtn.addEventListener('click', () => {
    if (!currentResult || !currentFile || !currentFormat) return;
    const ext = MIME_TO_EXT[currentFormat] || 'jpg';
    downloadBlob(currentResult.blob, outputFilename(currentFile.name, '-converted', ext));
  });

  async function refreshAvailability() {
    const avifSupported = await isTypeSupported('image/avif');
    const avifBtn = targetButtons.get('image/avif');
    if (avifBtn) {
      avifBtn.disabled = !avifSupported;
      avifBtn.title = avifSupported ? '' : 'AVIF encoding is not supported in this browser';
    }
    targetButtons.forEach((btn, value) => {
      if (value !== 'image/avif') btn.disabled = !!currentFile && value === currentFile.type;
    });
  }

  async function onActivate() {
    const file = getActiveFile();
    if (!file) return;
    if (file !== currentFile) {
      currentFile = file;
      currentResult = null;
      currentFormat = null;
      downloadBtn.disabled = true;
      preview.removeAttribute('src');
      sourceFormatEl.textContent = MIME_TO_EXT[file.type] ? MIME_TO_EXT[file.type].toUpperCase() : file.type;
      outputFormatEl.textContent = '—';
      outputSizeEl.textContent = '—';
      await refreshAvailability();
      const firstTarget = TARGETS.find((t) => t.value !== file.type && !targetButtons.get(t.value).disabled);
      if (firstTarget) await convertTo(firstTarget.value);
    }
  }

  function destroy() {
    outputSlot.clear();
  }

  return { el: root, onActivate, destroy };
}
