// src/components/batchPanel.js
// Batch tab: appears when more than one file is imported. Applies one
// operation (Compress/Resize/Convert) with a shared set of options across
// every imported file, tracks per-file status, and zips successful results
// via downloadAll from ../utils/download.js.
//
// Worker contract assumptions match the single-file panels: opts = {source,
// opts} where opts carries whatever the underlying tool needs (see
// compressPanel.js / resizePanel.js / convertPanel.js for the per-op shape).

import { runInWorker } from '../utils/worker-client.js';
import { PRESETS } from '../tools/resizer.js';
import { isTypeSupported, formatBytes, outputFilename, MIME_TO_EXT } from '../utils/image.js';
import { downloadAll } from '../utils/download.js';
import { toUserMessage } from '../utils/errors.js';
import { el, setBusy } from './helpers.js';

const STATUS_ICON = { pending: '⏳', working: '⏳', done: '✓', error: '✗' };

export function createBatchPanel({ getFiles, messageBar }) {
  const opSelect = el('select', { id: 'batch-op', class: 'select' }, [
    el('option', { value: 'compress', text: 'Compress' }),
    el('option', { value: 'resize', text: 'Resize' }),
    el('option', { value: 'convert', text: 'Convert' }),
  ]);

  // Compress options
  const qualityInput = el('input', { type: 'range', min: '1', max: '100', value: '80', class: 'slider' });
  const qualityValue = el('span', { class: 'field-value', text: '80' });
  const compressFormatSelect = el('select', { class: 'select' }, [
    el('option', { value: 'image/jpeg', text: 'JPG' }),
    el('option', { value: 'image/webp', text: 'WebP' }),
    el('option', { value: 'image/png', text: 'PNG' }),
    el('option', { value: 'image/avif', text: 'AVIF' }),
  ]);
  const compressOptions = el('div', { class: 'field-grid' }, [
    el('div', { class: 'field' }, [el('label', { text: 'Quality' }), el('div', { class: 'field-row' }, [qualityInput, qualityValue])]),
    el('div', { class: 'field' }, [el('label', { text: 'Format' }), compressFormatSelect]),
  ]);

  // Resize options
  const percentInput = el('input', { type: 'number', min: '1', max: '500', value: '100', class: 'input-number' });
  const presetSelect = el('select', { class: 'select' }, [
    el('option', { value: '', text: 'Use scale (%)' }),
    ...PRESETS.map((p) => el('option', { value: p.id, text: p.label })),
  ]);
  const resizeOptions = el('div', { class: 'field-grid' }, [
    el('div', { class: 'field' }, [el('label', { text: 'Scale (%)' }), percentInput]),
    el('div', { class: 'field' }, [el('label', { text: 'Preset' }), presetSelect]),
  ]);

  // Convert options
  const convertFormatSelect = el('select', { class: 'select' }, [
    el('option', { value: 'image/jpeg', text: 'JPG' }),
    el('option', { value: 'image/png', text: 'PNG' }),
    el('option', { value: 'image/webp', text: 'WebP' }),
    el('option', { value: 'image/avif', text: 'AVIF' }),
  ]);
  const convertOptions = el('div', { class: 'field-grid' }, [
    el('div', { class: 'field' }, [el('label', { text: 'Target format' }), convertFormatSelect]),
  ]);

  const optionsHost = el('div', { class: 'batch-options' }, [compressOptions, resizeOptions, convertOptions]);
  resizeOptions.hidden = true;
  convertOptions.hidden = true;

  const listEl = el('ul', { class: 'batch-list', 'aria-label': 'Files' });
  const progressEl = el('progress', { class: 'batch-progress', value: '0', max: '1' });
  const progressLabel = el('span', { class: 'stat-value', text: '0 of 0' });

  const processBtn = el('button', { type: 'button', class: 'btn btn-primary', text: 'Process all' });
  const downloadAllBtn = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Download all' });
  downloadAllBtn.disabled = true;

  const root = el('div', { class: 'panel panel-batch' }, [
    el('div', { class: 'field' }, [el('label', { text: 'Operation' }), opSelect]),
    optionsHost,
    listEl,
    el('div', { class: 'batch-progress-row' }, [progressEl, progressLabel]),
    el('div', { class: 'panel-actions' }, [processBtn, downloadAllBtn]),
  ]);

  let files = [];
  let rows = [];
  let results = [];
  let avifSupported = true;

  isTypeSupported('image/avif').then((supported) => {
    avifSupported = supported;
    [compressFormatSelect, convertFormatSelect].forEach((select) => {
      const avifOption = Array.from(select.options).find((o) => o.value === 'image/avif');
      if (avifOption) avifOption.disabled = !avifSupported;
    });
  });

  opSelect.addEventListener('change', () => {
    compressOptions.hidden = opSelect.value !== 'compress';
    resizeOptions.hidden = opSelect.value !== 'resize';
    convertOptions.hidden = opSelect.value !== 'convert';
  });

  qualityInput.addEventListener('input', () => {
    qualityValue.textContent = qualityInput.value;
  });

  function renderList() {
    listEl.innerHTML = '';
    rows = files.map((file) => {
      const icon = el('span', { class: 'batch-status', 'aria-hidden': 'true', text: STATUS_ICON.pending });
      const name = el('span', { class: 'batch-name', text: file.name });
      const size = el('span', { class: 'batch-size', text: formatBytes(file.size) });
      const errorText = el('span', { class: 'batch-error', hidden: true });
      const li = el('li', { class: 'batch-row' }, [icon, name, size, errorText]);
      listEl.appendChild(li);
      return { file, icon, errorText, status: 'pending' };
    });
    progressEl.max = String(files.length || 1);
    progressEl.value = '0';
    progressLabel.textContent = `0 of ${files.length}`;
  }

  function setRowStatus(row, status, message) {
    row.status = status;
    row.icon.textContent = STATUS_ICON[status];
    if (status === 'error' && message) {
      row.errorText.textContent = message;
      row.errorText.hidden = false;
    } else {
      row.errorText.hidden = true;
    }
  }

  function updateProgress(done) {
    progressEl.value = String(done);
    progressLabel.textContent = `${done} of ${files.length}`;
  }

  async function processFile(file) {
    const op = opSelect.value;
    if (op === 'compress') {
      const format = compressFormatSelect.value;
      const quality = Number(qualityInput.value) / 100;
      const result = await runInWorker('compress', { source: file, opts: { format, quality } });
      return { blob: result.blob, filename: outputFilename(file.name, '-compressed', MIME_TO_EXT[format] || 'jpg') };
    }
    if (op === 'resize') {
      const opts = { lockAspect: true, quality: 0.8 };
      const preset = PRESETS.find((p) => p.id === presetSelect.value);
      if (preset) {
        opts.width = preset.width;
        opts.height = preset.height;
      } else {
        opts.percent = Number(percentInput.value) || 100;
      }
      const result = await runInWorker('resize', { source: file, opts });
      const ext = MIME_TO_EXT[file.type] || 'jpg';
      return { blob: result.blob, filename: outputFilename(file.name, '-resized', ext) };
    }
    // convert
    const format = convertFormatSelect.value;
    const result = await runInWorker('convert', { source: file, opts: { format, quality: 0.92 } });
    return { blob: result.blob, filename: outputFilename(file.name, '-converted', MIME_TO_EXT[format] || 'jpg') };
  }

  processBtn.addEventListener('click', async () => {
    if (!files.length) return;
    setBusy(root, true);
    downloadAllBtn.disabled = true;
    results = [];
    let done = 0;
    updateProgress(0);
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      setRowStatus(row, 'working');
      try {
        const result = await processFile(row.file);
        results.push(result);
        setRowStatus(row, 'done');
      } catch (err) {
        setRowStatus(row, 'error', toUserMessage(err));
      }
      done += 1;
      updateProgress(done);
    }
    setBusy(root, false);
    if (results.length) downloadAllBtn.disabled = false;
    if (results.length < files.length) {
      messageBar.showError('Some files could not be processed. See the list for details.');
    }
  });

  downloadAllBtn.addEventListener('click', async () => {
    if (!results.length) return;
    try {
      await downloadAll(results);
    } catch (err) {
      messageBar.showError(toUserMessage(err));
    }
  });

  function onActivate() {
    files = getFiles();
    renderList();
    results = [];
    downloadAllBtn.disabled = true;
  }

  return { el: root, onActivate };
}
