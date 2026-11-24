'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMenuUX({ desktop = null, locale = 'it' } = {}) {
  const src = fs.readFileSync(path.join(__dirname, '../menu-ux.js'), 'utf8');
  const root = {
    GlaukaI18n: {
      locale: () => locale,
      pair: (it, en) => (locale === 'en' ? en : it),
    },
    neuromapDesktop: desktop,
    document: { documentElement: { lang: locale } },
  };
  root.globalThis = root;
  vm.runInNewContext(src, root);
  return root;
}

test('collectRecentFiles caps at 10, deduplicates paths and sorts strictly descending by last modified', () => {
  const root = loadMenuUX({ desktop: {} });
  const app = {
    tabs: [
      { id: 't-open', filePath: 'C:\\Maps\\OpenMap.gk', title: 'Live Open', state: { root: { text: 'Live Open' } } },
    ],
    _nmAtlasArchive: [
      { filePath: 'c:/maps/openmap.gk', title: 'Old Archived Name', updatedAt: 1000 },
      { filePath: 'C:\\Maps\\Older.gk', title: 'Older', updatedAt: 500 },
    ],
  };
  const nativeRecent = Array.from({ length: 12 }, (_, i) => ({
    path: `C:\\Maps\\Doc-${i}.gk`,
    filename: `Doc-${i}.gk`,
    dir: 'Maps',
    modTimeMs: 2000 + i * 1000,
    size: 400,
  }));
  nativeRecent.push({
    path: 'C:\\Maps\\OpenMap.gk',
    filename: 'OpenMap.gk',
    dir: 'Maps',
    modTimeMs: 999999,
    size: 512,
  });

  const list = root.NeuroMapMenuUX.recent.collect({ app, nativeRecent });
  assert.equal(list.length, 10);
  assert.equal(list[0].path, 'C:\\Maps\\OpenMap.gk');
  assert.equal(list[0].isOpen, true);
  assert.equal(list[0].title, 'Live Open');
  assert.equal(list[1].filename, 'Doc-11.gk');
  assert.equal(list[9].filename, 'Doc-3.gk');
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i - 1].updatedAt >= list[i].updatedAt, 'strictly descending modTime');
  }
});

test('openRecentEntry activates already-open tab or streams approved file without re-browsing', async () => {
  let activated = null;
  let imported = [];
  const toasts = [];
  const desktop = {
    async openRecentProject(p) {
      return { filename: 'Beta.gk', path: p, bytes: new Uint8Array([1, 2, 3]) };
    },
  };
  const root = loadMenuUX({ desktop });
  const app = {
    tabs: [{ id: 'tab-1', filePath: 'C:\\Maps\\Alpha.gk', title: 'Alpha' }],
    activateTab(id) {
      activated = id;
    },
    showToast(msg) {
      toasts.push(msg);
    },
    async v6ImportNativeBatch(files) {
      imported.push(...files);
      return { opened: files.length };
    },
  };

  await root.NeuroMapMenuUX.recent.openEntry(app, { path: 'c:/maps/alpha.gk', title: 'Alpha' });
  assert.equal(activated, 'tab-1');
  assert.equal(imported.length, 0);

  await root.NeuroMapMenuUX.recent.openEntry(app, { path: 'C:\\Maps\\Beta.gk', title: 'Beta' });
  assert.equal(imported.length, 1);
  assert.equal(imported[0].filename, 'Beta.gk');
});
