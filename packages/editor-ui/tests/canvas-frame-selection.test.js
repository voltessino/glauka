'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function renderer(fn,ids){
 const env={};env.globalThis=env;vm.runInNewContext(require('./helpers/compose-graphics.cjs')(),env);
 class App{}class Renderer{render(...args){return fn.apply(this,args)}}
 env.NeuroMapGraphics.install(App,Renderer);
 const r=new Renderer();r.state={selectedNodeIds:ids};return r;
}
test('frame selection membership preserves includes semantics and is released after paint',()=>{
 const ids=['a','b','c','d','e','f','g','h',NaN,'a'];
 const r=renderer(function(){assert.equal(this._nmSelectedFrame.renderer,this);for(const id of [...ids,'missing'])assert.equal(this._nmSelectedFrame.set.has(id),ids.includes(id));return 7},ids);
 assert.equal(r.render(),7);assert.equal(r._nmSelectedFrame,undefined);
});
test('same-array edits and array replacement are fresh in the next frame',()=>{
 const ids=Array.from({length:10},(_,i)=>String(i)),found=[];
 const r=renderer(function(){found.push(this._nmSelectedFrame.set.has('changed'))},ids);
 r.render();ids[0]='changed';r.render();r.state.selectedNodeIds=Array.from({length:10},(_,i)=>'x'+i);r.render();
 assert.deepEqual(found,[false,true,false]);assert.equal(r._nmSelectedFrame,undefined);
});
test('small selections use the existing direct path and borrowed previews cannot own the index',()=>{
 const small=renderer(function(){assert.equal(this._nmSelectedFrame,null)},['a']);small.render();
 const r=renderer(function(){const preview=Object.create(this);preview.state={selectedNodeIds:[]};assert.notEqual(preview._nmSelectedFrame.renderer,preview)},Array.from({length:10},(_,i)=>i));r.render();
});
test('nested export clears selection, then restores the parent frame and original IDs',()=>{
 const ids=Array.from({length:10},(_,i)=>String(i));let depth=0;
 const r=renderer(function(ctx){if(ctx){assert.equal(this._nmSelectedFrame,null);assert.equal(this.state.selectedNodeIds.length,0);return}const parent=this._nmSelectedFrame;if(!depth++){this.render({});assert.equal(this._nmSelectedFrame,parent);assert.equal(this.state.selectedNodeIds,ids)}},ids);
 r.render();assert.equal(r._nmSelectedFrame,undefined);assert.equal(r.state.selectedNodeIds,ids);
});
test('exceptions release the frame index and restore export selection',()=>{
 const ids=Array.from({length:10},(_,i)=>i),r=renderer(()=>{throw Error('paint failed')},ids);
 assert.throws(()=>r.render(),/paint failed/);assert.equal(r._nmSelectedFrame,undefined);
 assert.throws(()=>r.render({}),/paint failed/);assert.equal(r.state.selectedNodeIds,ids);assert.equal(r._nmSelectedFrame,undefined);
});
