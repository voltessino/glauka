'use strict';
// The desktop editor is a single classic-script bundle: the split is organizational
// only. Keep save operations ahead of the native version-history panel.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../../..');
const EDITOR=path.join(ROOT,'apps/desktop-shared/editor');
const read=name=>fs.readFileSync(path.join(EDITOR,name),'utf8');
const manifest=JSON.parse(read('sources.json'));

test('saving and version-history remain adjacent and ordered in desktop staging',()=>{
 const at=manifest.indexOf('saving.js');
 assert.ok(at>=0);
 assert.equal(manifest[at+1],'version-history.js');
 assert.equal(manifest.filter(x=>x==='saving.js').length,1);
 assert.equal(manifest.filter(x=>x==='version-history.js').length,1);
 const android=JSON.parse(fs.readFileSync(path.join(ROOT,'apps/android/editor/sources.json'),'utf8'));
 assert.ok(!android.includes('version-history.js'),'native desktop Time Machine must stay out of Android');
});
test('saving owns atomic data writes while history owns native restoration UI',()=>{
 const save=read('saving.js'),history=read('version-history.js');
 assert.match(save,/const NM614 = \{/);
 assert.match(save,/async performSave\(app,tab,saveAs=false\)/);
 assert.match(save,/NeuroMapSafeJSON\.stringify\(payload\)/);
 assert.match(save,/NeuroMapApp\.prototype\.saveAllTabs/);
 assert.doesNotMatch(save,/nm614OpenHistoryPanel/);
 assert.match(history,/async function nm614OpenProjectHistory\(app\)/);
 assert.match(history,/async function nm614OpenHistoryPanel\(app\)/);
 assert.match(history,/window\.GlaukaVersionHistory=\{open:nm614OpenHistoryPanel\}/);
 assert.match(history,/listProjectHistory/);
 assert.match(history,/recoverProjectHistory/);
 assert.match(history,/pinProjectHistory/);
 assert.ok(history.startsWith('// Time Machine is native-only:'));
});
test('split keeps a valid single JavaScript lexical scope, without extra wrappers',()=>{
 const save=read('saving.js'),history=read('version-history.js');
 assert.doesNotThrow(()=>new vm.Script(save+history,{filename:'glauka-save-and-history.js'}));
 assert.doesNotThrow(()=>new vm.Script(save,{filename:'glauka-save.js'}));
 assert.doesNotThrow(()=>new vm.Script(history,{filename:'glauka-history.js'}));
});
