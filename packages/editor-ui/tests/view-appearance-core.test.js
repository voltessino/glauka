'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const appearance=require('../view-appearance-core');
const hierarchy=require('../view-core');
const work=require('../work-core');

test('every linked view has four safe, distinct starter themes',()=>{
 for(const mode of appearance.MODES){
  const palettes=appearance.PRESETS.map(preset=>appearance.palette(mode,preset));
  assert.equal(palettes.length,4);
  assert.equal(new Set(palettes.map(p=>p.background)).size,4);
  assert.ok(palettes.every(p=>/^#[0-9a-f]{6}$/i.test(p.text)));
 }
});

test('appearance metadata is bounded and cannot pollute prototypes',()=>{
 const source=JSON.parse('{"modes":{"orgchart":{"preset":"paper","background":"url(https://bad)","radius":999,"elements":{"__proto__":{"accent":"#ff0000"},"valid:1":{"accent":"#aBcDeF"},"a":{"text":"javascript:alert(1)"}}},"__proto__":{"preset":"paper"}}}');
 const result=appearance.clean(source);
 assert.equal(result.modes.orgchart.background,undefined);
 assert.equal(result.modes.orgchart.radius,24);
 assert.equal(result.modes.orgchart.elements['valid:1'].accent,'#abcdef');
 assert.equal(result.modes.orgchart.elements.a,undefined);
 assert.equal({}.accent,undefined);
 assert.equal(Object.prototype.hasOwnProperty.call(result.modes,'__proto__'),false);
 assert.throws(()=>appearance.update(result,'orgchart',{accent:'#ffffff'},'__proto__'));
});

test('changes to one view never affect another view or source node attributes',()=>{
 const source={id:'root',text:'Anatomy',color:'#123456',children:[{id:'brain',text:'Brain',color:'#ff0000',children:[]}]};
 const before=JSON.stringify(source);
 let meta=appearance.update(null,'kanban',{preset:'paper',accent:'#f87171',density:1.08});
 meta=appearance.update(meta,'kanban',{surface:'#ffffff'},'brain');
 const other=appearance.resolve(meta,'orgchart','brain');
 const kanban=appearance.resolve(meta,'kanban','brain');
 assert.equal(kanban.surface,'#ffffff');
 assert.equal(kanban.accent,'#f87171');
 assert.notEqual(other.background,kanban.background);
 assert.equal(JSON.stringify(source),before);
 assert.equal(JSON.parse(JSON.stringify(meta)).modes.kanban.elements.brain.surface,'#ffffff');
});

test('clearing a node override does not discard the view palette',()=>{
 let raw=appearance.update(null,'timeline',{preset:'aurora',edge:'#112233'});
 raw=appearance.update(raw,'timeline',{accent:'#445566'},'task-1');
 raw=appearance.update(raw,'timeline',{accent:null},'task-1');
 assert.equal(raw.modes.timeline.preset,'aurora');
 assert.equal(raw.modes.timeline.edge,'#112233');
 assert.equal(raw.modes.timeline.elements,undefined);
});

test('density works on fresh projections without mutating canonical nodes',()=>{
 const source={id:'root',text:'Project',children:[{id:'task-1',text:'Draft',taskStatus:'todo',children:[]},
  {id:'task-2',text:'Review',taskStatus:'todo',children:[]}]};
 const before=JSON.stringify(source);
 const chart=hierarchy.project(source,'orgchart');
 const original=chart.nodes[1].y;
 appearance.applyDensity(chart,appearance.resolve(
  appearance.update(null,'orgchart',{density:1.4}),'orgchart'));
 assert.ok(chart.nodes[1].y>original);
 const board=work.project(source,'kanban');
 const first=board.nodes[0].y,second=board.nodes[1].y;
 appearance.applyDensity(board,{density:.85});
 assert.ok(board.nodes[1].y-board.nodes[0].y<second-first);
 assert.equal(JSON.stringify(source),before);
});

test('Cluster and Signal are valid only for concept networks and survive safe metadata cleanups',()=>{
 assert.deepEqual(appearance.presetsFor('concept-network'),['studio','aurora','paper','graphite','cluster','signal']);
 assert.deepEqual(appearance.presetsFor('kanban'),['studio','aurora','paper','graphite',
  'task-board','studio-sprint','soft-saas','executive-board']);
 let metadata=appearance.update(null,'concept-network',{preset:'cluster'});
 assert.equal(appearance.resolve(metadata,'concept-network').background,'#edf6f5');
 metadata=appearance.update(metadata,'concept-network',{preset:'signal'});
 assert.equal(appearance.resolve(metadata,'concept-network').accent,'#30e3cc');
 assert.equal(appearance.clean(JSON.parse(JSON.stringify(metadata))).modes['concept-network'].preset,'signal');
 metadata=appearance.update(metadata,'kanban',{preset:'signal'});
 assert.equal(metadata.modes.kanban.preset,'studio');
 assert.equal(appearance.clean({modes:{kanban:{preset:'cluster'}}}).modes.kanban.preset,'studio');
});

test('tree-specific academic, taxonomy and study palettes are isolated from other views',()=>{
 assert.deepEqual(appearance.presetsFor('concept-tree'),[
  'studio','aurora','paper','graphite','academic','taxonomy','study','aurora-tree','minimal-taxonomy']);
 const expected={academic:'#f8fafc',taxonomy:'#0f2928',study:'#f6f0ff',
   'aurora-tree':'#11192d','minimal-taxonomy':'#f7faf8'};
 let raw=null;
 for(const preset of Object.keys(expected)){
  raw=appearance.update(raw,'concept-tree',{preset});
  assert.equal(appearance.resolve(raw,'concept-tree').background,expected[preset]);
 }
 assert.equal(appearance.clean(JSON.parse(JSON.stringify(raw))).modes['concept-tree'].preset,'minimal-taxonomy');
 raw=appearance.update(raw,'orgchart',{preset:'study'});
 assert.equal(raw.modes.orgchart.preset,'studio');
});

test('reset removes only the requested appearance scope and rejects invalid IDs',()=>{
 let meta=appearance.update(null,'concept-tree',{preset:'academic'});
 meta=appearance.update(meta,'concept-tree',{accent:'#ab12cd'},'topic');
 meta=appearance.update(meta,'concept-tree',{accent:'#12abcd'},'other');
 meta=appearance.update(meta,'kanban',{preset:'paper'});
 const original=JSON.stringify(meta);
 const one=appearance.reset(meta,'concept-tree','topic');
 assert.equal(one.modes['concept-tree'].preset,'academic');
 assert.equal(one.modes['concept-tree'].elements.topic,undefined);
 assert.equal(one.modes['concept-tree'].elements.other.accent,'#12abcd');
 assert.equal(one.modes.kanban.preset,'paper');
 const all=appearance.reset(one,'concept-tree');
 assert.equal(all.modes['concept-tree'],undefined);
 assert.equal(all.modes.kanban.preset,'paper');
 assert.equal(JSON.stringify(meta),original);
 assert.throws(()=>appearance.reset(meta,'concept-tree','__proto__'));
 assert.throws(()=>appearance.reset(meta,'invalid-view'));
});

test('process, blueprint, pastel flow and dark logic only apply to flowcharts',()=>{
 assert.deepEqual(appearance.presetsFor('flowchart'),[
  'studio','aurora','paper','graphite','process','blueprint','pastel-flow','dark-logic']);
 const backgrounds={process:'#f4f7fb',blueprint:'#0a2542','pastel-flow':'#fdf7ff','dark-logic':'#0c101d'};
 let raw=null;
 for(const preset of Object.keys(backgrounds)){
  raw=appearance.update(raw,'flowchart',{preset});
  assert.equal(appearance.resolve(raw,'flowchart').background,backgrounds[preset]);
 }
 assert.equal(appearance.clean(JSON.parse(JSON.stringify(raw))).modes.flowchart.preset,'dark-logic');
 const other=appearance.update(raw,'kanban',{preset:'blueprint'});
 assert.equal(other.modes.kanban.preset,'studio');
 assert.equal(other.modes.flowchart.preset,'dark-logic');
});

test('organization palettes and orientation survive JSON while remaining isolated from all other views',()=>{
 const presets=['studio','aurora','paper','graphite','corporate','people','department','executive'];
 assert.deepEqual(appearance.presetsFor('orgchart'),presets);
 let meta=appearance.update(null,'orgchart',{preset:'executive',orientation:'horizontal'});
 assert.equal(appearance.resolve(meta,'orgchart').orientation,'horizontal');
 assert.equal(appearance.resolve(meta,'orgchart').background,'#111827');
 meta=appearance.update(meta,'concept-tree',{orientation:'horizontal',preset:'academic'});
 assert.equal(appearance.resolve(meta,'concept-tree').orientation,undefined);
 assert.equal(appearance.clean(meta).modes['concept-tree'].orientation,undefined);
 assert.equal(appearance.resolve(meta,'concept-tree').preset,'academic');
 assert.equal(appearance.clean(JSON.parse(JSON.stringify(meta))).modes.orgchart.orientation,'horizontal');
 const original=JSON.stringify(meta),restored=appearance.reset(meta,'orgchart');
 assert.equal(restored.modes.orgchart,undefined);
 assert.equal(restored.modes['concept-tree'].preset,'academic');
 assert.equal(JSON.stringify(meta),original);
});

test('Kanban has four view-specific board themes without leaking them to other modes',()=>{
 const names=['studio','aurora','paper','graphite','task-board','studio-sprint','soft-saas','executive-board'];
 assert.deepEqual(appearance.presetsFor('kanban'),names);
 const backgrounds={'task-board':'#f3f7fc','studio-sprint':'#131d31','soft-saas':'#fcf8ff','executive-board':'#101820'};
 let meta=null;
 for(const [preset,expected]of Object.entries(backgrounds)){
  meta=appearance.update(meta,'kanban',{preset});
  assert.equal(appearance.resolve(meta,'kanban').background,expected);
 }
 const original=JSON.stringify(meta);
 meta=appearance.update(meta,'orgchart',{preset:'task-board'});
 assert.equal(meta.modes.orgchart.preset,'studio');
 assert.equal(meta.modes.kanban.preset,'executive-board');
 assert.equal(appearance.clean(JSON.parse(JSON.stringify(meta))).modes.kanban.preset,'executive-board');
 assert.equal(original.includes('executive-board'),true);
});

test('Timeline presets for roadmap, history, project and milestones are strictly view-specific',()=>{
 assert.deepEqual(appearance.presetsFor('timeline'),[
  'studio','aurora','paper','graphite','roadmap','history','project-plan','milestone']);
 const expected={roadmap:'#f3f8fc',history:'#fcf7eb','project-plan':'#16243a',milestone:'#f8f5ff'};
 let current=null;
 for(const [preset,bg]of Object.entries(expected)){
  current=appearance.update(current,'timeline',{preset});
  assert.equal(appearance.resolve(current,'timeline').background,bg);
 }
 assert.equal(appearance.clean(JSON.parse(JSON.stringify(current))).modes.timeline.preset,'milestone');
 const another=appearance.update(current,'orgchart',{preset:'history'});
 assert.equal(another.modes.orgchart.preset,'studio');
 assert.equal(another.modes.timeline.preset,'milestone');
});

test('all 47 built-in palettes have accessible text contrast and clearly visible accents on surfaces',()=>{
 const luminance=color=>{
  const rgb=[1,3,5].map(i=>Number.parseInt(color.slice(i,i+2),16)/255)
   .map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
 };
 const contrast=(a,b)=>{
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
 };
 let checked=0;
 for(const mode of appearance.MODES)for(const preset of appearance.presetsFor(mode)){
  const theme=appearance.palette(mode,preset);
  checked++;
  assert.ok(contrast(theme.text,theme.surface)>=4.5,
   mode+'/'+preset+' text card contrast should pass WCAG AA normal text');
  assert.ok(contrast(theme.text,theme.background)>=4.5,
   mode+'/'+preset+' text canvas contrast should pass WCAG AA normal text');
  assert.ok(contrast(theme.accent,theme.surface)>=3,
   mode+'/'+preset+' primary marker must have 3:1 contrast on cards');
 }
 assert.equal(checked,47);
});

test('Timeline calendar scale is persisted, resettable and never leaks into other views',()=>{
 assert.deepEqual(appearance.TIME_SCALES,['auto','days','weeks','months']);
 const current=appearance.update(null,'timeline',{preset:'roadmap',timeScale:'weeks'});
 const saved=appearance.clean(JSON.parse(JSON.stringify(current)));
 assert.equal(saved.modes.timeline.timeScale,'weeks');
 assert.equal(appearance.resolve(saved,'timeline').timeScale,'weeks');
 const other=appearance.update(saved,'kanban',{timeScale:'days'});
 assert.equal(other.modes.kanban.timeScale,undefined);
 assert.equal(appearance.resolve(other,'kanban').timeScale,undefined);
 const invalid=appearance.update(other,'timeline',{timeScale:'millennia'});
 assert.equal(invalid.modes.timeline.timeScale,'weeks');
 const changed=appearance.update(other,'timeline',{timeScale:'months'});
 assert.equal(appearance.resolve(changed,'timeline').timeScale,'months');
 assert.equal(appearance.resolve(appearance.reset(changed,'timeline'),'timeline').timeScale,'auto');
 assert.equal(JSON.stringify(current),JSON.stringify(appearance.clean(current)));
});

test('per-property reset changes only the requested view override and keeps others',()=>{
 let meta=appearance.update(null,'orgchart',{preset:'corporate',background:'#abcdef',density:1.4,orientation:'horizontal'});
 meta=appearance.update(meta,'orgchart',{accent:'#112233',surface:'#eeeeee'},'node-1');
 meta=appearance.update(meta,'orgchart',{accent:'#334455'},'node-2');
 meta=appearance.update(meta,'timeline',{preset:'history',timeScale:'weeks'});
 const before=JSON.stringify(meta);
 let next=appearance.resetProperty(meta,'orgchart','background');
 assert.equal(next.modes.orgchart.background,undefined);
 assert.equal(next.modes.orgchart.orientation,'horizontal');
 assert.equal(next.modes.orgchart.density,1.4);
 assert.equal(next.modes.orgchart.elements['node-1'].surface,'#eeeeee');
 assert.deepEqual(next.modes.timeline,meta.modes.timeline);
 next=appearance.resetProperty(next,'orgchart','accent','node-1');
 assert.equal(next.modes.orgchart.elements['node-1'].accent,undefined);
 assert.equal(next.modes.orgchart.elements['node-1'].surface,'#eeeeee');
 assert.equal(next.modes.orgchart.elements['node-2'].accent,'#334455');
 next=appearance.resetProperty(next,'orgchart','surface','node-1');
 assert.equal(next.modes.orgchart.elements['node-1'],undefined);
 next=appearance.resetProperty(next,'orgchart','preset');
 assert.equal(next.modes.orgchart.preset,'studio');
 assert.equal(JSON.stringify(meta),before);
 assert.throws(()=>appearance.resetProperty(meta,'orgchart','timeScale'));
 assert.throws(()=>appearance.resetProperty(meta,'orgchart','background','node-1'));
 assert.throws(()=>appearance.resetProperty(meta,'orgchart','accent','__proto__'));
 assert.deepEqual(appearance.resetProperty(null,'kanban','accent'),{version:1,modes:{}});
});

test('single-property reset of the final element style removes empty metadata',()=>{
 let meta=appearance.update(null,'kanban',{accent:'#cafefe'},'task:1');
 meta=appearance.resetProperty(meta,'kanban','accent','task:1');
 assert.deepEqual(meta,{version:1,modes:{}});
});


test('Aurora Tree and Minimal Taxonomy preserve canonical nodes and stay isolated',()=>{
 const bright=appearance.palette('concept-tree','minimal-taxonomy');
 const dark=appearance.palette('concept-tree','aurora-tree');
 const common=appearance.palette('concept-tree','aurora');
 assert.notEqual(bright.background,dark.background);
 assert.notEqual(dark.background,common.background);
 assert.notEqual(bright.surface,dark.surface);
 for(const p of [bright,dark]){
   for(const key of ['background','grid','surface','edge','text','accent'])
     assert.match(p[key],/^#[0-9a-f]{6}$/i,key);
   assert.ok(p.radius>=4&&p.radius<=24);
   assert.ok(p.fontSize>=10&&p.fontSize<=18);
   assert.ok(p.density>=.85&&p.density<=1.4);
 }
 const root={id:'root',text:'Tree',children:[{id:'node',text:'Leaf',children:[]}]};
 const original=JSON.stringify(root);
 const a=appearance.update(null,'concept-tree',{preset:'aurora-tree'});
 const roundtrip=JSON.parse(JSON.stringify(a));
 assert.equal(appearance.resolve(roundtrip,'concept-tree').preset,'aurora-tree');
 assert.equal(appearance.resolve(roundtrip,'orgchart').preset,'studio');
 const b=appearance.update(roundtrip,'concept-tree',{preset:'minimal-taxonomy'});
 assert.equal(appearance.resolve(b,'concept-tree').background,bright.background);
 assert.equal(appearance.resolve(a,'concept-tree').background,dark.background);
 assert.equal(JSON.stringify(root),original);
});


test('semantic colors and grid are one immutable shared token contract for all linked views',()=>{
 assert.equal(appearance.CANVAS_GRID_SIZE,28);
 assert.equal(appearance.GROUP_COLORS.length,6);
 assert.ok(Object.isFrozen(appearance.GROUP_COLORS));
 assert.ok(Object.isFrozen(appearance.KANBAN_STATUS_COLORS));
 for(let index=0;index<36;index++){
  assert.equal(appearance.groupColor(index),appearance.GROUP_COLORS[index%6]);
  assert.match(appearance.groupColor(index),/^#[0-9a-f]{6}$/);
 }
 for(const bad of [-1,NaN,1.5,Infinity,'0',null,{}])
  assert.equal(appearance.groupColor(bad),appearance.GROUP_COLORS[0]);
 for(const status of ['unassigned','todo','doing','done'])
  assert.equal(appearance.kanbanStatusColor(status),appearance.KANBAN_STATUS_COLORS[status]);
 for(const unsafe of ['constructor','toString','__proto__',null,{},'unknown'])
  assert.equal(appearance.kanbanStatusColor(unsafe),appearance.KANBAN_STATUS_COLORS.unassigned);
 const light=appearance.palette('flowchart','paper');
 const dark=appearance.palette('flowchart','graphite');
 assert.equal(appearance.lightViewCanvas(light),true);
 assert.equal(appearance.lightViewCanvas(dark),false);
 assert.equal(appearance.semanticFlowColor('yes',light),'#157354');
 assert.equal(appearance.semanticFlowColor('no',light),'#b33058');
 assert.equal(appearance.semanticFlowColor('yes',dark),'#34d399');
 assert.equal(appearance.semanticFlowColor('no',dark),'#fb7185');
 assert.equal(appearance.semanticFlowColor('sequence',light),light.edge);
 assert.equal(appearance.semanticFlowColor('bad',{}),'#8295b7');
 const userMap={id:'root',text:'Unchanged',color:'#aa00cc',children:[]};
 const original=JSON.stringify(userMap);
 const palette=appearance.resolve(null,'concept-tree');
 assert.equal(appearance.groupColor(0),appearance.GROUP_COLORS[0]);
 assert.equal(palette.background,appearance.palette('concept-tree','studio').background);
 assert.equal(JSON.stringify(userMap),original);
});


test('concept-tree typography derives depth without touching saved colors or map attributes',()=>{
 const hierarchy=[
  {depth:0,size:14,weight:750},{depth:1,size:13,weight:700},
  {depth:2,size:12,weight:600},{depth:3,size:11,weight:500},
  {depth:8,size:11,weight:500}
 ];
 for(const expected of hierarchy){
  const actual=appearance.treeTypography(expected.depth,12);
  assert.equal(actual.fontSize,expected.size);
  assert.equal(actual.fontWeight,expected.weight);
  assert.ok(Object.isFrozen(actual));
 }
 for(const setting of [10,12,15,18]){
  const sizes=[0,1,2,3].map(depth=>appearance.treeTypography(depth,setting).fontSize);
  assert.ok(sizes.every(value=>value>=10&&value<=18));
  assert.ok(sizes.every((value,i)=>!i||value<=sizes[i-1]));
 }
 assert.deepEqual(appearance.treeTypography(-1,undefined),appearance.treeTypography(0,12));
 assert.equal(appearance.treeTypography(2,Infinity).fontSize,12);
 const root={id:'root',text:'Root',children:[{id:'group',text:'Group',children:[]}]};
 const canonical=JSON.stringify(root);
 const meta=appearance.update(null,'concept-tree',{preset:'aurora-tree',fontSize:16});
 assert.equal(appearance.treeTypography(0,appearance.resolve(meta,'concept-tree').fontSize).fontSize,18);
 assert.equal(appearance.clean(meta).modes['concept-tree'].fontSize,16);
 assert.equal(JSON.stringify(root),canonical);
});


test('tree depth badges stay readable beyond 99 while full depth remains available',()=>{
 for(const [value,expected] of [[0,'0'],[1,'1'],[9,'9'],[10,'10'],[99,'99'],[100,'99+'],[1500,'99+']])
  assert.equal(appearance.treeDepthBadge(value),expected);
 for(const invalid of [NaN,Infinity,-2,1.5,'100',null,{}])
  assert.equal(appearance.treeDepthBadge(invalid),'0');
});
