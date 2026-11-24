'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const core=require('../map-style-core');
test('desktop and Android expose one compact gallery, with all thirteen real previews',()=>{
 const desktop=read('packages/editor-ui/map-style-gallery.js');
 const android=read('apps/android/native/app/src/main/assets/assets/mobile-map-polish.js');
 const mobileCss=read('apps/android/native/app/src/main/assets/assets/mobile-map-polish.css');
 assert.equal(core.PRESETS.length,13);
 for(const s of [desktop,android]){
  assert.match(s,/createElement\('details'\)|el\('details'/);
  assert.match(s,/summary/);
  assert.match(s,/preview\(p,|mini\(p,/);
  assert.match(s,/grid\.append\(b|grid\.append\(button/);
 }
 assert.match(desktop,/id='nm-map-style-picker'/);
 assert.match(desktop,/lastChosen=p\.id/);
 assert.match(desktop,/disclosure\.open=false/);
 assert.match(desktop,/NeuroMapRefinements\?\.cancelPreview/);
 assert.match(android,/id='gl-android-map-style-picker'/);
 assert.match(mobileCss,/\.gl-android-style-picker:not\(\[open\]\)/);
});
test('500 simulated personas: applying styles keeps structure and one-step undo',()=>{
 const profiles=['prima esperienza','studente','professionista sanitario','utente esperto','vista ridotta'];
 let total=0,undones=0;
 for(let i=0;i<500;i++){
  const count=2+(i%120);
  const children=Array.from({length:count},(_,j)=>({id:'n'+i+'-'+j,
   text:'Argomento '+j+' '+('X'.repeat((i+j)%60)),children:[],
   nodeShape:'plain',side:j%2?'left':'right',customOrder:j}));
  const state={root:{id:'root'+i,text:'Centro',children},
   selectedNodeId:children[0].id,selectedNodeIds:[children[0].id],undo:[],
   pushHistory(){this.undo.push(JSON.stringify(this.root))}};
  const before=children.map(n=>({id:n.id,side:n.side,customOrder:n.customOrder}));
  const p=core.PRESETS[i%core.PRESETS.length];
  assert.ok(core.valid(p),profiles[i%profiles.length]);
  const countChanged=core.apply(state,p,'map',{prisma:['#5c5cdf'],default:['#7651e7']});
  assert.equal(countChanged,count);
  assert.equal(state.undo.length,1);
  assert.deepEqual(children.map(n=>({id:n.id,side:n.side,customOrder:n.customOrder})),before);
  const snapshot=JSON.parse(state.undo[0]);
  assert.equal(snapshot.children.length,count);assert.equal(snapshot.children[0].nodeShape,'plain');
  total+=count;undones++;
 }
 assert.equal(undones,500);assert.ok(total>20000);
});
test('cloud incoming sync is guarded by a local SHA backup and explicit conflict review',()=>{
 const cloud=read('apps/desktop-shared/src/cloud_sync_ui.js');
 const native=read('apps/desktop-shared/src/cloud_storage.go');
 const panel=read('apps/desktop-shared/src/cloud_panel.js');
 assert.match(cloud,/m\.importRemote\(id\)/);
 assert.match(cloud,/m\.pull\(id\)/);
 assert.match(cloud,/protect\(expectedLocal\)/);
 assert.match(cloud,/savePending\(provider,id,doc\.hash\)/);
 assert.match(cloud,/acceptIncoming,forgetAccount/);
 assert.match(native,/cloud\/workspace\/protect/);
 assert.match(native,/sha256\.Sum256\(original\)/);
 assert.match(panel,/Applica versione cloud/);
 assert.match(panel,/Apri come nuove schede/);
 assert.match(panel,/window\.confirm\(t\(/);
 assert.doesNotMatch(panel,/refresh_token|access_token/);
});
