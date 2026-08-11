// src/components/importZone.js
// Drag-drop zone, [Choose image] file input, and Ctrl+V paste support.
// Validates against ACCEPTED_TYPES from ../utils/image.js and reports
// results through onImport(files) / onRejected(message).

import { ACCEPTED_TYPES } from '../utils/image.js';

export function initImportZone({ dropZone, fileInput, chooseBtn, onImport, onRejected }) {
  fileInput.setAttribute('accept', ACCEPTED_TYPES.join(','));

  function filterAccepted(fileList) {
    const files = Array.from(fileList || []);
    const accepted = files.filter((f) => ACCEPTED_TYPES.includes(f.type));
    const rejectedCount = files.length - accepted.length;
    return { accepted, rejectedCount };
  }

  function handleFiles(fileList) {
    const { accepted, rejectedCount } = filterAccepted(fileList);
    if (accepted.length > 0) onImport(accepted);
    if (rejectedCount > 0) {
      onRejected(
        rejectedCount === 1
          ? "That file type isn't supported. Try JPG, PNG, WebP, AVIF, GIF or BMP."
          : `${rejectedCount} files were skipped — unsupported type. Try JPG, PNG, WebP, AVIF, GIF or BMP.`
      );
    }
  }

  chooseBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length) handleFiles(fileInput.files);
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'dragend'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      if (evt === 'dragleave' && e.target !== dropZone) return;
      dropZone.classList.remove('is-dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('is-dragover');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      handleFiles(e.dataTransfer.files);
    }
  });

  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  document.addEventListener('paste', (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    const files = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) {
      e.preventDefault();
      handleFiles(files);
    }
  });
}
