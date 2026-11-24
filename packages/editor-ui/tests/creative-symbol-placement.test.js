'use strict';
const composeUiSource=require('./helpers/compose-ui-source.cjs');

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const source=composeUiSource('creative-tools');
const styles=fs.readFileSync(path.join(root,'packages/editor-ui/creative-tools.css'),'utf8');

// Exercise the pure text helper extracted from the actual source, not a reimplementation.
const start=source.indexOf('    function toggleInlineMarkerText(');
const end=source.indexOf('    function catalogueTab(kind)',start);
assert.ok(start>=0&&end>start,'Inline marker helper must exist');
const toggle=new Function(source.slice(start,end)+';return toggleInlineMarkerText;')();

test('Priority 2 is inserted before the editable label and toggles without duplicates',()=>{
  assert.equal(toggle('Ciao','❷'),'❷ Ciao');
  assert.equal(toggle('❷ Ciao','❷'),'Ciao');
  assert.equal(toggle('','❷'),'❷');
  assert.equal(toggle('❷','❷'),'');
  assert.equal(toggle('Ciao\nmondo','❷'),'❷ Ciao\nmondo');
});

test('Symbol placement remains an explicit accessible option',()=>{
  assert.match(source,/let symbolPlacement = 'text';/);
  assert.match(source,/\['text','Nel testo','In text'\]/);
  assert.match(source,/\['badge','Sul ramo','On branch'\]/);
  assert.match(source,/aria-pressed/);
  assert.match(styles,/nm-creative-symbol-placement/);
  assert.match(styles,/min-height:44px/);
});

test('Existing external marker mode is preserved, without modifying stored map schemas',()=>{
  assert.match(source,/else if\(symbolPlacement==='text'\)/);
  assert.match(source,/current\.markers=\(current\.markers\|\|\[\]\)\.filter\(id=>id!==entry\.id\)/);
  assert.match(source,/const markers=\[\.\.\.\(current\.markers\|\|\[\]\)\]/);
  assert.match(source,/if\(i>=0\)markers\.splice\(i,1\)/);
  assert.match(source,/else if\(markers\.length<3\)markers\.push\(entry\.id\)/);
  assert.match(source,/app\.state\.pushHistory\(\)/);
});

test('open creative pickers refresh destination and symbol state on selection',()=>{
  assert.match(source,/function watchSelection\(app, onChange\)/);
  assert.match(source,/const restoreSelection = watchSelection\(app, \(\) => refreshSelection\(\)\)/);
  assert.match(source,/function refreshTargetOptions\(preferred=target\.value\)/);
  assert.match(source,/return target\.value==='root'\?app\.state\.root:selectedNode\(\)/);
});
