// src/components/fileStrip.js
// Thumbnail strip shown when more than one image is imported, letting the
// user pick which file the single-image panels (Compress, Resize, Convert,
// Crop, Rotate/Flip, Base64, Metadata) currently operate on. The Batch panel
// ignores this selection and always covers every imported file.

export function createFileStrip(root, { onSelect }) {
  const urls = [];

  function clearUrls() {
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls.length = 0;
  }

  function render(files, activeIndex) {
    clearUrls();
    root.innerHTML = '';

    if (!files || files.length < 2) {
      root.hidden = true;
      return;
    }
    root.hidden = false;

    files.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      urls.push(url);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'file-chip';
      btn.classList.toggle('is-active', index === activeIndex);
      btn.setAttribute('aria-pressed', index === activeIndex ? 'true' : 'false');
      btn.title = file.name;
      btn.addEventListener('click', () => onSelect(index));

      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.className = 'file-chip-thumb';

      const label = document.createElement('span');
      label.className = 'file-chip-label';
      label.textContent = file.name;

      btn.appendChild(img);
      btn.appendChild(label);
      root.appendChild(btn);
    });
  }

  function destroy() {
    clearUrls();
    root.innerHTML = '';
  }

  return { render, destroy };
}
