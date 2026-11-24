const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const commands = require('../native/app/src/main/assets/assets/mobile-commands');
const assets = path.join(__dirname, '../native/app/src/main/assets');
const html = fs.readFileSync(path.join(assets, 'app/index.html'), 'utf8');
const css = fs.readFileSync(path.join(assets, 'assets/mobile-commands.css'), 'utf8');

function makeDocument(exclude = [], disabled = []) {
  const activated = [];
  const nodes = new Map(commands.actions.filter(a => !exclude.includes(a.id)).map(a => [a.id, {
    disabled: disabled.includes(a.id), isConnected: true,
    click() { activated.push(a.id); }
  }]));
  return { document: {getElementById: id => nodes.get(id) || null}, activated, nodes };
}

test('catalog maps unique IDs to existing editor buttons only', () => {
  assert.equal(new Set(commands.actions.map(a => a.id)).size, commands.actions.length);
  for (const action of commands.actions) {
    assert.match(html, new RegExp('id="' + action.id + '"'));
    assert.ok(action.it && action.en && action.group);
  }
});

test('search is accent-insensitive and bilingual', () => {
  const {document} = makeDocument();
  assert.equal(commands.find(document, 'più scheda').length, 0);
  assert.equal(commands.find(document, 'modifica').some(a => a.id === 'menu-edit-node'), true);
  assert.equal(commands.find(document, 'rename node', 'it')[0].id, 'menu-edit-node');
  assert.equal(commands.find(document, 'cerca nelle mappe', 'en')[0].id, 'btn-spotlight');
  assert.equal(commands.fold(' Città '), 'citta');
});

test('multiple words narrow results without reordering category groups', () => {
  const {document} = makeDocument();
  assert.deepEqual(commands.find(document, 'salva nome').map(a => a.id), ['menu-save-file-as']);
  assert.deepEqual(commands.find(document, 'zoom').map(a => a.id), ['menu-reset-zoom']);
  const all = commands.find(document).map(a => a.group);
  assert.deepEqual(all, [...all].sort((a,b)=> ['file','edit','insert','view','study'].indexOf(a) - ['file','edit','insert','view','study'].indexOf(b)));
});

test('disconnected, disabled or unmounted original actions are not offered', () => {
  const {document, nodes} = makeDocument(['menu-save-file-as'], ['menu-save-file']);
  nodes.get('btn-new-tab').isConnected = false;
  assert.ok(!commands.find(document).some(a=> ['menu-save-file-as','menu-save-file','btn-new-tab'].includes(a.id)));
});

test('dispatch delegates once to the ORIGINAL action without editing document', () => {
  const {document, activated} = makeDocument();
  assert.equal(commands.invoke(document, 'menu-save-file'), true);
  assert.deepEqual(activated, ['menu-save-file']);
});

test('dispatch refuses unknown, disabled or missing buttons', () => {
  const {document, activated} = makeDocument(['menu-save-file'], ['menu-undo']);
  assert.equal(commands.invoke(document, 'not-an-action'), false);
  assert.equal(commands.invoke(document, 'menu-save-file'), false);
  assert.equal(commands.invoke(document, 'menu-undo'), false);
  assert.deepEqual(activated, []);
});

test('initialization without the Android command rail is a no-op', () => {
  const document = {readyState: 'complete', getElementById:()=>null, createElement:()=>{throw Error('Unexpected button');}};
  assert.doesNotThrow(()=>commands.install(document));
});

test('Android HTML loads command styles and script after existing mobile assets', () => {
  assert.ok(html.indexOf('/assets/mobile-commands.css') > html.indexOf('/assets/mobile-next.css'));
  assert.ok(html.indexOf('/assets/mobile-commands.js') > html.indexOf('/assets/mobile-next.js'));
});

test('single-row touch rail, modal safety and minimum action size', () => {
  assert.match(css, /#nm-android-menu-rail\s*\{[^}]*display:\s*flex\s*!important;[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto;/s);
  assert.match(css, /\.nm-android-command-item\s*\{[^}]*min-height:\s*48px;/s);
  assert.match(css, /\.nm-android-commands-shade\s*\{[^}]*z-index:\s*2600;/s);
  assert.match(css, /env\(safe-area-inset-bottom,0px\)/);
});

test('no new map serialization, node editing, license handling or network access', () => {
  const source = fs.readFileSync(path.join(assets, 'assets/mobile-commands.js'), 'utf8');
  assert.doesNotMatch(source, /localStorage|indexedDB|JSON\.stringify|fetch\(|XMLHttpRequest|\.children\s*=/);
  assert.doesNotMatch(css, /#mindmap-canvas\s*\{/);
});
