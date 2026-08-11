import { createZip } from './zip.js';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadAll(entries) {
  if (!entries || entries.length === 0) return;

  if (entries.length === 1) {
    downloadBlob(entries[0].blob, entries[0].filename);
    return;
  }

  const zipEntries = entries.map((entry) => ({ name: entry.filename, blob: entry.blob }));
  const zipBlob = await createZip(zipEntries);
  downloadBlob(zipBlob, 'dl-image-tools.zip');
}
