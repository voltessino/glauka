require('../../../apps/desktop-shared/editor/stack-safe-json.js');
// Desktop Windows/macOS: pending saves must never acknowledge unsaved flashcard edits.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Learning=require('../../../apps/desktop-shared/editor/learn-core');
const Adaptive=require('../../../apps/desktop-shared/editor/learn-adaptive-core');
const source=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/saving.js'),'utf8');

function fixture(options={}) {
  const pending=[], notices=[];
  const window={
    addEventListener(){},
    neuromapDesktop:{
      saveProject(request){return new Promise((resolve,reject)=>pending.push({request,resolve,reject}));}
    }
  };
  const copy=x=>JSON.parse(JSON.stringify(x));
  const Model={cloneTree:copy,cloneImages:copy,cloneRelationships:copy};
  const saving=new Function('window','NeuroMapApp','MindMapIOManager','nm66ExecuteShortcut',
    'NM66_ACTIONS','nm68ClampGap','nm64PreferredWrap','MindMapStateMachine','NeuroMapLearningCore','NeuroMapAdaptiveCore','console',
    source+'\nreturn NM614;')(
    window,function(){},function(){},()=>{},[],x=>x,()=>48,Model,Learning,Adaptive,{error(){}}
  );
  const name=options.xmind?'C:/maps/shared.xmind':'C:/maps/example.neuromap';
  const tab=id=>({id,filePath:name,fileName:name.split('/').pop(),state:{
    root:{id:'root-'+id,text:'Map',children:[]},images:[],relationships:[],
    thresholdY:500,balanceBias:50,compactness:100,branchGapX:150,
    strokeScale:1,typographyPreset:'uniform',typographyScale:1,branchStyle:'neon',
    defaultLabelWrapChars:48,wrapCustom:false,isDirty:true
  }});
  const tabs=options.xmind?[tab('first'),tab('second')]:[tab('first')];
  const app={tabs,activeTabId:'first',learningAttempts:[],learningPlans:[],studyCards:[{id:'card',sourceTabId:'first',question:'Q',answer:'Old',sr:{dueAt:1}}],
    saveActiveTabSnapshot(){},renderTabBar(){},scheduleSave(){},showToast(msg){notices.push(msg)},
    io:{sanitizeFilename(){return 'map';}},v6XMindSheets(){return [{root:tabs[0].state.root}]}
  };
  if(!options.noGetter)app.getStudyCardsForTab=id=>copy(app.studyCards.filter(c=>c.sourceTabId===id));
  const finish=(n=0)=>pending[n].resolve({path:tabs[0].filePath,name:tabs[0].fileName});
  return {saving,app,tabs,pending,notices,finish};
}
test('unmodified save writes cards and clears dirty',async()=>{
  const f=fixture(),p=f.saving.performSave(f.app,f.tabs[0]);
  assert.equal(JSON.parse(f.pending[0].request.json).studyCards[0].answer,'Old');
  f.finish();assert.equal((await p).ok,true);assert.equal(f.tabs[0].state.isDirty,false);
});
test('card answer change during pending write leaves dirty',async()=>{
  const f=fixture(),p=f.saving.performSave(f.app,f.tabs[0]);
  f.app.studyCards[0].answer='New';f.tabs[0].state.isDirty=false;
  f.finish();await p;assert.equal(f.tabs[0].state.isDirty,true);
  assert.equal(JSON.parse(f.pending[0].request.json).studyCards[0].answer,'Old');
});
test('card addition/removal while pending save leaves dirty',async()=>{
  for(const mutate of [cards=>cards.push({id:'new',sourceTabId:'first'}),cards=>cards.splice(0,1)]){
    const f=fixture(),p=f.saving.performSave(f.app,f.tabs[0]);
    mutate(f.app.studyCards);f.finish();await p;assert.equal(f.tabs[0].state.isDirty,true);
  }
});
test('review interval change during pending save leaves dirty',async()=>{
  const f=fixture(),p=f.saving.performSave(f.app,f.tabs[0]);
  f.app.studyCards[0].sr.dueAt=42;f.finish();await p;
  assert.equal(f.tabs[0].state.isDirty,true);
});
test('map editing while pending save leaves dirty',async()=>{
  const f=fixture(),p=f.saving.performSave(f.app,f.tabs[0]);
  f.tabs[0].state.root.text='New text';f.finish();await p;
  assert.equal(f.tabs[0].state.isDirty,true);
});
test('linked XMind sheets are acknowledged individually',async()=>{
  const f=fixture({xmind:true}),p=f.saving.performSave(f.app,f.tabs[0]);
  f.app.studyCards.push({id:'second-new',sourceTabId:'second',question:'New'});
  f.tabs[1].state.isDirty=false;
  f.finish();await p;
  assert.equal(f.tabs[0].state.isDirty,false);
  assert.equal(f.tabs[1].state.isDirty,true);
});
test('cancelled save keeps original dirty status',async()=>{
  const f=fixture(),p=f.saving.performSave(f.app,f.tabs[0]);
  f.pending[0].resolve({cancelled:true});
  assert.equal((await p).ok,false);assert.equal(f.tabs[0].state.isDirty,true);
});
test('disk error never reports a successful save',async()=>{
  const f=fixture(),p=f.saving.performSave(f.app,f.tabs[0]);
  f.pending[0].reject(Error('Disk full'));
  assert.equal((await p).ok,false);assert.equal(f.tabs[0].state.isDirty,true);
  assert.equal(f.notices.some(v=>v.includes('Disk full')),true);
});
test('legacy editor without flashcard getter still saves',async()=>{
  const f=fixture({noGetter:true}),p=f.saving.performSave(f.app,f.tabs[0]);
  assert.equal(JSON.parse(f.pending[0].request.json).studyCards.length,0);
  f.finish();await p;assert.equal(f.tabs[0].state.isDirty,false);
});
test('stress: 1,000 asynchronous saves detect an intervening flashcard edit',async()=>{
  for(let seed=0;seed<1000;seed++){
    const f=fixture(),p=f.saving.performSave(f.app,f.tabs[0]);
    f.app.studyCards[0].answer='Seed-'+seed;
    f.tabs[0].state.isDirty=false;
    f.finish();await p;
    assert.equal(f.tabs[0].state.isDirty,true,'scenario '+seed);
  }
});


test('browser File System Access save keeps newer card edits dirty until another save',async()=>{
  let resolveClose, saved='';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const writer={async write(content){saved=content},close(){return new Promise(resolve=>{resolveClose=resolve})}};
  const fileHandle={async createWritable(){return writer}};
  const showSaveFilePicker=async()=>fileHandle;
  const win={addEventListener(){},neuromapDesktop:null,showSaveFilePicker};
  const model={cloneTree:copy,cloneImages:copy,cloneRelationships:copy};
  const saving=new Function('window','NeuroMapApp','MindMapIOManager','nm66ExecuteShortcut',
    'NM66_ACTIONS','nm68ClampGap','nm64PreferredWrap','MindMapStateMachine',
    'showSaveFilePicker','console',source+'\nreturn NM614;')(
      win,function(){},function(){},()=>{},[],x=>x,()=>48,model,showSaveFilePicker,{error(){}}
    );
  const state={root:{id:'r',text:'Browser',children:[]},images:[],relationships:[],isDirty:true};
  const tab={id:'first',state,fileName:'browser.neuromap'};
  const app={tabs:[tab],activeTabId:'first',
    studyCards:[{id:'card',sourceTabId:'first',answer:'Original'}],
    getStudyCardsForTab(id){return copy(this.studyCards.filter(c=>c.sourceTabId===id))},
    saveActiveTabSnapshot(){},renderTabBar(){},scheduleSave(){},showToast(){},
    io:{sanitizeFilename(){return 'browser'}}
  };
  const p=saving.performSave(app,tab);
  for(let i=0;i<20&&!resolveClose;i++)await Promise.resolve();
  assert.equal(typeof resolveClose,'function');
  app.studyCards[0].answer='Unsaved';
  resolveClose();
  assert.equal((await p).ok,true);
  assert.equal(JSON.parse(saved).studyCards[0].answer,'Original');
  assert.equal(tab.state.isDirty,true);
});

test('queued saves write the latest card snapshot and only then clear dirty',async()=>{
  const f=fixture();
  f.app.closeEditor=()=>{};
  const first=f.saving.saveOne(f.app);
  for(let i=0;i<10&&f.pending.length<1;i++)await Promise.resolve();
  assert.equal(f.pending.length,1);
  const second=f.saving.saveOne(f.app);
  f.app.studyCards[0].answer='Updated for second write';
  assert.equal(JSON.parse(f.pending[0].request.json).studyCards[0].answer,'Old');
  f.finish(0);
  for(let i=0;i<20&&f.pending.length<2;i++)await Promise.resolve();
  assert.equal(f.pending.length,2);
  assert.equal(JSON.parse(f.pending[1].request.json).studyCards[0].answer,'Updated for second write');
  f.pending[1].resolve({path:f.tabs[0].filePath,name:f.tabs[0].fileName});
  assert.equal(await first,true);
  assert.equal(await second,true);
  assert.equal(f.tabs[0].state.isDirty,false);
});

test('6.19 progress is part of project payload and pending save dirty fingerprint',async()=>{
 const f=fixture();
 f.app.learningAttempts=Learning.addAttempt([],{
  tabId:'first',nodeId:'root-first',itemId:'q-1',format:'open',
  correct:true,sourceSignature:'sig'},1730000000000);
 const pending=f.saving.performSave(f.app,f.tabs[0]);
 const saved=JSON.parse(f.pending[0].request.json);
 assert.equal(saved.learningAttempts.length,1);
 assert.equal(saved.learningAttempts[0].correct,true);
 f.app.learningAttempts=Learning.addAttempt(f.app.learningAttempts,{
  tabId:'first',nodeId:'root-first',itemId:'q-2',format:'choice',
  correct:false,sourceSignature:'sig'},1730000000010);
 f.finish();await pending;
 assert.equal(f.tabs[0].state.isDirty,true);
 assert.equal(saved.learningAttempts.length,1);
});
test('6.19 sibling tab progress cannot enter the wrong single-tab export',async()=>{
 const f=fixture({xmind:true});
 f.app.learningAttempts=Learning.addAttempt([],{
  tabId:'second',nodeId:'root-second',itemId:'other',format:'open',
  correct:false,sourceSignature:'x'},1730000000000);
 const p=f.saving.performSave(f.app,f.tabs[0]);
 assert.equal(JSON.parse(f.pending[0].request.json).learningAttempts.length,0);
 f.finish();await p;
 assert.equal(f.tabs[0].state.isDirty,false);
});

test('6.19.1 pending save never acknowledges a newer exam plan',async()=>{
 const f=fixture();
 f.app.learningPlans=Adaptive.setPlan([],{tabId:'first',
  examDate:'2027-02-12',minutesPerDay:30},1730000000000);
 const pending=f.saving.performSave(f.app,f.tabs[0]);
 const disk=JSON.parse(f.pending[0].request.json);
 assert.equal(disk.learningPlan.examDate,'2027-02-12');
 f.app.learningPlans=Adaptive.setPlan(f.app.learningPlans,{tabId:'first',
  examDate:'2027-03-12',minutesPerDay:60},1730000000100);
 f.finish();await pending;
 assert.equal(f.tabs[0].state.isDirty,true);
 assert.equal(disk.learningPlan.examDate,'2027-02-12');
});
test('6.19.1 exam plans are scoped to the correct tab in multi-sheet saves',async()=>{
 const f=fixture({xmind:true});
 f.app.learningPlans=Adaptive.setPlan([],{tabId:'second',
  examDate:'2027-05-12',minutesPerDay:40},1730000000000);
 const pending=f.saving.performSave(f.app,f.tabs[0]);
 const disk=JSON.parse(f.pending[0].request.json);
 assert.equal(disk.learningPlan,null);
 f.finish();await pending;
 assert.equal(f.tabs[0].state.isDirty,false);
});
