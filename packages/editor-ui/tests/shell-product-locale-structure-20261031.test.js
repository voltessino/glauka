'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const folder=path.join(__dirname,'../../../apps/desktop-shared/editor');
const load=name=>fs.readFileSync(path.join(folder,name),'utf8');
test('desktop shell is composed from dictionary, product/localization and Home',()=>{
 const parts=['shell-dictionary.js','shell-product-locale.js','shell.js'];
 const entries=JSON.parse(load('sources.json'));
 const idx=entries.indexOf(parts[0]);
 assert.ok(idx>=0);
 assert.deepEqual(entries.slice(idx,idx+3),parts);
 for(const name of parts)assert.doesNotThrow(()=>new Function(load(name)));
 assert.ok(load('shell-product-locale.js').includes('const NM_I18N={'));
 assert.ok(load('shell-product-locale.js').includes('function nm6Translate('));
 assert.ok(load('shell-product-locale.js').includes('window.nmProduct=nmProduct;'));
 assert.ok(load('shell.js').startsWith('function nm6InjectShell()'));
 assert.ok(!load('shell.js').includes('const NM_I18N={'));
});
