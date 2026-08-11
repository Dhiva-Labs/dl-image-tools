// DL Image Tools — background service worker (Manifest V3, module type).
// Creates the "image" context-menu entries and routes their clicks.
// No imports needed: this worker only talks to chrome.contextMenus,
// chrome.downloads and chrome.tabs.

const PARENT_ID = 'dl-image-tools';
const DOWNLOAD_ID = 'dl-download';
const OPEN_ID = 'dl-open';

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      console.error('DL Image Tools: failed to clear context menus', chrome.runtime.lastError);
    }

    chrome.contextMenus.create({
      id: PARENT_ID,
      title: 'DL Image Tools',
      contexts: ['image'],
    });

    chrome.contextMenus.create({
      id: DOWNLOAD_ID,
      parentId: PARENT_ID,
      title: 'Download image',
      contexts: ['image'],
    });

    chrome.contextMenus.create({
      id: OPEN_ID,
      parentId: PARENT_ID,
      title: 'Open in DL Image Tools',
      contexts: ['image'],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  try {
    createContextMenus();
  } catch (err) {
    console.error('DL Image Tools: onInstalled failed', err);
  }
});

chrome.contextMenus.onClicked.addListener((info) => {
  try {
    if (info.menuItemId === DOWNLOAD_ID) {
      if (!info.srcUrl) {
        console.error('DL Image Tools: download clicked without srcUrl');
        return;
      }
      chrome.downloads.download({ url: info.srcUrl }, () => {
        if (chrome.runtime.lastError) {
          console.error('DL Image Tools: download failed', chrome.runtime.lastError);
        }
      });
      return;
    }

    if (info.menuItemId === OPEN_ID) {
      if (!info.srcUrl) {
        console.error('DL Image Tools: open clicked without srcUrl');
        return;
      }
      const url = `${chrome.runtime.getURL('src/popup/popup.html')}?src=${encodeURIComponent(info.srcUrl)}`;
      chrome.tabs.create({ url });
      return;
    }
  } catch (err) {
    console.error('DL Image Tools: context menu click handler failed', err);
  }
});
