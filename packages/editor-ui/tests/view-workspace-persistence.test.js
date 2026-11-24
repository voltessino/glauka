'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Atlas=require('../../../apps/desktop-shared/editor/atlas-library-core.js');

const metadataPath=path.join(__dirname,'../../../apps/desktop-shared/editor/workspace-view-metadata.js');
const source=fs.readFileSync(metadataPath,'utf8');
const funcs=new Function('NeuroMapAtlasLibrary',source+
 '\nreturn {clean:nmCleanViewWorkspace,archive:nmArchiveViewWorkspaces,canvas:nmCleanCanvasCamera};')(Atlas);
const {clean,archive,canvas}=funcs;

test('workspace layouts are bounded, sanitized and backward compatible',()=>{
 const empty=clean(null);
 assert.deepEqual(empty,{sideMode:null,width:50,layouts:[],activeName:null,cameras:{}});
 assert.equal(clean({sideMode:'script',width:999}).sideMode,null);
 assert.equal(clean({sideMode:'timeline',width:-200}).width,30);
 const layouts=Array.from({length:30},(_,i)=>({
  name:'Layout '+i,primaryMode:i%2?'kanban':'mindmap',
  sideMode:i%2?'orgchart':'timeline',width:i%2?100:25
 }));
 layouts[1].name='layout 0';
 const result=clean({sideMode:'kanban',width:58,layouts,activeName:'Layout 0'});
 assert.equal(result.layouts.length,8);
 assert.equal(result.layouts[0].primaryMode,'mindmap');
 assert.ok(result.layouts.every(x=>x.width>=30&&x.width<=65));
 assert.equal(result.activeName,'Layout 0');
 assert.equal(clean({layouts:[{name:'  Untitled  ',primaryMode:'unexpected',sideMode:'bad',width:null}]}).layouts[0].primaryMode,'mindmap');
});

test('saved layouts can be recovered by file identity even after their tab closes',()=>{
 const t={filePath:'C:\\Users\\Project.neuromap',originSheetIndex:0,
  viewWorkspace:{sideMode:'kanban',width:62,activeName:'Plan',layouts:[{
   name:'Plan',primaryMode:'mindmap',sideMode:'kanban',width:62
  }]}};
 const initial=archive([],[t]);
 assert.equal(initial.length,1);
 assert.equal(Atlas.keyFor(initial[0]),Atlas.keyFor(t));
 assert.equal(initial[0].viewWorkspace.layouts[0].name,'Plan');
 const restored=archive(JSON.parse(JSON.stringify(initial)),[]);
 assert.equal(restored[0].viewWorkspace.sideMode,'kanban');
 assert.equal(restored[0].viewWorkspace.width,62);
});

test('archived workspace layouts have per-sheet identity and a firm record limit',()=>{
 const p='C:\\Workspace\\Multi.xmind';
 const first={filePath:p,originSheetIndex:0,viewWorkspace:{sideMode:'orgchart',width:35}};
 const second={filePath:p,originSheetIndex:1,viewWorkspace:{sideMode:'timeline',width:60}};
 const entries=archive([],[first,second]);
 assert.equal(entries.length,2);
 assert.notEqual(Atlas.keyFor(entries[0]),Atlas.keyFor(entries[1]));
 const all=Array.from({length:90},(_,i)=>({
  filePath:'C:\\Work\\Item'+i+'.neuromap',originSheetIndex:0,
  viewWorkspace:{sideMode:i%2?'kanban':'timeline',width:50}
 }));
 assert.equal(archive([],all).length,60);
 assert.equal(archive([{filePath:'../unsafe',viewWorkspace:{sideMode:'kanban'}}]).length,0);
});


test('six alternate views keep twelve independent, bounded full and split cameras',()=>{
 const modes=['orgchart','concept-tree','concept-network','flowchart','kanban','timeline'];
 const cameras={};
 for(const [i,mode]of modes.entries()){
  cameras[mode]={zoom:.4+i*.4,left:110+i*35,top:205+i*24};
  cameras[mode+':side']={zoom:1+i*.2,left:210+i*22,top:180+i*13};
 }
 cameras['__proto__']={zoom:1,left:0,top:0};
 cameras['mindmap']={zoom:3,left:2,top:4};
 cameras.kanban={zoom:10,left:999999999999,top:-500};
 const result=clean({cameras});
 assert.equal(Object.keys(result.cameras).length,12);
 assert.equal(result.cameras.kanban.zoom,3.5);
 assert.equal(result.cameras.kanban.left,100000000);
 assert.equal(result.cameras.kanban.top,0);
 assert.equal(result.cameras['kanban:side'].zoom,1.8);
 assert.equal(result.cameras.timeline.left,285);
 assert.equal(result.cameras.mindmap,undefined);
 assert.equal(result.cameras.__proto__,Object.prototype);
});
test('uninitialized, malformed or legacy camera positions cannot suppress first-time centering',()=>{
 const result=clean({cameras:{
  orgchart:{zoom:1,left:null,top:null},
  kanban:{zoom:Infinity,left:10,top:20},
  timeline:{zoom:1,left:10,top:20},
  'timeline:side':{zoom:.5,left:99,top:123},
  flowchart:{zoom:1,left:-4,top:19},
  'concept-tree':{zoom:1,left:'nan',top:42}
 }});
 assert.equal(result.cameras.orgchart,undefined);
 assert.equal(result.cameras.kanban,undefined);
 assert.equal(result.cameras['concept-tree'],undefined);
 assert.equal(result.cameras.flowchart.left,0);
 assert.deepEqual(result.cameras.timeline,{zoom:1,left:10,top:20});
 assert.deepEqual(result.cameras['timeline:side'],{zoom:.5,left:99,top:123});
 assert.deepEqual(clean({}).cameras,{});
});
test('closed file keeps independent cameras when archived and reopened',()=>{
 const file='C:\\Study\\Anatomia.neuromap';
 const tab={filePath:file,originSheetIndex:0,viewWorkspace:{
  cameras:{kanban:{zoom:.73,left:132,top:84},
   'kanban:side':{zoom:1.1,left:12,top:24},
   timeline:{zoom:.52,left:430,top:315}},
  sideMode:'kanban',width:57}};
 const saved=archive([],[tab]);
 const disk=JSON.parse(JSON.stringify(saved));
 const reloaded=archive(disk,[]);
 assert.equal(reloaded[0].viewWorkspace.cameras.kanban.zoom,.73);
 assert.equal(reloaded[0].viewWorkspace.cameras['kanban:side'].left,12);
 assert.equal(reloaded[0].viewWorkspace.cameras.timeline.top,315);
 assert.equal(reloaded[0].viewWorkspace.sideMode,'kanban');
});


test('main mind-map camera is restored exactly and rejects invalid persisted data',()=>{
 const valid={x:-423.6,y:202.45,zoom:.004};
 assert.deepEqual(canvas(valid),valid);
 assert.equal(canvas({x:Infinity,y:0,zoom:1}),null);
 assert.equal(canvas({x:0,y:NaN,zoom:1}),null);
 assert.equal(canvas({x:'22',y:0,zoom:1}),null);
 assert.equal(canvas(null),null);
 assert.deepEqual(canvas({x:2e10,y:-2e10,zoom:8}),{
  x:100000000,y:-100000000,zoom:3.5});
 assert.deepEqual(canvas({x:60,y:70,zoom:.0001}),{x:60,y:70,zoom:.001});
});

test('editor manifest stages workspace metadata after Atlas and before the controller',()=>{
 const dir=path.join(__dirname,'../../../apps/desktop-shared/editor');
 const order=JSON.parse(fs.readFileSync(path.join(dir,'sources.json'),'utf8'));
 const atlas=order.indexOf('atlas-library-core.js');
 const meta=order.indexOf('workspace-view-metadata.js');
 const controller=order.indexOf('app.js');
 assert.ok(atlas>=0&&meta===atlas+1&&controller===meta+1);
 assert.equal(fs.readFileSync(path.join(dir,'app.js'),'utf8').includes('function nmCleanViewWorkspace(raw)'),false);
 assert.equal(source.includes('class NeuroMapApp'),false);
});
