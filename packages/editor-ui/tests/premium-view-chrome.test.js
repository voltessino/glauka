'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('premium view tokens stay inside the stylesheet and modes are transient',()=>{
  const styles=fs.readFileSync(path.resolve(__dirname,'../linked-view-styles.js'),'utf8');
  assert.doesNotThrow(()=>new vm.Script(styles));
  const closing=styles.lastIndexOf('\x60;');
  for(const token of ['--gv-space-1:4px','--gv-radius-sm:12px','--gv-motion-normal:180ms','--gv-ease-out:cubic-bezier(.16,1,.3,1)']){
    const at=styles.indexOf(token);
    assert.ok(at>=0&&at<closing,token+' must be inside the CSS template');
  }
  assert.match(styles,/\[data-view-mode="kanban"\]/);
  assert.match(styles,/\[data-view-mode="flowchart"\]/);
  assert.match(styles,/\[data-view-mode="timeline"\]/);
  const render=fs.readFileSync(path.resolve(__dirname,'../linked-view-runtime-render.js'),'utf8');
  const dual=fs.readFileSync(path.resolve(__dirname,'../linked-view-runtime-dual.js'),'utf8');
  assert.match(render,/overlay\.dataset\.viewMode=mode/);
  assert.match(dual,/pane\.dataset\.viewMode=secondary/);
  assert.doesNotMatch(render,/viewMode[^\n]{0,80}localStorage/);
  assert.doesNotMatch(render,/JSON\.stringify\([\s\S]{0,40}viewMode/);
});
