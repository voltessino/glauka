'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('Prisma and Graphite share the panel spacing tokens',()=>{
  const skins=read('workspace-skins.js');
  const chrome=read('luminous-chrome.css');
  for(const theme of ['prisma','graphite']){
    const start=skins.indexOf(`[data-nm-skin="${theme}"]`);
    const end=skins.indexOf('body.nm-orbit-workspace', start+10);
    const block=skins.slice(start, end);
    assert.match(block,/--nm-skin-pad:12px/);
    assert.match(block,/--nm-skin-gap:8px/);
    assert.match(block,/--nm-skin-control-pad:8px/);
    assert.match(block,/--nm-skin-control-size:36px/);
  }
  assert.match(chrome,/body\[data-nm-skin\]\s*\{[^}]*--nm-skin-pad:\s*12px;[^}]*--nm-skin-gap:\s*8px;/);
});

test('the four main panels share one content inset and one field size',()=>{
  const layout=read('workspace-layout.css');
  const tools=read('creative-tools.css');
  assert.match(layout,/ #inspector-sidebar\s*>\s*:is\(\.inspector-section,\s*\.nm70-inspector-accordion\)\s*\{\s*margin:\s*0\s*!important;/);
  assert.match(layout,/padding-inline:\s*0\s*!important;/);
  assert.match(layout,/:is\(\s*#inspector-sidebar,\s*\.hud-bottom-left,\s*#nm-insert-panel,\s*#nm-drawing-toolbar,/);
  assert.match(layout,/padding:\s*var\(--nm-skin-control-pad,\s*8px\);/);
  assert.match(layout,/min-height:\s*var\(--nm-skin-control-size,\s*36px\);/);
  assert.match(layout,/height:var\(--nm-skin-control-size,36px\);/);
  assert.doesNotMatch(layout,/#nm-insert-panel > \.nm-panel-body\{gap:16px\}/);
  assert.match(layout,/#nm-insert-panel > \.nm-panel-body\{gap:var\(--nm-skin-pad,12px\);\}/);
  assert.match(layout,/#nm-insert-panel \.nm-insert-section\{\s*padding-top:0;/);
  assert.match(tools,/#nm-drawing-toolbar \{\s*left: auto;[\s\S]*padding:\s*var\(--nm-skin-pad,\s*12px\);\s*gap:\s*var\(--nm-skin-pad,\s*12px\);/);
  assert.match(tools,/\.nm-drawing-tools \{\s*display: grid;[\s\S]*gap:\s*var\(--nm-skin-gap,\s*8px\);/);
  assert.match(read('creative-drawing-toolbar.js'),/nm-draw-header nm-side-panel-heading/);
  assert.match(read('creative-drawing-toolbar.js'),/nm-draw-close nm-panel-header-button/);
});
