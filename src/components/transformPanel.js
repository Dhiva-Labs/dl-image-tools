// src/components/transformPanel.js
// Rotate/Flip tab: rotate 90/180/270, flip horizontal/vertical, applied
// cumulatively (each action's output becomes the next action's source),
// matching how a real editor composes transforms. Reset returns to the
// original imported file.
//
// Worker contract assumption: runInWorker('rotate', { source, opts }) with
// opts = { degrees, format, quality }, and runInWorker('flip', { source,
// opts }) with opts = { axis, format, quality }, mirroring
// rotate(source, degrees, {format, quality}) / flip(source, axis, {...}).

import { runInWorker } from '../utils/worker-client.js';
import { isTypeSupported, formatBytes, outputFilename, MIME_TO_EXT } from '../utils/image.js';
import { downloadBlob } from '../utils/download.js';
import { toUserMessage } from '../utils/errors.js';
import { el, createObjectUrlSlot, setBusy } from './helpers.js';

const ENCODABLE = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export function createTransformPanel({ getActiveFile, messageBar }) {
  const preview = el('img', { class: 'preview-img', alt: 'Rotated / flipped preview' });
  const outputDimsEl = el('span', { class: 'stat-value', text: '—' });
  const outputSizeEl = el('span', { class: 'stat-value', text: '—' });

  const rotateRow = el('div', { class: 'format-btn-row', role: 'group', 'aria-label': 'Rotate' }, [
    el('button', { type: 'button', class: 'btn btn-format', text: 'Rotate 90°', 'data-degrees': '90' }),
    el('button', { type: 'button', class: 'btn btn-format', text: 'Rotate 180°', 'data-degrees': '180' }),
    el('button', { type: 'button', class: 'btn btn-format', text: 'Rotate 270°', 'data-degrees': '270' }),
  ]);
  const flipRow = el('div', { class: 'format-btn-row', role: 'group', 'aria-label': 'Flip' }, [
    el('button', { type: 'button', class: 'btn btn-format', text: 'Flip horizontal', 'data-axis': 'horizontal' }),
    el('button', { type: 'button', class: 'btn btn-format', text: 'Flip vertical', 'data-axis': 'vertical' }),
  ]);

  const resetBtn = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Reset' });
  const downloadBtn = el('button', { type: 'button', class: 'btn btn-primary', text: 'Download' });
  downloadBtn.disabled = true;
  const busyEl = el('span', { class: 'spinner', role: 'status' }, [
    el('span', { class: 'spinner-ring', 'aria-hidden': 'true' }),
    el('span', { class: 'sr-only', text: 'Applying…' }),
  ]);
  busyEl.hidden = true;

  const root = el('div', { class: 'panel panel-transform' }, [
    el('div', { class: 'panel-preview' }, [preview]),
    el('div', { class: 'panel-controls' }, [
      el('div', { class: 'field' }, [
        el('span', { class: 'field-label-static', text: 'Rotate' }),
        rotateRow,
      ]),
      el('div', { class: 'field' }, [
        el('span', { class: 'field-label-static', text: 'Flip' }),
        flipRow,
      ]),
      el('dl', { class: 'stat-list' }, [
        el('dt', { text: 'Dimensions' }), el('dd', {}, [outputDimsEl]),
        el('dt', { text: 'Output size' }), el('dd', {}, [outputSizeEl]),
      ]),
      el('div', { class: 'panel-actions' }, [resetBtn, downloadBtn, busyEl]),
    ]),
  ]);

  const outputSlot = createObjectUrlSlot();
  let currentFile = null;
  let workingSource = null; // File initially, then Blob after each transform
  let currentResult = null;
  let avifSupported = true;

  function outputFormat() {
    if (currentFile.type === 'image/avif' && !avifSupported) return 'image/webp';
    if (ENCODABLE.includes(currentFile.type)) return currentFile.type;
    return 'image/jpeg';
  }

  function showResult(result) {
    currentResult = result;
    preview.src = outputSlot.set(result.blob);
    outputDimsEl.textContent = `${result.width} × ${result.height}`;
    outputSizeEl.textContent = formatBytes(result.blob.size);
    downloadBtn.disabled = false;
  }

  async function runOp(op, opts) {
    if (!currentFile) return;
    setBusy(root, true);
    busyEl.hidden = false;
    try {
      const result = await runInWorker(op, {
        source: workingSource,
        opts: { ...opts, format: outputFormat(), quality: 0.8 },
      });
      workingSource = result.blob;
      showResult(result);
    } catch (err) {
      messageBar.showError(toUserMessage(err));
    } finally {
      setBusy(root, false);
      busyEl.hidden = true;
    }
  }

  rotateRow.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => runOp('rotate', { degrees: Number(btn.dataset.degrees) }));
  });
  flipRow.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => runOp('flip', { axis: btn.dataset.axis }));
  });

  resetBtn.addEventListener('click', () => {
    if (!currentFile) return;
    workingSource = currentFile;
    preview.src = outputSlot.set(currentFile);
    currentResult = null;
    downloadBtn.disabled = true;
    outputSizeEl.textContent = formatBytes(currentFile.size);
    outputDimsEl.textContent = '—';
  });

  downloadBtn.addEventListener('click', () => {
    if (!currentResult || !currentFile) return;
    const ext = MIME_TO_EXT[outputFormat()] || 'jpg';
    downloadBlob(currentResult.blob, outputFilename(currentFile.name, '-edited', ext));
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
      workingSource = file;
      currentResult = null;
      downloadBtn.disabled = true;
      preview.src = outputSlot.set(file);
      outputSizeEl.textContent = formatBytes(file.size);
      outputDimsEl.textContent = '—';
    }
  }

  function destroy() {
    outputSlot.clear();
  }

  return { el: root, onActivate, destroy };
}
