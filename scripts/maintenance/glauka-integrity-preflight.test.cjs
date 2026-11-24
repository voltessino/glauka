'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('path');
const {staticProblems}=require('./glauka-integrity-preflight.cjs');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('the official app version shown to people is 1.0.4',()=>{
  const versions=JSON.parse(read('versions.json'));
  assert.equal(versions.windows.version,'1.0.4');
  assert.equal(versions.macos.version,'1.0.4');
  assert.equal(versions.android.version,'0.6.21-rc.1-private');
  assert.notEqual(versions.editor,versions.windows.version);
  const shell=read('apps/desktop-shared/editor/shell-dictionary.js');
  assert.match(shell,/const NM_PRODUCT_VERSION='1\.0\.4'/);
  assert.doesNotMatch(shell,/7\.4\.0/);
  assert.doesNotMatch(read('apps/desktop-shared/src/desktop_files.go'),/xmindCreatorVersion = "7\.4\.0/);
  assert.doesNotMatch(read('apps/windows/installer/install_ui.ps1'),/7\.4\.0/);
});

test('panel headers, the layout grip and the AI bar cannot fall apart again',()=>{
  const css=read('packages/editor-ui/workspace-layout.css');
  const chrome=read('packages/editor-ui/workspace-layout-lists-chrome.js');
  assert.match(css,/\.hud-bottom-left,#image-controls,#nm-insert-panel/);
  assert.match(css,/body\.nm-workspace-v2 \.nm-panel-frame>\.nm-side-panel-heading\{/);
  assert.match(read('packages/editor-ui/ai-studio.css'),/body\.nm-workspace-v2 #nm-ai-studio>header\{[^}]*height:44px!important/);
  assert.match(css,/#nm-learn-panel>header>strong\{[^}]*font-weight:700!important/);
  assert.match(css,/\.hud-bottom-left\.nm-panel-compact > \.nm-panel-resize-handle/);
  assert.match(chrome,/nm-panel-compact/);
  assert.match(chrome,/getBoundingClientRect/);
  assert.match(chrome,/panel\.addEventListener\?\.\("scroll",place/);
  assert.match(read('packages/editor-ui/creative-settings-mount-handlers.js'),/nm-panel-compact/);
});

test('the branch still contains the current official copy',()=>{
  const ancestor=execFileSync('git',['merge-base','--is-ancestor','origin/main','HEAD'],{cwd:root,encoding:'utf8'});
  assert.equal(ancestor,'');
  const [behind]=execFileSync('git',['rev-list','--left-right','--count','origin/main...HEAD'],{cwd:root,encoding:'utf8'}).trim().split(/\s+/);
  assert.equal(behind,'0','origin/main has commits this branch does not. Fetch and start a new branch from origin/main.');
  assert.deepEqual(staticProblems(),[]);
});

test('opening the app does not start from the dark fallback',()=>{
  const html=read('apps/desktop-shared/src/resources/index.html');
  const skins=read('packages/editor-ui/workspace-skins.js');
  assert.match(html,/data-nm-skin="prisma"/);
  assert.match(html,/id="glauka-theme-boot"/);
  assert.doesNotMatch(html,/prefers-color-scheme/);
  assert.match(html,/nm_orbit_desktop_ui_v1/);
  assert.match(skins,/body:is\(\.nm-orbit-workspace,\.nm-workspace-v2\)\[data-nm-skin="prisma"\]/);
  assert.match(read('apps/desktop-shared/src/main.go'),/glauka-theme-boot" nonce=/);
});
