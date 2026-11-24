'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root={NeuroMapCreativeModules:{ui:{}},NeuroMapCore:require('../../map-core')};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../creative-formatting.js'),'utf8').replace('/* @neuromap-creative-formatting-values */\n',fs.readFileSync(path.join(__dirname,'../creative-formatting-values.js'),'utf8')),{globalThis:root});
const {clean,rootSpec,specs}=root.NeuroMapCreativeModules.formatting;
const {summarizeSettings:summary,nodeValues,stateValues,targetNodes}=new Function('root','clean','rootSpec',fs.readFileSync(path.join(__dirname,'../creative-settings-values.js'),'utf8')+';return {summarizeSettings,nodeValues,stateValues,targetNodes};')(root,clean,rootSpec);
const plain=v=>JSON.parse(JSON.stringify(v));
const original=(spec,states,nodes)=>{
 const samples=states.flatMap(s=>spec.kind==='node'?nodes(s).map(n=>nodeValues(n,spec)):[stateValues(s,spec)]);
 return{value:samples[0]||{},mixed:samples.some(v=>JSON.stringify(v)!==JSON.stringify(samples[0])),empty:!samples.length};
};
const state=()=>({root:{id:'root',text:'Root',children:[{id:'a',text:'A',children:[]},{id:'b',text:'B',children:[]}]},selectedNodeIds:['a','b'],branchStyle:'xmind8',typographyScale:1});
test('every reviewed setting matches the former summary for uniform and mixed documents',()=>{
 const a=state(),b=state(),c=state();b.root.children[1].fontSize=26;b.root.children[1].fontColor='#abcdef';c.root.layoutMode='clockwise';c.typographyScale=1.2;
 for(const spec of specs)for(const states of [[],[a],[b],[a,b],[c,a,b],[b,c,a]]){
  const nodes=s=>targetNodes(s,'map'),before=JSON.stringify(states);
  assert.deepEqual(plain(summary(spec,states,nodes)),plain(original(spec,states,nodes)),spec.id);
  assert.equal(JSON.stringify(states),before);
 }
});
test('empty selections stay empty, including before and after a populated tab',()=>{
 const spec={kind:'node',fields:['fontSize']},a=state(),b=state();
 for(const states of [[],[a],[a,b],[b,a]]){
  const nodes=s=>s===a?[]:[s.root];
  assert.deepEqual(plain(summary(spec,states,nodes)),plain(original(spec,states,nodes)));
 }
});
test('mixed detection keeps the first sanitized value and does not inspect later values',()=>{
 let reads=0;const nodes=Array.from({length:3000},(_,i)=>({get fontSize(){reads++;return i===1?26:20}})),spec={kind:'node',fields:['fontSize']};
 assert.deepEqual(plain(summary(spec,[{}],()=>nodes)),{value:{fontSize:20},mixed:true,empty:false});assert.equal(reads,2);
});
test('uniform settings inspect the final node and recognize a late difference',()=>{
 const a=state(),spec={kind:'node',fields:['fontWeight']},nodes=targetNodes(a,'map');
 assert.equal(summary(spec,[a],()=>nodes).mixed,false);nodes.at(-1).fontWeight=700;
 assert.deepEqual(plain(summary(spec,[a],()=>nodes)),{value:{fontWeight:400},mixed:true,empty:false});
});
test('later calls see edits, replacement roots, selections and tab ownership without invalidation',()=>{
 const a=state(),spec={kind:'node',fields:['fontSize']},nodes=s=>targetNodes(s,'selection');
 assert.equal(summary(spec,[a],nodes).mixed,false);a.root.children[1].fontSize=26;assert.equal(summary(spec,[a],nodes).mixed,true);
 a.selectedNodeIds=['b'];assert.deepEqual(plain(summary(spec,[a],nodes)),{value:{fontSize:26},mixed:false,empty:false});
 a.root={id:'other',children:[]};assert.equal(summary(spec,[a],nodes).empty,true);
});
test('sanitization and missing values keep exactly the same mixed semantics',()=>{
 const spec={kind:'node',fields:['fontSize','fontColor','fontItalic']};
 for(const nodes of [[{},{}],[{fontSize:1},{fontSize:100}],[{fontColor:'#ABCDEF'},{fontColor:'#abcdef'}],[{fontItalic:false},{}]])
  assert.deepEqual(plain(summary(spec,[{}],()=>nodes)),plain(original(spec,[{}],()=>nodes)));
});
