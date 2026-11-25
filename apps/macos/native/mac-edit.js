(function (root) {
  'use strict';
  var modalIds = ['flash-modal', 'ai-settings-modal', 'ai-preview-modal', 'nm54-illustration-modal', 'nm62-assets', 'paste-modal', 'nm-decision-overlay', 'nm67-notes-overlay', 'nm6-plan-modal'];
  var skipTypes = { button: 1, checkbox: 1, color: 1, file: 1, hidden: 1, image: 1, radio: 1, range: 1, reset: 1, submit: 1 };

  function isEditingField(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (typeof el.closest !== 'function') return false;
    var node = el.closest('textarea, input, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]');
    if (!node) return false;
    if (typeof node.matches === 'function' && node.matches('input')) {
      var type = String(node.getAttribute('type') || 'text').toLowerCase();
      if (skipTypes[type]) return false;
    }
    if (node.disabled || node.readOnly) return false;
    return true;
  }

  function isBlocked(doc, el) {
    if (el && typeof el.closest === 'function' && el.closest('[role="dialog"],.nm-creative-shade,#nm-drawing-toolbar,#nm-ai-studio,#nm-knowledge-panel')) return true;
    if (!doc || typeof doc.getElementById !== 'function') return false;
    return modalIds.some(function (id) {
      var node = doc.getElementById(id);
      return !!(node && !node.hidden && !(node.classList && node.classList.contains('hidden')));
    });
  }

  function reportState(doc) {
    var el = doc && doc.activeElement;
    return { editing: isEditingField(el), blocked: isBlocked(doc, el) };
  }

  function pasteImage(app, encoded) {
    if (!encoded || !app.io || typeof app.io.attachImageFileToNode !== 'function' || typeof root.atob !== 'function' || typeof root.File !== 'function') return false;
    var binary = root.atob(encoded);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var file = new root.File([bytes], 'clipboard.png', { type: 'image/png' });
    var selectedImage = app.state && app.state.selectedImageId;
    app.io.attachImageFileToNode(file, selectedImage ? null : (app.state && app.state.selectedNodeId));
    return true;
  }

  function paste(app, request) {
    if (request && request.image && pasteImage(app, request.image)) return 'paste-image';
    var text = String((request && request.text) || '');
    if (app.internalClipboard && (!text || text === app._clipboardPlain)) {
      app.pasteSelection();
      return 'paste-internal';
    }
    if (text && typeof app.nm66PasteOutline === 'function') {
      try {
        app.nm66PasteOutline(text, String((request && request.html) || ''));
        return 'paste-text';
      } catch (error) {
        if (typeof app.showToast === 'function') app.showToast(String(error && error.message || error), 'INCOLLA');
        return 'paste-error';
      }
    }
    if (typeof app.pasteSelection === 'function') {
      app.pasteSelection();
      return 'paste-internal';
    }
    return 'ignored';
  }

  function command(app, request, doc) {
    var el = doc && doc.activeElement;
    var name = String(request && request.name || '');
    // Focus can move after the native side last heard about it. Tell the
    // Mac host to use the real text responder instead of dropping the key.
    if (isEditingField(el)) return 'editing';
    if (isBlocked(doc, el)) return (name === 'copy' || name === 'selectAll') ? 'editing' : 'ignored';
    if (!app) return 'ignored';
    if (name === 'copy' && typeof app.copySelection === 'function') { app.copySelection(); return 'copy'; }
    if (name === 'cut' && typeof app.cutSelection === 'function') { app.cutSelection(); return 'cut'; }
    if (name === 'selectAll' && typeof app.selectAllBranches === 'function') { app.selectAllBranches(); return 'selectAll'; }
    if (name === 'undo') {
      if (request && request.shift) { if (typeof app.redo === 'function') app.redo(); return 'redo'; }
      if (typeof app.undo === 'function') app.undo();
      return 'undo';
    }
    if (name === 'paste') return paste(app, request);
    return 'ignored';
  }

  function install(doc) {
    function post() {
      var state = reportState(doc);
      root.__glaukaEditState = state;
      try { root.webkit.messageHandlers.neuromapEditState.postMessage(state); } catch (error) {}
    }
    doc.addEventListener('focusin', post, true);
    doc.addEventListener('focusout', post, true);
    root.GlaukaMacEdit.command = function (request) { return command(root.neuroMapApp, request, doc); };
    post();
  }

  root.GlaukaMacEdit = { command: command, isEditingField: isEditingField, isBlocked: isBlocked, reportState: reportState, install: install };
  if (root.document && typeof root.document.addEventListener === 'function') install(root.document);
})(typeof globalThis !== 'undefined' ? globalThis : this);
