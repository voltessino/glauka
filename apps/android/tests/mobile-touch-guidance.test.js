'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const ui=require('../native/app/src/main/assets/assets/mobile-touch-guidance.js');
const commands=require('../native/app/src/main/assets/assets/mobile-commands.js');
test('Android touch instructions cover every supported locale without desktop directions',()=>{
 assert.deepEqual([...ui.codes].sort(),['ar','de','en','es','fr','it','pt','zh-CN'].sort());
 const keys=Object.keys(ui.packs.it).sort();
 for(const code of ui.codes){
  assert.deepEqual(Object.keys(ui.packs[code]).sort(),keys);
  for(const key of keys){const value=ui.text(key,{count:3},code);assert.ok(value.trim(),`${code}:${key}`);assert.ok(!ui.desktopPattern.test(value),`${code}:${key}: ${value}`);assert.ok(!value.includes('{count}'));}
  for(const key of ['branchMoved','relationRemoved','noteSaved','props'])assert.ok(!ui.desktopPattern.test(ui.message(key,{},code)));
 }
});
test('instruction detector recognizes translated modifiers and avoids ordinary words',()=>{
 for(const value of ['Shift click','Ctrl clic','Canc elimina','Press Delete','控制+Z','شيفت+Z','Ctrl+Z','Ctrl + Z','Control+Z','Ctrl/Cmd + clic','Command + K','⌘ Z','Shift/Ctrl+Clic','Alt + F4','F12','Strg + Z','Maj + clic','Mayús + clic','Contrôle+Z','tasto destro','right-click','mouse wheel','rotellina','clic derecho','clic droit','Mausrad','molette','roda do mouse','鼠标右键','滚轮','عجلة الماوس','Esc exits drawing.'])assert.ok(ui.desktopPattern.test(value),value);
 for(const value of ['Current tab: map','enter percentages','au contrôle d’intégrité','Delete','Tocca Elimina','Use Select all'])assert.ok(!ui.desktopPattern.test(value),value);
});
test('touch commands retain editing actions but do not expose desktop shortcut help',()=>{
 assert.ok(!commands.actions.some(a=>a.id==='btn-shortcuts'));
 for(const id of ['menu-undo','menu-redo','menu-select-all'])assert.ok(commands.actions.some(a=>a.id===id));
});
test('real Android build source manifest has no unreviewed desktop instructions',()=>{
 const root=path.resolve(__dirname,'../../..');
 const result=spawnSync(process.platform==='win32'?'python':'python3',['scripts/qa/android_touch_audit.py','--check','--source-manifest','apps/android/tests/fixtures/touch-guidance-sources.json'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
 assert.equal(result.status,0,result.stderr||result.stdout);
 const report=JSON.parse(result.stdout);assert.ok(report.files_analyzed>150);assert.deepEqual(report.unreviewed,[]);
});
