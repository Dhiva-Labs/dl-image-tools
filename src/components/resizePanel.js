// src/components/resizePanel.js
// Resize tab: width/height with lock-aspect, percent field, presets.
// Presets only pre-fill the width/height inputs — they never lock or force
// the values, per the product spec ("never force presets").
//
// Worker contract assumption: runInWorker('resize', { source, opts }) where
// opts mirrors resize(source, opts) from src/tools/resizer.js, i.e.
// { width?, height?, percent?, lockAspect, format?, quality? }.

import { runInWorker } from '../utils/worker-client.js';
import { computeDimensions, PRESETS } from '../tools/resizer.js';
import { decodeImage, isTypeSupported, formatBytes, outputFilename, MIME_TO_EXT } from '../utils/image.js';
import { downloadBlob } from '../utils/download.js';
import { toUserMessage } from '../utils/errors.js';
import { el, debounce, createObjectUrlSlot, setBusy } from './helpers.js';

const ENCODABLE = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export function createResizePanel({ getActiveFile, messageBar }) {
  const preview = el('img', { class: 'preview-img', alt: 'Resized preview' });
  const originalDimsEl = el('span', { class: 'stat-value', text: '—' });
  const outputDimsEl = el('span', { class: 'stat-value', text: '—' });
  const outputSizeEl = el('span', { class: 'stat-value', text: '—' });

  const widthInput = el('input', { type: 'number', min: '1', id: 'resize-width', class: 'input-number' });
  const heightInput = el('input', { type: 'number', min: '1', id: 'resize-height', class: 'input-number' });
  const lockToggle = el('input', { type: 'checkbox', id: 'resize-lock', checked: true });
  const percentInput = el('input', { type: 'number', min: '1', max: '500', id: 'resize-percent', class: 'input-number', placeholder: '100' });
  const presetSelect = el('select', { id: 'resize-preset', class: 'select' }, [
    el('option', { value: '', text: 'Custom' }),
    ...PRESETS.map((p) => el('option', { value: p.id, text: p.label })),
  ]);

  const downloadBtn = el('button', { type: 'button', class: 'btn btn-primary', text: 'Download' });
  const busyEl = el('span', { class: 'spinner', role: 'status' }, [
    el('span', { class: 'spinner-ring', 'aria-hidden': 'true' }),
    el('span', { class: 'sr-only', text: 'Resizing…' }),
  ]);
  busyEl.hidden = true;

  const root = el('div', { class: 'panel panel-resize' }, [
    el('div', { class: 'panel-preview' }, [preview]),
    el('div', { class: 'panel-controls' }, [
      el('dl', { class: 'stat-list' }, [
        el('dt', { text: 'Original' }), el('dd', {}, [originalDimsEl]),
        el('dt', { text: 'Output' }), el('dd', {}, [outputDimsEl]),
        el('dt', { text: 'Output size' }), el('dd', {}, [outputSizeEl]),
      ]),
      el('div', { class: 'field-grid' }, [
        el('div', { class: 'field' }, [el('label', { for: 'resize-width', text: 'Width (px)' }), widthInput]),
        el('div', { class: 'field' }, [el('label', { for: 'resize-height', text: 'Height (px)' }), heightInput]),
      ]),
      el('div', { class: 'field field-inline' }, [
        lockToggle,
        el('label', { for: 'resize-lock', text: 'Lock aspect ratio' }),
      ]),
      el('div', { class: 'field' }, [
        el('label', { for: 'resize-percent', text: 'Scale (%)' }),
        percentInput,
      ]),
      el('div', { class: 'field' }, [
        el('label', { for: 'resize-preset', text: 'Preset' }),
        presetSelect,
      ]),
      el('div', { class: 'panel-actions' }, [downloadBtn, busyEl]),
    ]),
  ]);

  const outputSlot = createObjectUrlSlot();
  let currentFile = null;
  let currentResult = null;
  let natural = { width: 0, height: 0 };
  let lastEdited = 'dimensions'; // 'dimensions' | 'percent'
  let avifSupported = true;
  let syncing = false;

  function defaultFormatFor(file) {
    if (file.type === 'image/avif' && !avifSupported) return 'image/webp';
    if (ENCODABLE.includes(file.type)) return file.type;
    return 'image/jpeg';
  }

  async function loadNaturalSize(file) {
    const bitmap = await decodeImage(file);
    natural = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
  }

  function syncFromDimensions() {
    if (syncing) return;
    syncing = true;
    const opts = {
      width: widthInput.value ? Number(widthInput.value) : undefined,
      height: heightInput.value ? Number(heightInput.value) : undefined,
      lockAspect: lockToggle.checked,
    };
    const dims = computeDimensions(natural, opts);
    widthInput.value = dims.width;
    heightInput.value = dims.height;
    syncing = false;
    return dims;
  }

  function syncFromPercent() {
    const percent = Number(percentInput.value) || 100;
    const dims = computeDimensions(natural, { percent, lockAspect: true });
    syncing = true;
    widthInput.value = dims.width;
    heightInput.value = dims.height;
    syncing = false;
    return dims;
  }

  async function process() {
    if (!currentFile || !natural.width) return;
    setBusy(root, true);
    busyEl.hidden = false;
    try {
      const format = defaultFormatFor(currentFile);
      const opts = { lockAspect: lockToggle.checked, format, quality: 0.8 };
      if (lastEdited === 'percent' && percentInput.value) {
        opts.percent = Number(percentInput.value);
      } else {
        opts.width = Number(widthInput.value) || undefined;
        opts.height = Number(heightInput.value) || undefined;
      }
      const result = await runInWorker('resize', { source: currentFile, opts });
      currentResult = result;
      preview.src = outputSlot.set(result.blob);
      outputDimsEl.textContent = `${result.width} × ${result.height}`;
      outputSizeEl.textContent = formatBytes(result.blob.size);
    } catch (err) {
      messageBar.showError(toUserMessage(err));
    } finally {
      setBusy(root, false);
      busyEl.hidden = true;
    }
  }

  const debouncedProcess = debounce(process, 250);

  widthInput.addEventListener('input', () => {
    lastEdited = 'dimensions';
    presetSelect.value = '';
    syncFromDimensions();
    debouncedProcess();
  });
  heightInput.addEventListener('input', () => {
    lastEdited = 'dimensions';
    presetSelect.value = '';
    syncFromDimensions();
    debouncedProcess();
  });
  percentInput.addEventListener('input', () => {
    lastEdited = 'percent';
    presetSelect.value = '';
    syncFromPercent();
    debouncedProcess();
  });
  lockToggle.addEventListener('change', () => {
    lastEdited = 'dimensions';
    syncFromDimensions();
    debouncedProcess();
  });
  presetSelect.addEventListener('change', () => {
    const preset = PRESETS.find((p) => p.id === presetSelect.value);
    if (!preset) return;
    lastEdited = 'dimensions';
    syncing = true;
    widthInput.value = preset.width;
    heightInput.value = preset.height;
    syncing = false;
    process();
  });
  downloadBtn.addEventListener('click', () => {
    if (!currentResult || !currentFile) return;
    const format = defaultFormatFor(currentFile);
    const ext = MIME_TO_EXT[format] || 'jpg';
    downloadBlob(currentResult.blob, outputFilename(currentFile.name, '-resized', ext));
  });

  let avifReady = isTypeSupported('image/avif').then((supported) => {
    avifSupported = supported;
  });

  async function onActivate() {
    await avifReady;
    const file = getActiveFile();
    if (!file) return;
    if (file !== currentFile) {
      currentFile = file;
      presetSelect.value = '';
      lastEdited = 'dimensions';
      percentInput.value = '';
      try {
        await loadNaturalSize(file);
      } catch (err) {
        messageBar.showError(toUserMessage(err));
        return;
      }
      originalDimsEl.textContent = `${natural.width} × ${natural.height}`;
      syncing = true;
      widthInput.value = natural.width;
      heightInput.value = natural.height;
      syncing = false;
      await process();
    }
  }

  function destroy() {
    outputSlot.clear();
  }

  return { el: root, onActivate, destroy };
}
