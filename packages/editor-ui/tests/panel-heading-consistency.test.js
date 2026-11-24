'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('path');
const css=fs.readFileSync(path.join(__dirname,'../workspace-layout.css'),'utf8');
const tools=fs.readFileSync(path.join(__dirname,'../creative-tools.css'),'utf8');

test('compact side panels stay docked with one heading size',()=>{
  assert.match(css,/hud-bottom-left,#image-controls,#nm-insert-panel,#nm614-navigation-flyout,#nm-drawing-toolbar,#nm62-assets\)\.nm-panel-compact/);
  assert.match(css,/top:var\(--nm-workspace-top, 96px\)!important/);
  assert.match(css,/bottom:auto!important/);
  assert.match(css,/height:44px!important/);
  assert.doesNotMatch(css,/nm-panel-compact :is\(\.nm-side-panel-heading,\.nm-panel-heading-path\)\{[^}]*min-height:0/);
  assert.match(css,/#nm-learn-panel>header/);
  assert.match(css,/\.hud-bottom-left \.hud-header/);
  assert.match(css,/height:32px!important;min-height:32px!important/);
  assert.match(tools,/\.nm-panel-preview-toggle:not\(\.nm-panel-header-button\)/);
});
