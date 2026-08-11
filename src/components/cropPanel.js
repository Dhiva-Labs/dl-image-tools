// src/components/cropPanel.js
// Crop tab: interactive crop rectangle drawn as positioned divs over the
// preview image (no canvas needed for the interaction itself — only the
// final crop() call, done in the worker, touches a canvas). Uses the
// `box-shadow: 0 0 0 2000px rgba(...)` trick to dim everything outside the
// crop rectangle without extra overlay elements.
//
// Worker contract assumption: runInWorker('crop', { source, opts }) with
// opts = { rect, format, quality }, mirroring
// crop(source, rect, { format, quality }) from src/tools/cropper.js.

import { runInWorker } from '../utils/worker-client.js';
import { ASPECT_RATIOS } from '../tools/cropper.js';
import { decodeImage, formatBytes, outputFilename, MIME_TO_EXT } from '../utils/image.js';
import { downloadBlob } from '../utils/download.js';
import { toUserMessage } from '../utils/errors.js';
import { el, clamp, createObjectUrlSlot, setBusy } from './helpers.js';

const MIN_SIZE = 16; // minimum crop size, in natural image pixels
const HANDLES = ['nw', 'ne', 'sw', 'se'];

export function createCropPanel({ getActiveFile, messageBar }) {
  const img = el('img', { class: 'crop-image', alt: 'Image to crop', draggable: 'false' });
  const rectEl = el('div', { class: 'crop-rect' });
  const handleEls = new Map();
  HANDLES.forEach((h) => {
    const handle = el('div', { class: `crop-handle crop-handle-${h}`, 'data-handle': h });
    handleEls.set(h, handle);
    rectEl.appendChild(handle);
  });
  const stage = el('div', { class: 'crop-stage' }, [img, rectEl]);

  const aspectRow = el('div', { class: 'format-btn-row', role: 'group', 'aria-label': 'Aspect ratio' },
    ASPECT_RATIOS.map((a) => {
      const btn = el('button', { type: 'button', class: 'btn btn-format', text: a.label });
      btn.dataset.aspectId = a.id;
      return btn;
    }));

  const outputDimsEl = el('span', { class: 'stat-value', text: '—' });
  const outputSizeEl = el('span', { class: 'stat-value', text: '—' });

  const resetBtn = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Reset' });
  const applyBtn = el('button', { type: 'button', class: 'btn btn-primary', text: 'Apply' });
  const downloadBtn = el('button', { type: 'button', class: 'btn btn-primary', text: 'Download' });
  downloadBtn.disabled = true;
  const busyEl = el('span', { class: 'spinner', role: 'status' }, [
    el('span', { class: 'spinner-ring', 'aria-hidden': 'true' }),
    el('span', { class: 'sr-only', text: 'Cropping…' }),
  ]);
  busyEl.hidden = true;

  const resultPreview = el('img', { class: 'preview-img preview-img-small', alt: 'Cropped result', hidden: true });

  const root = el('div', { class: 'panel panel-crop' }, [
    el('div', { class: 'panel-preview' }, [stage]),
    el('div', { class: 'panel-controls' }, [
      el('div', { class: 'field' }, [
        el('span', { class: 'field-label-static', text: 'Aspect ratio' }),
        aspectRow,
      ]),
      el('dl', { class: 'stat-list' }, [
        el('dt', { text: 'Crop size' }), el('dd', {}, [outputDimsEl]),
        el('dt', { text: 'Output size' }), el('dd', {}, [outputSizeEl]),
      ]),
      resultPreview,
      el('div', { class: 'panel-actions' }, [resetBtn, applyBtn, downloadBtn, busyEl]),
    ]),
  ]);

  const resultSlot = createObjectUrlSlot();
  let currentFile = null;
  let currentResult = null;
  let natural = { width: 0, height: 0 };
  let rect = { x: 0, y: 0, width: 0, height: 0 };
  let aspectRatio = null; // null = free

  function scale() {
    return img.clientWidth ? img.clientWidth / natural.width : 1;
  }

  function paintRect() {
    const s = scale();
    rectEl.style.left = `${rect.x * s}px`;
    rectEl.style.top = `${rect.y * s}px`;
    rectEl.style.width = `${rect.width * s}px`;
    rectEl.style.height = `${rect.height * s}px`;
    outputDimsEl.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
  }

  function clampRect(r) {
    let { x, y, width, height } = r;
    width = clamp(width, MIN_SIZE, natural.width);
    height = clamp(height, MIN_SIZE, natural.height);
    x = clamp(x, 0, natural.width - width);
    y = clamp(y, 0, natural.height - height);
    return { x, y, width, height };
  }

  function defaultRect() {
    const width = Math.round(natural.width * 0.8);
    const height = Math.round(natural.height * 0.8);
    return clampRect({
      x: Math.round((natural.width - width) / 2),
      y: Math.round((natural.height - height) / 2),
      width,
      height,
    });
  }

  function applyAspect(id) {
    const preset = ASPECT_RATIOS.find((a) => a.id === id) || ASPECT_RATIOS[0];
    aspectRatio = preset.ratio;
    aspectRow.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b.dataset.aspectId === preset.id));
    if (aspectRatio) {
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      let width = rect.width;
      let height = width / aspectRatio;
      if (height > natural.height) {
        height = natural.height;
        width = height * aspectRatio;
      }
      rect = clampRect({ x: cx - width / 2, y: cy - height / 2, width, height });
      paintRect();
    }
  }

  function pointerToNatural(e) {
    const stageRect = stage.getBoundingClientRect();
    const s = scale();
    return {
      x: (e.clientX - stageRect.left) / s,
      y: (e.clientY - stageRect.top) / s,
    };
  }

  function startDrag(e) {
    if (e.target.closest('.crop-handle')) return; // handles have their own listener
    e.preventDefault();
    const start = pointerToNatural(e);
    const startRect = { ...rect };
    rectEl.setPointerCapture(e.pointerId);

    function onMove(ev) {
      const p = pointerToNatural(ev);
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      rect = clampRect({ ...startRect, x: startRect.x + dx, y: startRect.y + dy });
      paintRect();
    }
    function onUp(ev) {
      rectEl.releasePointerCapture(ev.pointerId);
      rectEl.removeEventListener('pointermove', onMove);
      rectEl.removeEventListener('pointerup', onUp);
    }
    rectEl.addEventListener('pointermove', onMove);
    rectEl.addEventListener('pointerup', onUp);
  }
  rectEl.addEventListener('pointerdown', startDrag);

  function startResize(handleName, e) {
    e.preventDefault();
    e.stopPropagation();
    const start = pointerToNatural(e);
    const startRect = { ...rect };
    const handleEl = handleEls.get(handleName);
    handleEl.setPointerCapture(e.pointerId);

    function onMove(ev) {
      const p = pointerToNatural(ev);
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      let { x, y, width, height } = startRect;

      if (handleName.includes('e')) width = startRect.width + dx;
      if (handleName.includes('s')) height = startRect.height + dy;
      if (handleName.includes('w')) {
        width = startRect.width - dx;
        x = startRect.x + dx;
      }
      if (handleName.includes('n')) {
        height = startRect.height - dy;
        y = startRect.y + dy;
      }

      if (aspectRatio) {
        height = width / aspectRatio;
        if (handleName.includes('n')) y = startRect.y + startRect.height - height;
      }

      width = Math.max(MIN_SIZE, width);
      height = Math.max(MIN_SIZE, height);
      rect = clampRect({ x, y, width, height });
      paintRect();
    }
    function onUp(ev) {
      handleEl.releasePointerCapture(ev.pointerId);
      handleEl.removeEventListener('pointermove', onMove);
      handleEl.removeEventListener('pointerup', onUp);
    }
    handleEl.addEventListener('pointermove', onMove);
    handleEl.addEventListener('pointerup', onUp);
  }
  handleEls.forEach((handleEl, name) => {
    handleEl.addEventListener('pointerdown', (e) => startResize(name, e));
  });

  aspectRow.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => applyAspect(btn.dataset.aspectId));
  });

  resetBtn.addEventListener('click', () => {
    rect = defaultRect();
    applyAspect('free');
    paintRect();
  });

  applyBtn.addEventListener('click', async () => {
    if (!currentFile) return;
    setBusy(root, true);
    busyEl.hidden = false;
    try {
      const format = MIME_TO_EXT[currentFile.type] ? currentFile.type : 'image/jpeg';
      const result = await runInWorker('crop', {
        source: currentFile,
        opts: {
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          format,
          quality: 0.9,
        },
      });
      currentResult = result;
      resultPreview.src = resultSlot.set(result.blob);
      resultPreview.hidden = false;
      outputSizeEl.textContent = formatBytes(result.blob.size);
      downloadBtn.disabled = false;
    } catch (err) {
      messageBar.showError(toUserMessage(err));
    } finally {
      setBusy(root, false);
      busyEl.hidden = true;
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!currentResult || !currentFile) return;
    const ext = MIME_TO_EXT[currentResult.blob.type] || MIME_TO_EXT[currentFile.type] || 'jpg';
    downloadBlob(currentResult.blob, outputFilename(currentFile.name, '-cropped', ext));
  });

  window.addEventListener('resize', () => paintRect());

  async function onActivate() {
    const file = getActiveFile();
    if (!file) return;
    if (file !== currentFile) {
      currentFile = file;
      currentResult = null;
      downloadBtn.disabled = true;
      resultPreview.hidden = true;
      resultSlot.clear();

      let bitmap;
      try {
        bitmap = await decodeImage(file);
      } catch (err) {
        messageBar.showError(toUserMessage(err));
        return;
      }
      natural = { width: bitmap.width, height: bitmap.height };
      bitmap.close();

      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        rect = defaultRect();
        applyAspect('free');
        paintRect();
      };
      img.src = objectUrl;
      img.dataset.objectUrl = objectUrl;
    }
  }

  function destroy() {
    resultSlot.clear();
    if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl);
  }

  return { el: root, onActivate, destroy };
}
