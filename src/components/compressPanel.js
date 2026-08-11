// src/components/compressPanel.js
// Compress tab: live quality/format preview with size comparison.
//
// Worker contract assumption (CONTRACTS.md says runInWorker(op, args) where
// args = {source, opts} "matching each tool's signature"): for 'compress'
// that means opts = { format, quality }, mirroring
// compress(source, { format, quality }) in src/tools/compressor.js.

import { runInWorker } from '../utils/worker-client.js';
import { isTypeSupported, formatBytes, outputFilename, MIME_TO_EXT } from '../utils/image.js';
import { downloadBlob } from '../utils/download.js';
import { toUserMessage } from '../utils/errors.js';
import { el, debounce, createObjectUrlSlot, setBusy, percentSaved } from './helpers.js';

const FORMATS = [
  { value: 'image/jpeg', label: 'JPG' },
  { value: 'image/webp', label: 'WebP' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/avif', label: 'AVIF' },
];

export function createCompressPanel({ getActiveFile, messageBar }) {
  const preview = el('img', { class: 'preview-img', alt: 'Compressed preview' });
  const qualityInput = el('input', {
    type: 'range', min: '1', max: '100', value: '80', id: 'compress-quality',
    class: 'slider',
  });
  const qualityValue = el('span', { class: 'field-value', text: '80' });
  const formatSelect = el('select', { id: 'compress-format', class: 'select' },
    FORMATS.map((f) => el('option', { value: f.value, text: f.label })));

  const originalSizeEl = el('span', { class: 'stat-value', text: '—' });
  const outputSizeEl = el('span', { class: 'stat-value', text: '—' });
  const savedEl = el('span', { class: 'stat-value stat-value-accent', text: '—' });

  const resetBtn = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Reset' });
  const downloadBtn = el('button', { type: 'button', class: 'btn btn-primary', text: 'Download' });
  const busyEl = el('span', { class: 'spinner', role: 'status', 'aria-live': 'polite' }, [
    el('span', { class: 'spinner-ring', 'aria-hidden': 'true' }),
    el('span', { class: 'sr-only', text: 'Compressing…' }),
  ]);
  busyEl.hidden = true;

  const root = el('div', { class: 'panel panel-compress' }, [
    el('div', { class: 'panel-preview' }, [preview]),
    el('div', { class: 'panel-controls' }, [
      el('div', { class: 'field' }, [
        el('label', { for: 'compress-quality', text: 'Quality' }),
        el('div', { class: 'field-row' }, [qualityInput, qualityValue]),
      ]),
      el('div', { class: 'field' }, [
        el('label', { for: 'compress-format', text: 'Output format' }),
        formatSelect,
      ]),
      el('dl', { class: 'stat-list' }, [
        el('dt', { text: 'Original size' }), el('dd', {}, [originalSizeEl]),
        el('dt', { text: 'Output size' }), el('dd', {}, [outputSizeEl]),
        el('dt', { text: 'Saved' }), el('dd', {}, [savedEl]),
      ]),
      el('div', { class: 'panel-actions' }, [resetBtn, downloadBtn, busyEl]),
    ]),
  ]);

  const outputSlot = createObjectUrlSlot();
  let currentFile = null;
  let currentResult = null;
  let avifSupported = true;

  async function ensureAvifOption() {
    avifSupported = await isTypeSupported('image/avif');
    const avifOption = Array.from(formatSelect.options).find((o) => o.value === 'image/avif');
    if (avifOption) {
      avifOption.disabled = !avifSupported;
      avifOption.textContent = avifSupported ? 'AVIF' : 'AVIF (not supported)';
    }
  }

  function defaultFormatFor(file) {
    if (file.type === 'image/avif' && !avifSupported) return 'image/webp';
    if (FORMATS.some((f) => f.value === file.type)) return file.type;
    return 'image/jpeg';
  }

  function resetControls() {
    qualityInput.value = '80';
    qualityValue.textContent = '80';
    formatSelect.value = defaultFormatFor(currentFile);
  }

  async function process() {
    if (!currentFile) return;
    setBusy(root, true);
    busyEl.hidden = false;
    try {
      const quality = Number(qualityInput.value) / 100;
      const format = formatSelect.value;
      const result = await runInWorker('compress', {
        source: currentFile,
        opts: { format, quality },
      });
      currentResult = result;
      preview.src = outputSlot.set(result.blob);
      originalSizeEl.textContent = formatBytes(currentFile.size);
      outputSizeEl.textContent = formatBytes(result.blob.size);
      const saved = percentSaved(currentFile.size, result.blob.size);
      savedEl.textContent = `${saved > 0 ? saved : 0}%`;
      savedEl.classList.toggle('stat-value-warn', saved < 0);
    } catch (err) {
      messageBar.showError(toUserMessage(err));
    } finally {
      setBusy(root, false);
      busyEl.hidden = true;
    }
  }

  const debouncedProcess = debounce(process, 250);

  qualityInput.addEventListener('input', () => {
    qualityValue.textContent = qualityInput.value;
    debouncedProcess();
  });
  formatSelect.addEventListener('change', () => process());
  resetBtn.addEventListener('click', () => {
    resetControls();
    process();
  });
  downloadBtn.addEventListener('click', () => {
    if (!currentResult || !currentFile) return;
    const ext = MIME_TO_EXT[formatSelect.value] || 'jpg';
    downloadBlob(currentResult.blob, outputFilename(currentFile.name, '-compressed', ext));
  });

  let avifReady = ensureAvifOption();

  async function onActivate() {
    await avifReady;
    const file = getActiveFile();
    if (!file) return;
    if (file !== currentFile) {
      currentFile = file;
      resetControls();
      await process();
    }
  }

  function destroy() {
    outputSlot.clear();
  }

  return { el: root, onActivate, destroy };
}
