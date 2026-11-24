'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'../../..',file),'utf8');

test('ribbon and context menus sit above side panels and keep a 12px screen margin',()=>{
  const layout=read('packages/editor-ui/workspace-layout.css');
  assert.match(layout,/body\.nm-workspace-v2 :is\(#context-menu,\.nm613-floating-menu,\.topbar\.nm-ribbon \.dropdown-panel\)\{\s*z-index:2350!important;/);
  const refresh=read('apps/desktop-shared/editor/context-menu-refresh.js');
  assert.match(refresh,/const width=vv\?\.width\|\|global\.innerWidth,height=vv\?\.height\|\|global\.innerHeight,margin=12;/);
  assert.doesNotMatch(refresh,/menu\.style\.left=Math\.max\(8,/);
  const menus=read('apps/desktop-shared/editor/layout-menu-import.js');
  assert.match(menus,/margin=12,width=Math\.min\(innerWidth-margin\*2,355/);
  assert.match(menus,/if\(panel\.style\[key\]!==value\) panel\.style\[key\]=value/);
});
