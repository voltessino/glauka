'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'../../../apps/desktop-shared/editor');
const names=["layout-text-controls.js","layout-navigation.js","layout-tab-order.js","layout-ui-controls.js","layout-audit-import.js","layout-geometry.js","layout-menu-import.js"];
test('desktop layout feature slices have stable dependency order',()=>{
 const order=JSON.parse(fs.readFileSync(path.join(dir,'sources.json'),'utf8'));
 const idx=order.indexOf(names[0]);
 assert.ok(idx>=0);
 assert.deepEqual(order.slice(idx,idx+names.length),names);
 assert.equal(new Set(order).size,order.length);
 for(const name of names){
  const code=fs.readFileSync(path.join(dir,name),'utf8');
  assert.ok(code.length>1000,'empty feature slice: '+name);
  assert.doesNotThrow(()=>new Function(code),'invalid independent JS slice: '+name);
 }
});
test('audit/import and geometry helpers are declared in their dedicated source',()=>{
 const find=name=>fs.readFileSync(path.join(dir,name),'utf8');
 assert.ok(find('layout-audit-import.js').includes('const NM611 = {'));
 assert.ok(find('layout-menu-import.js').includes('const NM613 = {'));
 assert.ok(find('layout-geometry.js').includes('const NM612_NAV_STORAGE'));
 assert.ok(find('layout-ui-controls.js').includes('const NM70_GAP_STORAGE'));
 assert.ok(!find('layout-navigation.js').includes('const NM611 = {'));
});
