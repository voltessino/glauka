'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
// Android WebView stores full snapshots: rapid editing must bound the combined
// Undo/Redo history, not evict a user's last reversible action.
// Runs in node --test against actual Android state source. Not a heap profiler.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Core=require('../../map-core');
const file=path.resolve(__dirname,'../../../apps/android/editor/state.js');
const src=fs.readFileSync(file,'utf8');
const palette=['#f43f5e'];
const State=new Function('NeuroMapCore','nm70PreferredGap','localStorage',
 'HARMONIC_PALETTE','ColorUtils','THEME_PALETTES','globalThis',
 src+'\nreturn MindMapStateMachine;')(
 Core,()=>150,{getItem:()=>null},palette,{lighten:hex=>hex},{},{});
function setup(notes=''){
 const state=new State();
 state.root={id:'r',side:'root',text:'start',children:[
  {id:'a',side:'right',parentId:'r',text:'Topic',notes,children:[]}
 ]};
 return state;
}
test('Android keeps 60 snapshots for small maps with exact Undo/Redo',()=>{
 const s=setup();
 for(let i=0;i<75;i++){s.pushHistory();s.root.text='edit-'+i;}
 assert.equal(s.maxHistory,60);
 assert.equal(s.undoStack.length,60);
 assert.equal(s.getHistoryMemoryStats().budgetBytes,16*1024*1024);
 assert.equal(s.undo(),true);assert.equal(s.root.text,'edit-73');
 assert.equal(s.redo(),true);assert.equal(s.root.text,'edit-74');
});
test('large repeated edits evict oldest history and preserve latest undo/redo',()=>{
 const s=setup('多'.repeat(400000));
 s.maxHistoryBytes=2300000;
 for(let i=0;i<18;i++){s.pushHistory();s.root.text='revision-'+i;}
 const stats=s.getHistoryMemoryStats();
 assert.ok(stats.undoSteps>=1&&stats.undoSteps<18);
 assert.ok(stats.estimatedTotalBytes<=s.maxHistoryBytes);
 const last=s.root.text;
 assert.equal(s.undo(),true);assert.notEqual(s.root.text,last);
 assert.equal(s.redo(),true);assert.equal(s.root.text,last);
 assert.equal(s.undo(),true);
 s.pushHistory();s.root.text='new fork';
 assert.equal(s.redo(),false,'new edits must invalidate redo');
});
test('default 16 MiB budget trims large maps before 60 full snapshots accumulate',()=>{
 const s=setup('A'.repeat(330000));
 for(let i=0;i<45;i++){s.pushHistory();s.root.text='change-'+i;}
 const stats=s.getHistoryMemoryStats();
 assert.ok(stats.undoSteps<45,'memory-heavy history was left unbounded');
 assert.ok(stats.undoSteps>=1,'latest Undo was lost');
 assert.ok(stats.estimatedTotalBytes<=16*1024*1024);
});
test('a single huge deep map still preserves one emergency snapshot',()=>{
 const s=setup();let cursor=s.root;
 for(let i=0;i<10000;i++){
  const n={id:'d'+i,parentId:cursor.id,side:'right',text:'Deep',children:[]};
  cursor.children=[n];cursor=n;
 }
 s.maxHistoryBytes=50000;
 s.pushHistory();
 assert.equal(s.undoStack.length,1);
 assert.ok(s.getHistoryMemoryStats().estimatedUndoBytes>50000);
 s.root.text='Changed';
 assert.equal(s.undo(),true);assert.equal(s.root.text,'start');
 assert.equal(s.redo(),true);assert.equal(s.root.text,'Changed');
});
