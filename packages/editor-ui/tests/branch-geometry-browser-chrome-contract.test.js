'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const load=p=>fs.readFileSync(path.join(root,p),'utf8');

test('branch gallery offers eleven authentic path styles with compact dropdown',()=>{
 const html=load('apps/desktop-shared/src/resources/index.html');
 const gallery=html.slice(html.indexOf('id="nm54-style-grid"'),html.indexOf('id="nm63-stroke-range"'));
 const options=[...gallery.matchAll(/data-style="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(options,['neon','elbow','straight','arc','buzan','xmind8','thickparents','simple','dashed','wave','fork']);
 assert.doesNotMatch(gallery,/data-style="radial"/);
 assert.match(html,/id="nm54-branch-picker"/);
 for(const name of options)assert.match(gallery,new RegExp('data-style="'+name+'"'));
 const examples=[...gallery.matchAll(/<svg[^>]*class="nm54-preview"[^>]*>([\s\S]*?)<\/svg>/g)].map(m=>m[1]);
 assert.equal(examples.length,11);
 assert.equal(new Set(examples).size,11,'each button has its own mini map, not CSS thickness-only bars');
 const css=load('apps/desktop-shared/editor/editor.css');
 assert.match(css,/#nm54-style-grid \.nm54-preview/);
});
test('canvas and SVG exports implement the same connector geometries',()=>{
 const render=load('apps/desktop-shared/editor/renderer.js');
 const exportFile=load('apps/desktop-shared/editor/io.js');
 for(const s of [render,exportFile]){
  assert.match(s,/\['elbow','straight','arc'\]/);
  assert.match(s,/Math\.min\(13,Math\.abs\(g\.endX-g\.startX\)\*\.18,Math\.abs\(g\.endY-g\.startY\)\*\.46\)/);
  assert.match(s,/g\.startY\+bow\*1\.35/);
  assert.match(s,/Math\.max\(\.8,2\.6\*\(this\.(?:state|app\.state)\.strokeScale\|\|1\)\)/);
 }
 const media=load('apps/desktop-shared/editor/media.js');
 for(const name of ['elbow','straight','arc','dashed','wave','fork'])assert.match(media,new RegExp("'"+name+"'"));
 const core=load('packages/editor-ui/map-style-core.js');
 assert.match(core,/const BRANCHES=[^\n]*'elbow','straight','arc'/);
});
test('existing projects retain legacy styles and new projects default to curves',()=>{
 const media=load('apps/desktop-shared/editor/media.js');
 assert.match(media,/old\.hidden=availableStyles\.some/);
 assert.match(media,/branchStyle==='neon'|branchStyle\|\|'neon'/);
 assert.match(load('apps/desktop-shared/editor/state.js'),/this\.branchStyle = 'neon'/);
 const renderer=load('apps/desktop-shared/editor/renderer.js');
 assert.match(renderer,/if\(this\.state\.branchStyle==='radial'\)/);
 assert.match(renderer,/thickparents:/);
});
test('browser chrome uses existing control IDs and provides stable ordering',()=>{
 const chrome=load('packages/editor-ui/topbar-curation.js');
 const html=load('apps/desktop-shared/src/resources/index.html');
 assert.match(html,/id="tabs-list"/);
 assert.match(html,/id="btn-new-tab"/);
 for(const id of ['nm-home-open','nm-orbit-command-trigger','gl-history-quick','gl-cloud-quick','gl-settings-quick','glauka-save-indicator','nm6-plan-button'])
  assert.ok(chrome.includes("'"+id+"'"),id);
 assert.match(chrome,/utilities\.insertBefore\(current,next\)/);
 assert.match(chrome,/more\.open=false/);
 assert.match(chrome,/root\.MutationObserver/);
 assert.match(chrome,/gl-browser-chrome/);
 const css=load('apps/desktop-shared/editor/editor.css');
 assert.match(css,/body\.gl-browser-chrome #tabs-list/);
 assert.match(css,/body\.gl-browser-chrome \.gl-chrome-utilities/);
 assert.match(css,/--nm-skin-surface/);
});

test('renderer actually emits distinct commands for all three shapes on both sides',()=>{
 const render=load('apps/desktop-shared/editor/renderer.js');
 const start=render.indexOf('      drawTaperingBranch(parent');
 const end=render.indexOf('      drawBoundariesRecursive(node)',start);
 assert.ok(start>=0&&end>start);
 const Probe=new Function('return class Probe{'+render.slice(start,end)+'}')();
 for(const direction of [1,-1]){
  for(const style of ['straight','elbow','arc']){
   const operations=[];
   const ctx={
    globalAlpha:1,save(){},restore(){},
    createLinearGradient(){return {addColorStop(){}}},
    beginPath(){operations.push('begin')},
    moveTo(){operations.push('move')},
    lineTo(){operations.push('line')},
    quadraticCurveTo(){operations.push('quadratic')},
    stroke(){operations.push('stroke')},
    fill(){operations.push('fill')}
   };
   const renderer=new Probe();
   renderer.state={branchStyle:style,strokeScale:1};
   renderer.ctx=ctx;
   renderer.navOpacity=()=>1;
   renderer.computeBranchGeometry=()=>({
    startX:direction>0?15:120,startY:20,endX:direction>0?120:15,endY:55,
    underlineEndX:direction>0?150:-15,underlineEndY:55,dir:direction,startWidth:4,endWidth:2
   });
   renderer.drawTaperingBranch({side:'root',color:'#fff'},
    {id:'child',color:'#d34',children:[],collapsed:false},0,1);
   assert.ok(operations.includes('stroke'));
   assert.ok(!operations.includes('fill'),'new options must not fall back to filled-ribbon appearance');
   assert.equal(operations.filter(op=>op==='quadratic').length,
    style==='straight'?0:style==='elbow'?2:1,style+' on side '+direction);
  }
 }
});
