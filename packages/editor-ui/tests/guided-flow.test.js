const {test}=require('node:test');
const assert=require('node:assert/strict');
const guided=require('../guided-flow');

const sample=()=>({id:'root',text:'Plan',children:[
 {id:'one',text:'Collect',children:[{id:'a',text:'A',children:[]},{id:'b',text:'B',children:[]}]},
 {id:'two',text:'Review',children:[]},
 {id:'three',text:'Publish',children:[]}
]});
test('guide offers direct siblings but never writes transitions automatically',()=>{
 const tree=sample(),links=[],original=JSON.stringify([tree,links]);
 const inventory=guided.inventory(tree),view=guided.preview(tree,'root',links);
 assert.deepEqual(inventory.groups.map(g=>g.id),['root','one']);
 assert.deepEqual(view.pairs.map(p=>[p.fromId,p.toId]),[['one','two'],['two','three']]);
 assert.equal(view.requiresConfirmation,true);
 assert.equal(view.candidateCount,2);
 assert.equal(JSON.stringify([tree,links]),original);
});
test('existing explicit sequences are not re-suggested',()=>{
 const tree=sample(),refs=[{id:'old',kind:'sequence',fromId:'one',toId:'two'}];
 const view=guided.preview(tree,'root',refs);
 assert.deepEqual(view.pairs.map(x=>x.toId),['three']);
 assert.equal(view.skipped[0].reason,'existing');
});
test('would-be cyclic proposals are omitted and original relations untouched',()=>{
 const tree=sample(),refs=[{id:'r1',kind:'yes',fromId:'three',toId:'one'}];
 const source=JSON.stringify(refs);
 const view=guided.preview(tree,'root',refs);
 assert.equal(view.pairs.length,1);
 assert.equal(view.pairs[0].fromId,'one');
 assert.equal(view.skipped.some(s=>s.reason==='cycle'),true);
 assert.equal(JSON.stringify(refs),source);
});
test('traversal rejects bad trees and protects against oversize sibling groups',()=>{
 const duplicate={id:'root',children:[{id:'root',children:[]}]};
 assert.throws(()=>guided.inventory(duplicate),/Invalid source graph/);
 const cycle={id:'cyclic',children:[]};cycle.children.push(cycle);
 assert.throws(()=>guided.inventory(cycle),/Invalid source graph/);
 const many={id:'root',text:'R',children:Array.from({length:120},(_,i)=>({id:'n'+i,text:String(i),children:[]}))};
 const out=guided.preview(many,'root',[],{maxPairs:5});
 assert.equal(out.pairs.length,5);
 assert.equal(out.skipped.filter(s=>s.reason==='limit').length,114);
 assert.throws(()=>guided.preview(many,'missing',[]),/Unknown/);
});
test('labels are treated as raw text rather than markup and optional refs do not imply order',()=>{
 const tree=sample();
 tree.children[0].text='<img src=x onerror=alert(1)>';
 const out=guided.preview(tree,'root',[{id:'generic',fromId:'one',toId:'two'}]);
 assert.equal(out.pairs.length,2);
 assert.equal(out.pairs[0].fromText,tree.children[0].text);
});
