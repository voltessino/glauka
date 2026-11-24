'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('cycle 4B view identity stays inside the stylesheet and keeps each view distinct',()=>{
  const file=path.join(root,'packages/editor-ui/linked-view-styles.js');
  const source=fs.readFileSync(file,'utf8');
  assert.doesNotThrow(()=>new vm.Script(source,{filename:file}));
  const marker=source.indexOf('Cycle 4B');
  const closing=source.lastIndexOf('\x60;');
  assert.ok(marker>0&&closing>marker,'the new view rules must stay inside the CSS template');
  for(const needle of [
    'data-view-mode="orgchart"','data-org-depth="0"',
    'data-view-mode="concept-tree"','data-tree-tier="leaf"',
    'data-view-mode="concept-network"','nm-network-large',
    'data-view-mode="flowchart"',
    'data-view-mode="kanban"',
    'data-view-mode="timeline"','is-milestone',
    'backdrop-filter:none'
  ])assert.ok(source.includes(needle),needle);
});

test('cycle 4B does not retune the projection engines',()=>{
  for(const name of [
    'packages/editor-ui/view-core.js',
    'packages/editor-ui/concept-network.js',
    'packages/editor-ui/flow-core.js',
    'packages/editor-ui/work-core.js'
  ])assert.equal(read(name).includes('Cycle 4B'),false,name);
});

test('mindmap glow is quieter on desktop and Android without moving the root',()=>{
  for(const name of [
    'apps/desktop-shared/editor/renderer.js',
    'apps/android/editor/renderer.js'
  ]){
    const source=read(name);
    assert.match(source,/shadowBlur = isSelected \? 10 : 6/);
    assert.match(source,/shadowBlur = isSelected \? 6 : 0/);
    assert.doesNotMatch(source,/shadowBlur = isSelected \? 26 : 16/);
  }
});
