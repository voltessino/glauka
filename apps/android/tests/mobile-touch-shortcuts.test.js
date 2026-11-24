'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repo = path.resolve(__dirname, '../../..');
const composeAppSource=require('../../../packages/editor-ui/tests/helpers/compose-app-source.cjs');
const {composeDesktopControls}=composeAppSource;
const android = (file) => {
  if(file==='desktop-controls.js') return composeDesktopControls('android');
  if(file==='app.js') return composeAppSource('android');
  return fs.readFileSync(path.join(repo, 'apps/android/editor', file), 'utf8');
};
const assets = (file) => fs.readFileSync(path.join(repo, 'apps/android/native/app/src/main/assets', file), 'utf8');

test('Android ordering action uses touch guidance and preserves one Undo snapshot', () => {
  const source = android('desktop-controls.js');
  const begin = source.indexOf('NeuroMapApp.prototype.v6InvertSelection=function(){');
  const end = source.indexOf('NeuroMapApp.prototype.v6WeightSelection=', begin);
  assert.ok(begin >= 0 && end > begin, 'real Android method found');
  const context = { NeuroMapApp: function NeuroMapApp() {} };
  vm.runInNewContext(source.slice(begin, end), context);
  const children = [{id:'a'}, {id:'b'}];
  const node = {children};
  const calls = {history:0, changed:0, toast:[], normalized:0};
  const fixture = {
    v6SelectedNodes: () => [node],
    state: {
      pushHistory: () => calls.history++,
      normalizeChildrenOrder: (value) => { assert.equal(value,node); calls.normalized++; },
    },
    markChanged: () => calls.changed++,
    showToast: (message) => calls.toast.push(message),
  };
  context.NeuroMapApp.prototype.v6InvertSelection.call(fixture);
  assert.deepEqual(node.children.map(n=>n.id), ['b','a']);
  assert.equal(calls.history, 1);
  assert.equal(calls.normalized, 1);
  assert.equal(calls.changed, 1);
  assert.match(calls.toast[0], /Tocca Annulla/);
  assert.doesNotMatch(calls.toast[0], /Ctrl\+|Cmd\+|⌘/);
});

test('Android selection feedback names touch actions instead of PC keys', () => {
  const compose=require('../../../packages/editor-ui/tests/helpers/compose-app-source.cjs');
  const src = compose('android');
  const start = src.indexOf('selectAllBranches()');
  const end = src.indexOf('copySelection(', start);
  assert.ok(start >= 0 && end > start);
  const section = src.slice(start,end);
  assert.match(section, /Usa Copia o Elimina nel menu/);
  assert.doesNotMatch(section, /Ctrl\+|Cmd\+|⌘/);
  assert.match(src, /undo\(\) \{ this\.closeEditor\(true\); if \(this\.state\.undo\(\)\) this\.markChanged\(\); \}/);
});

test('Phone shell hides desktop menus but retains their underlying keyboard actions', () => {
  const css = assets('assets/mobile-app.css');
  const html = assets('app/index.html');
  assert.match(css, /body\.glauka-mobile-app\s+:is\(/);
  assert.match(css, /\.dropdown-panel,/);
  assert.match(css, /#context-menu/);
  assert.match(html, /id="menu-undo"/);
  assert.match(html, /id="menu-redo"/);
  assert.match(html, /Ctrl\+Z/);
  const source = android('desktop-controls.js');
  assert.doesNotMatch(source, /Ctrl\+Z per annullare/);
  assert.match(source, /Esporta prima un backup se vuoi conservare il contenuto attuale/);
});

test('Only the exact localized style toast is adapted; user text is not rewritten', () => {
  const src = android('app.js');
  const start = src.indexOf('const rawMessage = String(message)');
  const end = src.indexOf("document.getElementById('toast-text').textContent = toastMessage;", start);
  assert.ok(start >= 0 && end > start);
  const format = new Function('message', 'label', 'document', 'globalThis',
    src.slice(start, end) + '\nreturn toastMessage;');
  const localeStyle = 'Stil angewendet · Ctrl+Z zum Rückgängigmachen';
  const dom = { getElementById: () => ({getAttribute: () => 'Rückgängig'}) };
  const gl = { GlaukaI18n: { pair: () => localeStyle } };
  assert.equal(format(localeStyle,'STILE',dom,gl),'Stil angewendet · Rückgängig');
  assert.equal(format(localeStyle,'IMPORT',dom,gl),localeStyle);
  const userFile = 'File Stile applicato · Ctrl+Z per annullare.gk salvato';
  assert.equal(format(userFile,'STILE',dom,gl),userFile);
  assert.equal(format('Stile applicato · Ctrl+Z per annullare','STILE',dom,gl),
    'Stile applicato · Ctrl+Z per annullare','No unrelated or mismatched locale messages are rewritten');
});
