'use strict';
const composeUiSource=require('./helpers/compose-ui-source.cjs');

const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../../map-core/index.js');
const rootDir=path.resolve(__dirname,'../../..');
const tools=composeUiSource('creative-tools');
const start=tools.indexOf('    const split = Layout.prototype.computeDynamicClockwiseSplit;');
const end=tools.indexOf('    const side = Layout.prototype.layoutSideBranches;',start);
assert.ok(start>=0&&end>start);
const override=tools.slice(start,end);
function load(platform){
 const source=fs.readFileSync(path.join(rootDir,'apps',platform,'editor/layout.js'),'utf8');
 const mockDocument={createElement(){return {getContext(){return {measureText(s){return {width:String(s).length*9};}}}}}};
 const ctx={document:mockDocument,NeuroMapCore:core,nm68ClampGap:x=>Math.max(30,Math.min(220,x||150))};
 vm.runInNewContext(source+'\nthis.Engine=OrganicLayoutEngine;',ctx);
 const Engine=ctx.Engine;
 // Execute the shared runtime override against the real layout class.
 vm.runInNewContext('(function(Layout,root){'+override+'})',{});
 const install=new Function('Layout','root',override);
 install(Engine,{NeuroMapCore:core});
 return Engine;
}
function tree(length){
 return {id:'root',side:'root',layoutMode:'fluid',layoutDistribution:{enabled:false},text:'Central',children:
  Array.from({length},(_,i)=>({id:'n'+i,parentId:'root',side:'right',text:'Topic '+i,
   children:i%4===0?[{id:'d'+i,parentId:'n'+i,side:'right',text:'Child '+i,children:[]}]:[]}))};
}
for(const platform of ['desktop-shared','android']){
 test(platform+' Fluid distributes real measured geometry on both sides',()=>{
  const Layout=load(platform),layout=new Layout();layout.branchStyle='xmind8';
  const root=tree(6);
  const result=layout.computeLayout(root,50);
  assert.equal(result.totalPrimary,6);
  assert.ok(result.rightCount>0&&result.leftCount>0);
  assert.ok(layout.getLayout('n0').x>0);
  assert.ok(root.children.some(n=>n.side==='left'));
  root.children[0].sidePinned='left';
  const pinned=layout.computeLayout(root,50);
  assert.ok(pinned.leftIds.includes('n0'));
  assert.ok(layout.getLayout('n0').x<0);
  for(const side of ['left','right']){
   const metrics=root.children.filter(n=>n.side===side).map(n=>layout.getLayout(n.id))
    .sort((a,b)=>a.y-b.y);
   for(let i=1;i<metrics.length;i++)
    assert.ok(metrics[i].y-metrics[i-1].y >= (metrics[i].height+metrics[i-1].height)/2,
      'Primary labels must not overlap vertically');
  }
 });
 test(platform+' right/left presets allow deliberate user side overrides',()=>{
  const Layout=load(platform),layout=new Layout(),root=tree(5);
  root.layoutMode='right';root.children[1].sidePinned='left';
  let metrics=layout.computeLayout(root,50);
  assert.ok(metrics.leftIds.includes('n1'));
  assert.ok(layout.getLayout('n1').x<0);
  root.layoutMode='left';root.children[0].sidePinned='right';
  metrics=layout.computeLayout(root,50);
  assert.ok(metrics.rightIds.includes('n0'));
  assert.ok(layout.getLayout('n0').x>0);
 });
 test(platform+' retains existing clockwise and geometric balanced modes',()=>{
  const Layout=load(platform),layout=new Layout(),root=tree(6);
  root.layoutMode='clockwise';
  const clockwise=layout.computeLayout(root,50);
  assert.equal(clockwise.totalPrimary,6);
  root.layoutMode='balanced';root.layoutBalanceMode='geometry';
  const balanced=layout.computeLayout(root,50);
  assert.equal(balanced.totalPrimary,6);
  assert.equal(balanced.rightCount+balanced.leftCount,6);
 });
}
