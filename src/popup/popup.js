// src/popup/popup.js
// Entry point for the popup UI. Wires the header, import screen, tab bar,
// and all per-tool panels together. Runs both as the real MV3 action popup
// and inside dev/dev.html (behind the chrome-shim).

import { initThemeToggle } from '../components/theme.js';
import { initImportZone } from '../components/importZone.js';
import { createMessageBar } from '../components/messageBar.js';
import { createTabBar } from '../components/tabs.js';
import { createFileStrip } from '../components/fileStrip.js';
import { createCompressPanel } from '../components/compressPanel.js';
import { createResizePanel } from '../components/resizePanel.js';
import { createConvertPanel } from '../components/convertPanel.js';
import { createCropPanel } from '../components/cropPanel.js';
import { createTransformPanel } from '../components/transformPanel.js';
import { createBase64Panel } from '../components/base64Panel.js';
import { createMetadataPanel } from '../components/metadataPanel.js';
import { createBatchPanel } from '../components/batchPanel.js';
import { toUserMessage } from '../utils/errors.js';

function iconUrl(path) {
  if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
    return chrome.runtime.getURL(path);
  }
  return `/${path}`;
}

function setUpResponsiveLayout() {
  const mq = window.matchMedia('(min-width: 700px)');
  const apply = () => document.documentElement.classList.toggle('layout-tab', mq.matches);
  apply();
  mq.addEventListener('change', apply);
}

async function importFromQueryParam(state, messageBar) {
  const params = new URLSearchParams(window.location.search);
  const src = params.get('src');
  if (!src) return;

  try {
    const url = decodeURIComponent(src);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
    const blob = await res.blob();
    const name = (() => {
      try {
        const pathname = new URL(url).pathname;
        const last = pathname.split('/').filter(Boolean).pop();
        return last || 'image';
      } catch {
        return 'image';
      }
    })();
    const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
    state.addFiles([file]);
  } catch {
    messageBar.showError(
      "Couldn't load that image (the site may block cross-origin access). Download it and import manually."
    );
  }
}

function main() {
  setUpResponsiveLayout();

  const appIcon = document.getElementById('app-icon');
  appIcon.src = iconUrl('public/icons/icon32.png');

  initThemeToggle(document.querySelector('.theme-toggle'));

  const messageBar = createMessageBar(document.getElementById('message-bar-slot'));

  const importScreen = document.getElementById('import-screen');
  const workspace = document.getElementById('workspace');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const chooseBtn = document.getElementById('choose-file-btn');
  const importMoreBtn = document.getElementById('import-more-btn');
  const fileStripEl = document.getElementById('file-strip');
  const tabBarEl = document.getElementById('tab-bar');
  const panelHostEl = document.getElementById('panel-host');

  const state = {
    files: [],
    activeIndex: 0,
    addFiles(newFiles) {
      const wasEmpty = this.files.length === 0;
      this.files = this.files.concat(newFiles);
      this.activeIndex = this.files.length - newFiles.length; // focus first newly-added file
      onFilesChanged(wasEmpty);
    },
  };

  function getActiveFile() {
    return state.files[state.activeIndex] || null;
  }
  function getFiles() {
    return state.files;
  }

  const fileStrip = createFileStrip(fileStripEl, {
    onSelect(index) {
      state.activeIndex = index;
      fileStrip.render(state.files, state.activeIndex);
      activateCurrentPanel();
    },
  });

  const panelDeps = { getActiveFile, getFiles, messageBar };
  const panels = [
    { id: 'compress', label: 'Compress', panel: createCompressPanel(panelDeps) },
    { id: 'resize', label: 'Resize', panel: createResizePanel(panelDeps) },
    { id: 'convert', label: 'Convert', panel: createConvertPanel(panelDeps) },
    { id: 'crop', label: 'Crop', panel: createCropPanel(panelDeps) },
    { id: 'transform', label: 'Rotate/Flip', panel: createTransformPanel(panelDeps) },
    { id: 'base64', label: 'Base64', panel: createBase64Panel(panelDeps) },
    { id: 'metadata', label: 'Metadata', panel: createMetadataPanel(panelDeps) },
  ];
  const batchTab = { id: 'batch', label: 'Batch', panel: createBatchPanel(panelDeps) };

  const tabBar = createTabBar(tabBarEl, panelHostEl);

  function activateCurrentPanel() {
    const entry = [...panels, batchTab].find((t) => t.id === tabBar.activeId);
    if (entry && typeof entry.panel.onActivate === 'function') entry.panel.onActivate();
  }

  function onFilesChanged(wasEmpty) {
    if (wasEmpty && state.files.length > 0) {
      importScreen.hidden = true;
      workspace.hidden = false;
    }
    const tabs = state.files.length > 1 ? [...panels, batchTab] : panels;
    const hadTabs = tabBarEl.children.length > 0;
    if (!hadTabs || tabs.length !== [...tabBarEl.querySelectorAll('[data-tab-id]')].length) {
      tabBar.setTabs(tabs);
    }
    fileStrip.render(state.files, state.activeIndex);
    activateCurrentPanel();
  }

  initImportZone({
    dropZone,
    fileInput,
    chooseBtn,
    onImport(files) {
      messageBar.hide();
      state.addFiles(files);
    },
    onRejected(message) {
      messageBar.showError(message);
    },
  });

  importMoreBtn.addEventListener('click', () => fileInput.click());

  importFromQueryParam(state, messageBar);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
