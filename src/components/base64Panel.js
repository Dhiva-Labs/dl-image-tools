// src/components/base64Panel.js
// Base64 tab: encode the active imported file, or decode pasted base64 /
// data URIs back into an image. Both are light operations per CONTRACTS.md
// ("light ones (metadata, base64) may be called directly") so neither goes
// through the worker.

import { toBase64, fromBase64 } from '../tools/base64.js';
import { MIME_TO_EXT, outputFilename } from '../utils/image.js';
import { downloadBlob } from '../utils/download.js';
import { toUserMessage } from '../utils/errors.js';
import { el, debounce, setBusy } from './helpers.js';

const TRUNCATE_AT = 200;

export function createBase64Panel({ getActiveFile, messageBar }) {
  const modeEncodeBtn = el('button', { type: 'button', class: 'segmented-btn', text: 'Encode', 'aria-pressed': 'true' });
  const modeDecodeBtn = el('button', { type: 'button', class: 'segmented-btn', text: 'Decode', 'aria-pressed': 'false' });
  const modeRow = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Base64 mode' }, [modeEncodeBtn, modeDecodeBtn]);

  // --- Encode mode ---
  const encodeOutput = el('p', { class: 'base64-output', text: '—' });
  const encodeCharCount = el('span', { class: 'stat-value', text: '—' });
  const copyBtn = el('button', { type: 'button', class: 'btn btn-secondary', text: 'Copy' });
  const downloadTxtBtn = el('button', { type: 'button', class: 'btn btn-primary', text: 'Download as .txt' });
  const encodeSection = el('div', { class: 'base64-section' }, [
    encodeOutput,
    el('dl', { class: 'stat-list' }, [
      el('dt', { text: 'Character count' }), el('dd', {}, [encodeCharCount]),
    ]),
    el('div', { class: 'panel-actions' }, [copyBtn, downloadTxtBtn]),
  ]);

  // --- Decode mode ---
  const decodeInput = el('textarea', {
    class: 'base64-input',
    rows: '6',
    placeholder: 'Paste base64 text or a data:image/… URI here',
    'aria-label': 'Base64 input',
  });
  const decodePreview = el('img', { class: 'preview-img preview-img-small', alt: 'Decoded preview', hidden: true });
  const decodeDownloadBtn = el('button', { type: 'button', class: 'btn btn-primary', text: 'Download' });
  decodeDownloadBtn.disabled = true;
  const decodeSection = el('div', { class: 'base64-section', hidden: true }, [
    decodeInput,
    decodePreview,
    el('div', { class: 'panel-actions' }, [decodeDownloadBtn]),
  ]);

  const busyEl = el('span', { class: 'spinner', role: 'status' }, [
    el('span', { class: 'spinner-ring', 'aria-hidden': 'true' }),
    el('span', { class: 'sr-only', text: 'Working…' }),
  ]);
  busyEl.hidden = true;

  const root = el('div', { class: 'panel panel-base64' }, [modeRow, encodeSection, decodeSection, busyEl]);

  let currentFile = null;
  let encodedResult = null;
  let decodedResult = null;
  let decodedObjectUrl = null;

  function setMode(mode) {
    const isEncode = mode === 'encode';
    modeEncodeBtn.setAttribute('aria-pressed', isEncode ? 'true' : 'false');
    modeDecodeBtn.setAttribute('aria-pressed', isEncode ? 'false' : 'true');
    encodeSection.hidden = !isEncode;
    decodeSection.hidden = isEncode;
  }
  modeEncodeBtn.addEventListener('click', () => setMode('encode'));
  modeDecodeBtn.addEventListener('click', () => setMode('decode'));

  async function runEncode(file) {
    setBusy(root, true);
    busyEl.hidden = false;
    try {
      const result = await toBase64(file);
      encodedResult = result;
      encodeOutput.textContent = result.base64.length > TRUNCATE_AT
        ? `${result.base64.slice(0, TRUNCATE_AT)}…`
        : result.base64;
      encodeCharCount.textContent = String(result.charCount);
    } catch (err) {
      messageBar.showError(toUserMessage(err));
    } finally {
      setBusy(root, false);
      busyEl.hidden = true;
    }
  }

  copyBtn.addEventListener('click', async () => {
    if (!encodedResult) return;
    try {
      await navigator.clipboard.writeText(encodedResult.base64);
    } catch {
      messageBar.showError("Couldn't copy to clipboard. Try selecting and copying the text manually.");
    }
  });

  downloadTxtBtn.addEventListener('click', () => {
    if (!encodedResult || !currentFile) return;
    const blob = new Blob([encodedResult.base64], { type: 'text/plain' });
    downloadBlob(blob, outputFilename(currentFile.name, '-base64', 'txt'));
  });

  const runDecode = debounce(async () => {
    const text = decodeInput.value.trim();
    if (!text) {
      decodePreview.hidden = true;
      decodeDownloadBtn.disabled = true;
      decodedResult = null;
      return;
    }
    setBusy(root, true);
    busyEl.hidden = false;
    try {
      const result = await fromBase64(text);
      decodedResult = result;
      if (decodedObjectUrl && decodedObjectUrl !== result.objectUrl) URL.revokeObjectURL(decodedObjectUrl);
      decodedObjectUrl = result.objectUrl;
      decodePreview.src = result.objectUrl;
      decodePreview.hidden = false;
      decodeDownloadBtn.disabled = false;
    } catch (err) {
      decodePreview.hidden = true;
      decodeDownloadBtn.disabled = true;
      decodedResult = null;
      messageBar.showError(toUserMessage(err));
    } finally {
      setBusy(root, false);
      busyEl.hidden = true;
    }
  }, 400);

  decodeInput.addEventListener('input', runDecode);

  decodeDownloadBtn.addEventListener('click', () => {
    if (!decodedResult) return;
    const ext = MIME_TO_EXT[decodedResult.mime] || 'png';
    downloadBlob(decodedResult.blob, outputFilename('image', '-decoded', ext));
  });

  async function onActivate() {
    const file = getActiveFile();
    if (!file) return;
    if (file !== currentFile) {
      currentFile = file;
      await runEncode(file);
    }
  }

  function destroy() {
    if (decodedObjectUrl) URL.revokeObjectURL(decodedObjectUrl);
  }

  return { el: root, onActivate, destroy };
}
