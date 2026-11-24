/* Android Command Finder: shortcuts to EXISTING editor actions, never changes map data. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.install(root.document);
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  const actions = Object.freeze([
    ['btn-new-tab', 'file', 'Nuova mappa', 'New map', 'nuova scheda create'],
    ['btn-import-files-new-tabs', 'file', 'Apri mappa', 'Open map', 'importa file xmind neuromap'],
    ['menu-save-file', 'file', 'Salva', 'Save', 'esporta backup'],
    ['menu-save-file-as', 'file', 'Salva con nome', 'Save as', 'copia file'],
    ['btn-duplicate-tab', 'file', 'Duplica scheda', 'Duplicate tab', 'copia mappa'],
    ['menu-undo', 'edit', 'Annulla', 'Undo', 'indietro undo'],
    ['menu-redo', 'edit', 'Ripeti', 'Redo', 'rifai redo'],
    ['menu-cut', 'edit', 'Taglia', 'Cut', 'sposta'],
    ['menu-copy', 'edit', 'Copia', 'Copy', 'clipboard'],
    ['menu-paste', 'edit', 'Incolla', 'Paste', 'clipboard'],
    ['menu-select-all', 'edit', 'Seleziona tutto', 'Select all', 'multi selezione'],
    ['menu-edit-node', 'edit', 'Rinomina nodo', 'Rename node', 'modifica testo'],
    ['menu-add-child', 'insert', 'Aggiungi figlio', 'Add child', 'nodo ramo sotto'],
    ['menu-add-sibling-cw', 'insert', 'Aggiungi ramo', 'Add sibling', 'fratello livello'],
    ['menu-add-image', 'insert', 'Aggiungi immagine', 'Add image', 'foto media'],
    ['btn-spotlight', 'view', 'Cerca nelle mappe', 'Search maps', 'trova spotlight'],
    ['menu-center-map', 'view', 'Centra mappa', 'Center map', 'adatta fit'],
    ['menu-reset-zoom', 'view', 'Ripristina zoom', 'Reset zoom', '100 scala'],
    ['btn-toggle-inspector', 'view', 'Pannello Stile', 'Style panel', 'aspetto formato'],
    ['btn-flashcards', 'study', 'Flashcard', 'Flashcards', 'ripasso studio'],
    ['nm62-toolbar-assets', 'study', 'Simboli e libreria', 'Symbols and library', 'icone risorse'],
    ['btn-ai-settings', 'study', 'Impostazioni AI', 'AI settings', 'modello provider']
  ].map(([id, group, it, en, keywords]) => Object.freeze({id, group, it, en, keywords})));
  const groupNames = Object.freeze({
    it: {file:'File', edit:'Modifica', insert:'Inserisci', view:'Visualizza', study:'Studio e strumenti'},
    en: {file:'File', edit:'Edit', insert:'Insert', view:'View', study:'Study and tools'}
  });
  const copy = {
    it: {open:'⌕ Comandi', title:'Trova un comando', hint:'Cerca tra le azioni già presenti nell’editor', placeholder:'Es. salva, figlio, cerca…', close:'Chiudi', empty:'Nessun comando trovato', count:'Comandi disponibili'},
    en: {open:'⌕ Commands', title:'Find a command', hint:'Search actions already available in the editor', placeholder:'E.g. save, child, search…', close:'Close', empty:'No matching commands', count:'Available commands'}
  };
  const language = document => document.documentElement.lang === 'en' ? 'en' : 'it';
  const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  function find(document, text = '', lang = 'it') {
    const q = fold(text);
    const terms = q.split(/\s+/).filter(Boolean);
    return actions.filter(action => {
      const node = document.getElementById(action.id);
      if (!node || node.disabled || node.isConnected === false) return false;
      const haystack = fold([action.it, action.en, action.keywords, groupNames.it[action.group], groupNames.en[action.group]].join(' '));
      return terms.every(term => haystack.includes(term));
    });
  }
  function invoke(document, id) {
    if (!actions.some(action => action.id === id)) return false;
    const node = document.getElementById(id);
    if (!node || node.disabled || node.isConnected === false || typeof node.click !== 'function') return false;
    node.click();
    return true;
  }
  function install(document) {
    const mount = () => {
      const view=document.defaultView;
      if(view?.GlaukaAppReady&&!view.neuroMapApp){view.GlaukaAppReady.then(value=>{if(value)mount()});return;}
      const rail = document.getElementById('nm-android-menu-rail');
      if (!rail || document.getElementById('nm-android-command-open')) return;
      const button = document.createElement('button');
      button.id = 'nm-android-command-open';
      button.type = 'button';
      button.className = 'nm6-skiptranslate';
      button.setAttribute('aria-haspopup', 'dialog');
      rail.insertBefore(button, rail.firstChild);
      const overlay = document.createElement('div');
      overlay.id = 'nm-android-command-overlay';
      overlay.className = 'nm-android-commands-shade hidden nm6-skiptranslate';
      overlay.innerHTML = '<section class="nm-android-commands-panel" role="dialog" aria-modal="true" aria-labelledby="nm-android-command-title" aria-describedby="nm-android-command-hint">' +
        '<header><div><h2 id="nm-android-command-title"></h2><p id="nm-android-command-hint"></p></div><button type="button" id="nm-android-command-close"></button></header>' +
        '<label class="nm-android-command-search"><span aria-hidden="true">⌕</span><input type="search" id="nm-android-command-query" autocomplete="off" spellcheck="false"></label>' +
        '<div id="nm-android-command-count" role="status" aria-live="polite"></div><div id="nm-android-command-results"></div></section>';
      document.body.appendChild(overlay);
      const query = overlay.querySelector('#nm-android-command-query');
      const results = overlay.querySelector('#nm-android-command-results');
      const status = overlay.querySelector('#nm-android-command-count');
      const closeButton = overlay.querySelector('#nm-android-command-close');
      const title = overlay.querySelector('#nm-android-command-title');
      const hint = overlay.querySelector('#nm-android-command-hint');
      let previousFocus = null;
      const close = () => {
        overlay.classList.add('hidden');
        query.value = '';
        (previousFocus && previousFocus.isConnected !== false ? previousFocus : button).focus();
      };
      const run = id => { close(); invoke(document, id); };
      const render = () => {
        const lang = language(document), t = copy[lang], list = find(document, query.value, lang);
        results.replaceChildren();
        status.textContent = list.length + ' ' + t.count;
        if (!list.length) {
          const empty = document.createElement('p');
          empty.className = 'nm-android-command-empty';
          empty.textContent = t.empty;
          results.appendChild(empty);
          return;
        }
        let lastGroup = null;
        for (const action of list) {
          if (action.group !== lastGroup) {
            const heading = document.createElement('h3');
            heading.className = 'nm-android-command-group';
            heading.textContent = groupNames[lang][action.group];
            results.appendChild(heading);
            lastGroup = action.group;
          }
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'nm-android-command-item';
          item.setAttribute('data-glauka-touch-owned','');
          item.textContent = globalThis.GlaukaI18n?.pair(action.it,action.en)||action[lang];
          item.addEventListener('click', () => run(action.id));
          results.appendChild(item);
        }
      };
      const localize = () => {
        const t = copy[language(document)];
        button.textContent = t.open;
        button.setAttribute('aria-label', t.title);
        title.textContent = t.title;
        hint.textContent = t.hint;
        query.placeholder = t.placeholder;
        query.setAttribute('aria-label', t.title);
        closeButton.textContent = t.close;
        render();
      };
      const open = () => {
        previousFocus = document.activeElement;
        localize();
        overlay.classList.remove('hidden');
        query.focus();
      };
      button.addEventListener('click', open);
      closeButton.addEventListener('click', close);
      overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
      query.addEventListener('input', render);
      query.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          const first = results.querySelector('.nm-android-command-item');
          if (first) { event.preventDefault(); first.click(); }
        } else if (event.key === 'ArrowDown') {
          const first = results.querySelector('.nm-android-command-item');
          if (first) { event.preventDefault(); first.focus(); }
        }
      });
      results.addEventListener('keydown', event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        const items = [...results.querySelectorAll('.nm-android-command-item')];
        const current = items.indexOf(document.activeElement);
        const next = items[current + (event.key === 'ArrowDown' ? 1 : -1)];
        if (next) { event.preventDefault(); next.focus(); }
        else if (event.key === 'ArrowUp' && current === 0) { event.preventDefault(); query.focus(); }
      });
      overlay.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); close(); return; }
        if (event.key !== 'Tab') return;
        const focusable = [closeButton, query, ...results.querySelectorAll('.nm-android-command-item')];
        const current = focusable.indexOf(document.activeElement);
        if (event.shiftKey && current === 0) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
        if (!event.shiftKey && current === focusable.length - 1) { event.preventDefault(); focusable[0].focus(); }
      });
      localize();
      if (typeof MutationObserver === 'function') new MutationObserver(localize)
        .observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
    };
    // The rail is created by mobile-next on the WINDOW DOMContentLoaded phase.
    if (document.readyState !== 'complete') (document.defaultView || document).addEventListener('DOMContentLoaded', mount, {once:true});
    else mount();
  }
  return Object.freeze({actions, find, invoke, install, fold});
});
