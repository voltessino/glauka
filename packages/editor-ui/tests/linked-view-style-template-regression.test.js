'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

// Regression for F10b: a CSS rule was accidentally appended *after* the
// closing backtick, breaking JS parsing and preventing the editor from loading.
test('linked-view stylesheet parses and keeps card focus rules inside CSS template',()=>{
  const file=path.resolve(__dirname,'../linked-view-styles.js');
  const source=fs.readFileSync(file,'utf8');
  assert.doesNotThrow(()=>new vm.Script(source,{filename:file}),
    'linked-view-styles.js must be valid JavaScript');
  const focusSelector='.nm-kanban-card :is(button,select,input):focus-visible';
  const focusIndex=source.indexOf(focusSelector);
  assert.ok(focusIndex>=0,'Kanban keyboard-focus selector must exist');
  const closingTemplate=source.lastIndexOf('\x60;');
  assert.ok(closingTemplate>focusIndex,
    'focus rules must remain inside the CSS template, not after its closing backtick');
  assert.match(source,/prefers-reduced-motion\s*:\s*reduce/,
    'the stylesheet should respect reduced-motion preferences');
});
