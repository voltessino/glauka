'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.join(__dirname,
  '../native/app/src/main/assets/assets/mobile-app.css'),'utf8');
const library=fs.readFileSync(path.join(__dirname,
  '../../../packages/editor-ui/creative-tools.css'),'utf8');

test('QA-001 Android library tab track uses the light sheet, not the missing skin fallback',()=>{
  assert.match(library,/background:var\(--nm-skin-top,#1b2b45\)/);
  assert.match(css,/--nm-skin-top:\s*var\(--glauka-app-soft\)/);
  assert.match(css,/--nm-skin-surface:\s*var\(--glauka-app-paper\)/);
  const rule=css.match(/body\.glauka-mobile-app #nm-creative-library-tabs \{[^}]+\}/);
  assert.ok(rule,'mobile sheet must restyle the library tab track');
  assert.match(rule[0],/background:\s*var\(--glauka-app-soft\)\s*!important/);
  assert.match(rule[0],/border:\s*1px solid var\(--glauka-app-line\)\s*!important/);
  assert.match(rule[0],/color:\s*var\(--glauka-app-ink\)\s*!important/);
});

test('QA-002 study windows follow the sheet instead of a fixed navy card',()=>{
  assert.match(css,/body\.glauka-mobile-app :is\(\s*#nm-ocr \.ocr-window/);
  assert.match(css,/#nm-ocr \.ocr-window[\s\S]*background:var\(--nm-skin-surface\)!important/);
  const theme=fs.readFileSync(path.join(__dirname,
    '../../../packages/editor-ui/interface-theme.css'),'utf8');
  assert.match(theme,/body\.nm-workspace-v2\[data-nm-skin\] :is\(\s*#nm-ocr \.ocr-window/);
  assert.match(theme,/#nm-anki \.nm-anki-box/);
  assert.match(theme,/#nm616-compare/);
});

test('QA-026 library tab labels stay whole words and reflow when the dialog is narrow',()=>{
  assert.match(library,/#nm-creative-library-hub #nm-creative-library-tabs button\{[^}]*overflow-wrap:normal/);
  assert.match(library,/@container gl-library \(max-width:640px\)\{[^}]*grid-template-columns:repeat\(3/);
  assert.doesNotMatch(library,/#nm-creative-library-tabs button\{[^}]*overflow-wrap:anywhere/);
});
