'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const composeUiSource=require('./helpers/compose-ui-source.cjs');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function extract(src,start,end,dependencies){
 const from=src.indexOf(start),to=src.indexOf(end,from+start.length);
 assert.ok(from>=0&&to>from,'missing function source');
 return new Function(...Object.keys(dependencies),
  src.slice(from,to)+'\nreturn '+start.match(/function\s+([A-Za-z0-9_]+)/)[1]+';')(...Object.values(dependencies));
}
const defaults=()=>{
 const root={layoutMode:'clockwise',
  layoutDistribution:{enabled:true,height:960,minimumHeight:480,overflowMode:'expand'}};
 const state={root,branchStyle:'xmind8',balanceBias:50,thresholdY:500,
  history:[],pushHistory(){this.history.push(JSON.stringify(this.root))}};
 const app={state,closeEditor(){},recalculateAndRender(){},markChanged(){},
  layout:{_preferredViews:{clear(){}}}};
 return {root,state,app};
};
test('1000 UI view transitions retain adaptive height and opt-in',()=>{
 const src=composeUiSource('creative-tools'),settings=read('creative-settings-values.js');
 let legacyCalls=0;
 const helpers={NeuroMapContinuation:{
  initialSettings(){legacyCalls++;return {enabled:true,height:720,minimumHeight:480,overflowMode:'expand'}},
  showGuides(){} }};
 const choose=extract(src,'function chooseMode(app, mode) {','function sync(app)',{
  root:helpers,BUTTONS:[['clockwise'],['balanced'],['columns']],tr:a=>a
 });
 const layoutMode=new Function('root',settings+';return layoutMode;')(helpers);
 for(let user=0;user<1000;user++){
  const {root,state,app}=defaults(),height=480+(user%8)*120;
  root.layoutDistribution.height=height;
  const prev=JSON.stringify(root.layoutDistribution);
  const alternate=user%2?'balanced':'columns';
  choose(app,alternate);
  assert.equal(root.layoutDistribution.enabled,false);
  choose(app,'clockwise');
  assert.equal(JSON.stringify(root.layoutDistribution),prev);
  root.layoutDistribution.enabled=false;
  layoutMode(app,state,'clockwise');
  assert.equal(root.layoutDistribution.height,height);
  assert.equal(root.layoutDistribution.overflowMode,'expand');
  assert.equal(root.layoutDistribution.enabled,true);
 }
 assert.equal(legacyCalls,0,'new adaptive maps must not fall back to legacy anchors');
});
test('legacy projects initialize a single-centre configuration when enabled from balanced',()=>{
 const src=composeUiSource('creative-tools');
 let legacyCalls=0;
 const helper={NeuroMapContinuation:{
  initialSettings(){legacyCalls++;return {enabled:true,height:720,minimumHeight:480,overflowMode:'expand'}},
  showGuides(){} }};
 const choose=extract(src,'function chooseMode(app, mode) {','function sync(app)',{
  root:helper,BUTTONS:[['clockwise'],['balanced'],['columns']],tr:a=>a
 });
 const {root,app}=defaults();
 root.layoutDistribution={enabled:false,height:480,minimumHeight:480};
 root.layoutMode='balanced';
 choose(app,'clockwise');
 assert.equal(legacyCalls,1);
 assert.equal(root.layoutDistribution.initialOrder,undefined);
 assert.equal(root.layoutDistribution.overflowMode,'expand');
});
