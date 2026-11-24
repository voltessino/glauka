'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('path');

const picker=fs.readFileSync(path.join(__dirname,'../view-picker.js'),'utf8');
const mobile=fs.readFileSync(path.join(__dirname,'../../../apps/android/native/app/src/main/assets/assets/mobile-app.js'),'utf8');
const chrome=fs.readFileSync(path.join(__dirname,'../luminous-chrome.css'),'utf8');
const modes=['mindmap','orgchart','concept-tree','concept-network','flowchart','kanban','timeline'];

function pathOf(source, id){
 const match=source.match(new RegExp('(?:"'+id+'"|'+id+'):\\s*"((?:\\\\.|[^"\\\\])*)"'));
 assert.ok(match, 'missing glyph '+id);
 return match[1];
}

test('the seven view glyphs are the same clean strokes in the picker and on Android',()=>{
 const drawings=modes.map(id=>{
  const desktop=pathOf(picker,id);
  assert.equal(desktop, pathOf(mobile,id), id);
  assert.ok(desktop.length>40, id);
  return desktop;
 });
 assert.equal(new Set(drawings).size, modes.length);
 assert.match(picker,/setAttribute\("viewBox", "0 0 24 24"\)/);
 assert.match(picker,/setAttribute\("fill", "none"\)/);
 assert.doesNotMatch(picker,/viewBox", "0 0 74 50"/);
});

test('view icons are 24px in the bar and 28px in the menu, with selection on the row',()=>{
 assert.match(picker,/\.nm-view-trigger svg\{width:24px;height:24px/);
 assert.match(picker,/\.nm-view-choice svg\{width:28px;height:28px\}/);
 assert.match(picker,/\.nm-view-trigger svg,\.nm-view-choice svg\{fill:none;[^}]*background:none;border:0;border-radius:0/);
 assert.match(picker,/\.nm-view-choice\[aria-checked=true\]\{background:var\(--nm-theme-action/);
 assert.match(picker,/\.nm-view-choice\[aria-checked=true\] strong\{font-weight:700\}/);
 assert.match(picker,/\.nm-view-choice\[aria-checked=true\] svg\{background:none;border:0;border-radius:0;box-shadow:none\}/);
 assert.doesNotMatch(picker,/\.nm-view-choice\[aria-checked=true\] svg\{[^}]*background:var\(--nm-theme-action/);
 assert.match(chrome,/#nm-view-switch \.nm-view-trigger svg \{width:24px;height:24px;background:none;border:0;border-radius:0;box-shadow:none;\}/);
 assert.doesNotMatch(chrome,/width:32px;height:27px/);
});
