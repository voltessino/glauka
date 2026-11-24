'use strict';
const composeKnowledgeUi=()=>{
  const dir=path.join(__dirname,'../../../apps/desktop-shared/editor');
  return fs.readFileSync(path.join(dir,'knowledge-ui.js'),'utf8').replace(/\r\n?/g,'\n')
    .replace('/* @neuromap-knowledge-ui-draw */\n',
      fs.readFileSync(path.join(dir,'knowledge-ui-draw.js'),'utf8').replace(/\r\n?/g,'\n'));
};

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const A=require('../../../apps/desktop-shared/editor/atlas-library-core.js');
const ui=composeKnowledgeUi();
const start=ui.indexOf('  async function jump(tabId,nodeId){');
const end=ui.indexOf('  function drawOutline()',start);
assert.ok(start>0&&end>start,'cannot isolate real Atlas navigation');
const func=ui.slice(start,end);
function fixture(user,choice='open',wrong=false,missingNode=false){
 const path='C:\\Work\\Atlas-'+user+'.neuromap',key=A.keyFor({filePath:path});
 const archive=[{key,filePath:path,tabId:'previous-'+user,title:'Archived '+user,
  nodes:[{id:'concept-'+user,text:'Concept '+user,depth:1}],updatedAt:1}];
 const activity=[],payload={path:wrong?'C:\\Work\\Other.neuromap':path,
  filename:'Atlas-'+user+'.neuromap',bytes:new Uint8Array([1,2])};
 const root={NeuroMapAtlasLibrary:A,neuromapDesktop:{async openProject(){activity.push('picker');return payload}}};
 const state={request(){}};
 const app={tabs:[],activeTabId:'initial',_nmAtlasArchive:archive,selectedNodeId:null,
  canvas:{clientWidth:1280,clientHeight:800},
  renderer:{camera:{zoom:1,x:0,y:0}},layout:{getLayout(){return {x:12,y:8}}},
  async nmAsk(){activity.push('confirm');return choice},
  async v6ImportNative(file){
   activity.push('import');
   const opened={id:'reopened-'+user,filePath:file.path,state:{
    findNode:id=>!missingNode&&id==='concept-'+user?{id}:null}};
   this.tabs.push(opened);
  },
  activateTab(id){activity.push('activate');this.activeTabId=id},
  selectNode(id){activity.push('select');this.selectedNodeId=id},
  requestRender(){activity.push('render')},
  showToast(message){activity.push('toast:'+message)}
 };
 const jump=new Function('root','app','state','tr','innerWidth','innerHeight',
  func+'\nreturn jump;')(root,app,state,(_,en)=>en,1280,800);
 return {jump:()=>jump(key,'concept-'+user),key,activity,app};
}
test('1000 archived project navigations require explicit choice and select original ID',async()=>{
 for(let user=0;user<1000;user++){
  const f=fixture(user);await f.jump();
  assert.deepEqual(f.activity.slice(0,4),['confirm','picker','import','activate']);
  assert.equal(f.app.selectedNodeId,'concept-'+user);
  assert.equal(f.activity.includes('render'),true);
 }
});
test('wrong file path is rejected before importing any map',async()=>{
 const f=fixture(9,'open',true);await f.jump();
 assert.deepEqual(f.activity.slice(0,2),['confirm','picker']);
 assert.equal(f.activity.includes('import'),false);
 assert.ok(f.activity.some(x=>x.startsWith('toast:')));
});
test('cancel does not open the native file picker',async()=>{
 const f=fixture(10,'cancel');await f.jump();
 assert.deepEqual(f.activity,['confirm']);
});
test('removed node ID is never redirected to a similar-looking arbitrary node',async()=>{
 const f=fixture(11,'open',false,true);await f.jump();
 assert.equal(f.app.selectedNodeId,null);
 assert.ok(f.activity.some(x=>x.startsWith('toast:')));
});
