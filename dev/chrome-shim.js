// dev/chrome-shim.js
// Minimal window.chrome stub so the popup UI can run standalone in a plain
// browser tab, outside the extension runtime. Imported ONLY by dev/dev.html
// and never referenced from manifest.json.
//
// - storage.local: backed by localStorage (JSON-serialized).
// - runtime.getURL(path): returns '/' + path, so assets resolve from the
//   repo root when served with e.g. `python3 -m http.server`.
// - downloads / contextMenus: no-op stubs, just enough surface for code
//   that defensively checks for their presence.

if (typeof globalThis.chrome === 'undefined') {
  const readAll = () => {
    const result = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      try {
        result[key] = JSON.parse(localStorage.getItem(key));
      } catch {
        result[key] = localStorage.getItem(key);
      }
    }
    return result;
  };

  globalThis.chrome = {
    storage: {
      local: {
        get(keys, callback) {
          let result;
          if (keys == null) {
            result = readAll();
          } else {
            const keyList = Array.isArray(keys) ? keys : [keys];
            result = {};
            keyList.forEach((key) => {
              const raw = localStorage.getItem(key);
              if (raw !== null) {
                try {
                  result[key] = JSON.parse(raw);
                } catch {
                  result[key] = raw;
                }
              }
            });
          }
          if (typeof callback === 'function') {
            callback(result);
            return undefined;
          }
          return Promise.resolve(result);
        },
        set(items, callback) {
          Object.entries(items || {}).forEach(([key, value]) => {
            localStorage.setItem(key, JSON.stringify(value));
          });
          if (typeof callback === 'function') {
            callback();
            return undefined;
          }
          return Promise.resolve();
        },
        remove(keys, callback) {
          const keyList = Array.isArray(keys) ? keys : [keys];
          keyList.forEach((key) => localStorage.removeItem(key));
          if (typeof callback === 'function') {
            callback();
            return undefined;
          }
          return Promise.resolve();
        },
      },
    },
    runtime: {
      getURL(path) {
        return `/${String(path).replace(/^\/+/, '')}`;
      },
      lastError: undefined,
    },
    downloads: {
      download(_options, callback) {
        if (typeof callback === 'function') callback(-1);
      },
    },
    contextMenus: {
      create() {},
      onClicked: {
        addListener() {},
      },
    },
    tabs: {
      create() {},
    },
  };
}
