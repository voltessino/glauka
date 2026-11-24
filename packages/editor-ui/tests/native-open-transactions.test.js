const {composeDesktopControls}=require('./helpers/compose-app-source.cjs');
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const core=require('../../../apps/desktop-shared/editor/native-open-core.js');
class App{
 constructor(){const state={root:{text:'Unsaved'},isDirty:true,undoStack:[{original:true}],redoStack:[]};this.tabs=[{id:'original',state,title:'Unsaved'}];this.activeTabId='original';this.state=state;this.renderer={state};this.origins=[];this.studyCards=[];this.learningAttempts=[];this.learningPlans=[];}
 activateTab(id){this.activeTabId=id;this.state=this.tabs.find(t=>t.id===id).state;this.renderer.state=this.state;}
 showToast(){}recalculateAndRender(){}renderTabBar(){}
}
new Function('NeuroMapApp','window',composeDesktopControls('desktop-shared'))(App,{GlaukaNativeOpen:core});
const payload=name=>({filename:name+'.gk',path:'/maps/'+name+'.gk',bytes:new TextEncoder().encode('{}')});
function setup(){const app=new App();app.v6SetOrigin=(origin,before,previous,ids)=>app.origins.push({path:origin.path,ids});return app;}
test('cancelled import never assigns the cancelled file to the existing unsaved map',async()=>{
 const app=setup(),state=app.state;app.importFiles=async()=>0;const outcome={};
 assert.equal(await app.v6ImportNative(payload('cancelled'),true,{outcome}),false);
 assert.equal(outcome.status,'ignored');assert.equal(outcome.code,'cancelled');assert.deepEqual(app.origins,[]);assert.equal(app.state,state);assert.equal(state.isDirty,true);assert.deepEqual(state.undoStack,[{original:true}]);
});
test('two asynchronous imports serialize commits and only their own tab IDs receive origins',async()=>{
 const app=setup();let release,started,active=0,max=0;const entered=new Promise(r=>started=r),gate=new Promise(r=>release=r);
 app.importFiles=async(files,newTab,options)=>{max=Math.max(max,++active);if(files[0].name==='one.gk'){started();await gate;}const tab={id:files[0].name,state:{root:{text:files[0].name}}};app.tabs.push(tab);options.onImportTab(tab);active--;return 1};
 const first=app.v6ImportNative(payload('one'));await entered;const second=app.v6ImportNative(payload('two'));
 const user={id:'user-created',state:{root:{text:'User draft'},isDirty:true,undoStack:[1]}};app.tabs.push(user);release();await Promise.all([first,second]);
 assert.equal(max,1);assert.deepEqual(app.origins.map(o=>o.ids),[['one.gk'],['two.gk']]);assert.ok(app.tabs.includes(user));assert.deepEqual(user.state.undoStack,[1]);
});
test('failed native import removes its partial tabs while preserving independent user work',async()=>{
 const app=setup(),original=app.state,user={id:'user-draft',state:{root:{text:'Keep me'},isDirty:true,undoStack:[7]}};
 app.importFiles=async(files,newTab,options)=>{app.tabs.push(user);const own={id:'partial',state:{root:{text:'Partial'}}};app.tabs.push(own);options.onImportTab(own);app.activeTabId=own.id;throw Error('broken later sheet')};
 await assert.rejects(app.v6ImportNative(payload('bad')),/broken later sheet/);
 assert.deepEqual(app.tabs.map(t=>t.id),['original','user-draft']);assert.equal(app.activeTabId,'original');assert.equal(app.state,original);assert.deepEqual(user.state.undoStack,[7]);assert.deepEqual(app.origins,[]);
});

test('assigning origins keeps edits and Undo history made while earlier chapters import',()=>{
 class OriginApp extends App{scheduleSave(){}}
 const win={GlaukaNativeOpen:core};
 new Function('NeuroMapApp','window',composeDesktopControls('desktop-shared'))(OriginApp,win);
 new Function('NeuroMapApp','window','document',fs.readFileSync(path.resolve(__dirname,'../../../apps/desktop-shared/editor/layout-tab-order.js'),'utf8'))(OriginApp,win,{querySelectorAll:()=>[]});
 const app=new OriginApp(),edited={id:'edited-import',state:{root:{text:'User changed this chapter'},isDirty:true,undoStack:[{old:'Original'}],redoStack:[]}},clean={id:'clean-import',state:{root:{text:'Untouched chapter'},isDirty:true,undoStack:[],redoStack:[]}};
 app.tabs.push(edited,clean);const undo=edited.state.undoStack;
 app.v6SetOrigin({path:'/maps/book.xmind',filename:'book.xmind'},new Set(['original']),'original',['edited-import','clean-import']);
 assert.equal(edited.state.isDirty,true);assert.equal(edited.state.undoStack,undo);assert.equal(edited.filePath,'/maps/book.xmind');assert.equal(clean.state.isDirty,false);assert.equal(clean.originSheetIndex,1);assert.equal(app.tabs[0].filePath,undefined);
});

test('a queued replacement keeps the tab selected when requested',async()=>{
 const app=setup();let release,started;const entered=new Promise(r=>started=r),gate=new Promise(r=>release=r);
 app.importFiles=async(files,newTab,options)=>{
  if(newTab){started();await gate;const tab={id:'first-import',state:{root:{text:'First'}}};app.tabs.push(tab);options.onImportTab(tab);app.activateTab(tab.id);}
  else{assert.equal(options.targetTabId,'original');const tab=app.tabs.find(t=>t.id===options.targetTabId);tab.state={root:{text:'Replacement'}};options.onImportTab(tab);app.activateTab(tab.id);}
  return 1;
 };
 const first=app.v6ImportNative(payload('first'));await entered;
 const replacement=app.v6ImportNative(payload('replace'),false);release();await Promise.all([first,replacement]);
 assert.equal(app.tabs.find(t=>t.id==='original').state.root.text,'Replacement');
 assert.equal(app.tabs.find(t=>t.id==='first-import').state.root.text,'First');
 assert.deepEqual(app.origins[1].ids,['original']);
});
test('a failed replacement restores the original and removes only its additional sheets',async()=>{
 const app=setup(),original=app.state;
 app.importFiles=async(files,newTab,options)=>{const tab=app.tabs[0];tab.state={root:{text:'Partial replacement'}};options.onImportTab(tab);const sheet={id:'partial-sheet',state:{root:{text:'Partial sheet'}}};app.tabs.push(sheet);options.onImportTab(sheet);app.activateTab(sheet.id);throw Error('invalid later sheet');};
 await assert.rejects(app.v6ImportNative(payload('replace'),false),/invalid later sheet/);
 assert.deepEqual(app.tabs.map(t=>t.id),['original']);assert.equal(app.tabs[0].state,original);assert.equal(app.state,original);assert.equal(original.isDirty,true);assert.deepEqual(original.undoStack,[{original:true}]);
});

test('an all-duplicate batch performs no redundant workspace serialization',async()=>{
 const app=setup();let writes=0;app.tabs[0].filePath='/maps/open.gk';app.closeEditor=()=>{};app.persistWorkspace=async()=>{writes++;return true};app.v6ReportNativeOpen=()=>{};
 const result=await app.v6ImportNativeBatch([{filename:'open.gk',path:'/maps/open.gk',size:1024},{filename:'open.gk',path:'/maps/open.gk',size:1024}]);
 assert.equal(writes,0);assert.deepEqual([result.opened,result.ignored,result.failed],[0,2,0]);assert.equal(result.backupProtected,undefined);assert.equal(app.tabs[0].state.isDirty,true);assert.deepEqual(app.tabs[0].state.undoStack,[{original:true}]);
});
