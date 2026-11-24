'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const safe=require('../../../apps/desktop-shared/editor/stack-safe-json');
function deepTree(depth){
 const root={id:'root',text:'Topic',sourceRefs:[],children:[]};
 let parent=root;
 for(let i=0;i<depth;i++){
   const child={id:'node-'+i,text:'Leaf '+i,color:'#64748b',
     collapsed:false,sourceRefs:[],children:[]};
   parent.children=[child];parent=child;
 }
 return root;
}
test('ordinary documents preserve byte-identical native JSON output including spacing',()=>{
 const original={name:'Test & <text> 🧬',flag:false,number:2.5,empty:null,
  image:{src:'data:image/png;base64,abc'},array:[1,undefined,'a',null],
  date:new Date('2026-10-23T08:45:00Z'),nested:{a:{b:7}}};
 for(const indent of [undefined,0,2,4]){
  assert.equal(safe.stringify(original,indent),JSON.stringify(original,null,indent));
 }
});
test('20,000-level projects can serialize compactly and recover their topology',()=>{
 const original=deepTree(20000);
 const encoded=safe.stringify({schema:'NeuroMapArchitect-SingleTab-v6',
  root:original,images:[],relationships:[]},2);
 assert.ok(encoded.length>250000);
 const loaded=JSON.parse(encoded);
 assert.equal(loaded.schema,'NeuroMapArchitect-SingleTab-v6');
 let current=loaded.root,depth=0;
 while(current.children?.length){current=current.children[0];depth++;}
 assert.equal(depth,20000);
 assert.equal(current.id,'node-19999');
});
test('iterative fallback preserves objects, aliases, null and dates',()=>{
 const alias={id:'alias',text:'Á & "<>',sourceRefs:[{title:'citazione',page:22}]};
 const payload={schema:'batch',root:deepTree(11000),
  repeated:[alias,alias],dates:[new Date('2026-10-23T08:10:00Z')],
  misc:[NaN,Infinity,undefined,()=>{},Symbol('x')]};
 const copy=JSON.parse(safe.stringify(payload));
 assert.deepEqual(copy.repeated,[alias,alias]);
 assert.deepEqual(copy.misc,[null,null,null,null,null]);
 assert.equal(copy.dates[0],'2026-10-23T08:10:00.000Z');
});
test('cyclic objects and unsupported BigInt always fail rather than claim a save',()=>{
 const cycle={name:'root'};cycle.me=cycle;
 assert.throws(()=>safe.stringify(cycle),/circular/i);
 const tooDeep=deepTree(11000),leaf=tooDeep;
 let end=leaf;while(end.children?.length)end=end.children[0];
 end.children=[tooDeep];
 assert.throws(()=>safe.stringify(tooDeep),/circular/i);
 assert.throws(()=>safe.stringify({value:BigInt(5)}),TypeError);
});
test('fallback handles inherited toJSON and repeated non-cyclic references',()=>{
 const custom={toJSON(){return {saved:true,quote:'"✓"'}}};
 const big={root:deepTree(12000),records:[custom,custom]};
 const result=JSON.parse(safe.stringify(big));
 assert.deepEqual(result.records,[{saved:true,quote:'"✓"'},{saved:true,quote:'"✓"'}]);
});
test('save and autosave consume the shared safe serializer',()=>{
 const root=path.join(__dirname,'../../../apps/desktop-shared/editor');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'sources.json'),'utf8'));
 assert.ok(manifest.indexOf('stack-safe-json.js')>=0);
 for(const file of ['io.js','app.js','saving.js'])
  assert.ok(manifest.indexOf('stack-safe-json.js')<manifest.indexOf(file));
 const save=fs.readFileSync(path.join(root,'saving.js'),'utf8');
 const composeAppSource=require('./helpers/compose-app-source.cjs');
 const editor=composeAppSource('desktop-shared');
 const io=fs.readFileSync(path.join(root,'io.js'),'utf8');
 assert.match(save,/return NeuroMapSafeJSON\.stringify\(\[s\.root/);
 assert.match(save,/json:NeuroMapSafeJSON\.stringify\(payload\)/);
 assert.match(save,/const json=NeuroMapSafeJSON\.stringify\(payload,2\)/);
 assert.match(editor,/const json=NeuroMapSafeJSON\.stringify\(doc\)/);
 assert.equal((io.match(/NeuroMapSafeJSON\.stringify\(payload, 2\)/g)||[]).length,3);
});
test('fingerprint works with the live save module and a 13k-deep logical map',()=>{
 const file=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/saving.js'),'utf8').replace(/\r\n?/g,'\n');
 const start=file.indexOf('const NM614 = {'),end=file.indexOf('\n};\nNeuroMapApp.prototype',start);
 assert.ok(start>=0&&end>start);
 const save=new Function('NeuroMapSafeJSON','nm68ClampGap','nm64PreferredWrap',
  file.slice(start,end+3)+'\nreturn NM614;')(safe,n=>n,()=>18);
 const tab={id:'tab',state:{root:deepTree(13000),images:[],relationships:[],
    balanceBias:50,compactness:100,branchGapX:150,strokeScale:1,branchStyle:'neon'}};
 const app={getStudyCardsForTab:()=>[]};
 const before=save.fingerprint(app,tab);
 assert.ok(before.includes('node-12999'));
 tab.state.root.text='changed';
 assert.notEqual(save.fingerprint(app,tab),before);
});

test('iterative serializer matches native JSON on 500 randomized nested values',()=>{
 let seed=261023;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const reused={x:3,q:'🍀'};
 const atoms=[null,false,true,0,-0,NaN,Infinity,-Infinity,'"<>&\\n','é:🧬',
  undefined,3.14,reused,new Date('2026-10-23T00:00:00Z')];
 const build=depth=>{
  if(depth>6||random()<.36)return atoms[Math.floor(random()*atoms.length)];
  if(random()<.49){
   const out=[],count=Math.floor(random()*6);
   for(let i=0;i<count;i++)out.push(build(depth+1));
   return out;
  }
  const out={},count=Math.floor(random()*6);
  for(let i=0;i<count;i++)out['key'+i]=build(depth+1);
  return out;
 };
 for(let i=0;i<500;i++){
  const value=build(0);
  assert.equal(safe.stringifyIterative(value),JSON.stringify(value));
 }
});
