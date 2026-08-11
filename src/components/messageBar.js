// src/components/messageBar.js
// A single dismissible inline message bar mounted at the top of the app.
// Never render raw error stacks here — callers must pass friendly text
// (e.g. via toUserMessage from ../utils/errors.js).

export function createMessageBar(slot) {
  let node = null;
  let hideTimer = null;

  function hide() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (node) {
      node.remove();
      node = null;
    }
  }

  function show(text, type = 'error', { autoHideMs = 0 } = {}) {
    hide();
    node = document.createElement('div');
    node.className = `message-bar message-bar-${type}`;
    node.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const text_ = document.createElement('span');
    text_.className = 'message-bar-text';
    text_.textContent = text;

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'message-bar-dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss message');
    dismiss.textContent = '×';
    dismiss.addEventListener('click', hide);

    node.appendChild(text_);
    node.appendChild(dismiss);
    slot.appendChild(node);

    if (autoHideMs > 0) {
      hideTimer = setTimeout(hide, autoHideMs);
    }
  }

  return {
    showError(text) {
      show(text, 'error');
    },
    showInfo(text, opts) {
      show(text, 'info', opts);
    },
    hide,
  };
}
