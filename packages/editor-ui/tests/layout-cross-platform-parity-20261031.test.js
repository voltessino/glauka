'use strict';
const composeUiSource=require('./helpers/compose-ui-source.cjs');

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'../../..');
const file=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
const core=require('../../map-core/index.js');
const toolsSource=composeUiSource('creative-tools');
const begin=toolsSource.indexOf('    const split = Layout.prototype.computeDynamicClockwiseSplit;');
const end=toolsSource.indexOf('    const side = Layout.prototype.layoutSideBranches;',begin);
assert.ok(begin>=0&&end>begin,'shared layout override not found');
const shared=toolsSource.slice(begin,end);

function createLayout(platform) {
  const source=file('apps/'+platform+'/editor/layout.js');
  const context={document:{createElement(){return {getContext(){return {
    font:'',measureText(value){return {width:String(value).length*9}}
  }}}}},NeuroMapCore:core,nm68ClampGap:v=>Math.max(30,Math.min(220,v||150))};
  vm.runInNewContext(source+'\nthis.Engine=OrganicLayoutEngine;',context);
  const Layout=context.Engine;
  new Function('Layout','root',shared)(Layout,{NeuroMapCore:core});
  const result=new Layout();
  result.branchStyle='xmind8';
  result.branchGapX=150;
  result.compactness=100;
  result.balanceBias=50;
  return result;
}
function fixture(mode,count=8,marker='geometry'){
  return {id:'root',side:'root',text:'Centro',layoutMode:mode,
    ...(marker?{layoutBalanceMode:marker}:{}),
    layoutDistribution:{enabled:false,height:960,overflowMode:'expand'},
    children:Array.from({length:count},(_,i)=>({
      id:'n'+i,parentId:'root',side:'right',text:'Ramo '+i,children:[],
    }))};
}
function run(platform,mode,marker='geometry'){
  const root=fixture(mode,8,marker),layout=createLayout(platform);
  const metrics=layout.computeLayout(root,50);
  return {root,layout,metrics,sides:root.children.map(n=>n.side[0]).join('')};
}

test('all six layout modes agree between desktop and Android on real runtime engines',()=>{
  for(const mode of ['clockwise','balanced','fluid','columns','right','left']){
    const desktop=run('desktop-shared',mode),android=run('android',mode);
    assert.equal(android.sides,desktop.sides,mode+' side divergence');
    assert.equal(android.metrics.totalPrimary,8,mode+' Android count');
    assert.equal(desktop.metrics.totalPrimary,8,mode+' desktop count');
    for(const node of android.root.children){
      const point=android.layout.getLayout(node.id);
      assert.ok(point&&Number.isFinite(point.x)&&Number.isFinite(point.y),
        mode+' missing Android coordinates');
    }
  }
});
test('geometric Balanced is not secretly Clockwise, but old unmarked maps remain unchanged',()=>{
  for(const platform of ['desktop-shared','android']){
    const balanced=run(platform,'balanced');
    const clockwise=run(platform,'clockwise');
    assert.equal(balanced.sides,'rlrlrlrl',platform);
    assert.equal(clockwise.sides,'rrrrllll',platform);
    const legacy=run(platform,'balanced',null);
    assert.equal(legacy.sides,clockwise.sides,
      'old imported balanced maps must not be silently migrated');
  }
});
test('Fluid is distinguishable and manual pins remain authoritative',()=>{
  for(const platform of ['desktop-shared','android']){
    assert.equal(run(platform,'fluid').sides,'rrllrlrl',platform);
    for(const mode of ['clockwise','balanced','fluid','columns','right','left']){
      const root=fixture(mode);
      root.children[0].sidePinned='left';
      root.children[1].sidePinned='right';
      const layout=createLayout(platform);
      const result=layout.computeLayout(root,50);
      assert.equal(root.children[0].side,'left',platform+' '+mode);
      assert.equal(root.children[1].side,'right',platform+' '+mode);
      assert.equal(new Set([...result.leftIds,...result.rightIds]).size,8);
    }
  }
});
test('Android and desktop layouts support 4000-deep imported trees without recursion failure',()=>{
  for(const platform of ['desktop-shared','android']){
    for(const mode of ['balanced','fluid']){
      const root=fixture(mode,1);
      let cursor=root.children[0];
      for(let i=0;i<4000;i++){
        const node={id:'deep'+i,parentId:cursor.id,side:'right',
          text:'Sottoramo '+i,children:[]};
        cursor.children=[node];cursor=node;
      }
      const layout=createLayout(platform);
      assert.doesNotThrow(()=>layout.computeLayout(root,50),platform+' '+mode);
      assert.equal(layout.nodeLayoutMap.size,4002);
      assert.ok(Number.isFinite(layout.getLayout('deep3999').x));
    }
  }
});
test('future Balanced defaults opt into geometry and keep adaptive continuation policy',()=>{
  const context={NeuroMapCreativeModules:{ui:{tr:a=>a,button(){},locale(){}}}};
  vm.runInNewContext(file('packages/editor-ui/creative-formatting.js').replace('/* @neuromap-creative-formatting-values */\n',file('packages/editor-ui/creative-formatting-values.js')),context);
  const formatter=context.NeuroMapCreativeModules.formatting;
  const saved=formatter.clean({layoutDistribution:{
    enabled:true,height:960,minimumHeight:480,overflowMode:'expand'
  }},['layoutDistribution']);
  assert.equal(saved.layoutDistribution.overflowMode,'expand');
  assert.equal(saved.layoutDistribution.anchorSides,undefined);
  const state={root:fixture('clockwise'),pushHistory(){}};
  formatter.write(state,{id:'layout',fields:['layoutMode'],kind:'map'},
    {layoutMode:'balanced'},false);
  assert.equal(state.root.layoutBalanceMode,'geometry');
  assert.equal(state.root.layoutDistribution.enabled,false);
});
test('mode controls explain their behavior and disable ineffective bias in automatic modes',()=>{
  const script=composeUiSource('creative-tools');
  assert.match(script,/const biasEnabled = mode === "clockwise" \|\| mode === "columns"/);
  assert.match(script,/el.disabled = !biasEnabled/);
  assert.match(script,/if \(!this\._nmLayoutPreviewQueued/);
  assert.match(script,/updateMiniPreview\(this\)/);
  const androidHTML=file('apps/android/native/app/src/main/assets/app/index.html');
  assert.doesNotMatch(androidHTML,/Soglia Verticale Y/);
  assert.match(androidHTML,/Distribuzione · sinistra ↔ destra/);
  assert.match(androidHTML,/aria-label="Distribuzione dei rami tra sinistra e destra"/);
  for(const mode of ['clockwise','balanced','fluid','columns','right','left'])
    assert.ok(script.includes(mode+': ['),'missing mode explanation '+mode);
});
