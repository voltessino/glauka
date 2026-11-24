'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const K=require('../../../apps/desktop-shared/editor/wiki-links-core.js');
function tabs(){
 const a={id:'map_a',text:'Anatomy',children:[
  {id:'heart',text:'Heart',notes:'See [[Liver]] and [[nm:map_b/kidney|Renal]]',children:[]},
  {id:'liver',text:'Liver',notes:'## Medicine\n[[nm:map_a/heart|Heart]]',children:[]}
 ]};
 const b={id:'map_b',text:'Biology',children:[
  {id:'kidney',text:'Kidney',notes:'',children:[]}]};
 return [{id:'tab-a',state:{root:a}},{id:'tab-b',state:{root:b}}];
}
test('wiki titles resolve only if unique; canonical IDs create backlinks across tabs',()=>{
 const x=K.index(tabs());
 assert.equal(x.forward('tab-a','heart').length,2);
 assert.deepEqual(x.forward('tab-a','heart').map(y=>y.status),['resolved','resolved']);
 assert.equal(x.backlinks('tab-b','kidney').length,1);
 assert.equal(x.backlinks('tab-a','heart')[0].source.nodeId,'liver');
 const t=tabs();t[1].state.root.children.push({id:'dup',text:'Liver',notes:'',children:[]});
 const ambiguous=K.index(t);
 assert.equal(ambiguous.forward('tab-a','heart')[0].status,'ambiguous');
 assert.equal(ambiguous.forward('tab-a','heart')[0].target,null);
});
test('stable IDs survive renaming; deleted nodes are explicitly missing',()=>{
 const t=tabs();
 t[1].state.root.children[0].text='Renamed kidney';
 assert.equal(K.index(t).forward('tab-a','heart')[1].target.title,'Renamed kidney');
 t[1].state.root.children=[];
 assert.equal(K.index(t).forward('tab-a','heart')[1].status,'missing');
});
test('duplicate map roots are ambiguous rather than choosing the wrong tab',()=>{
 const t=tabs();t.push({id:'duplicate-tab',state:{root:JSON.parse(JSON.stringify(t[1].state.root))}});
 const x=K.index(t);
 assert.equal(x.forward('tab-a','heart')[1].status,'ambiguous');
 assert.equal(x.backlinks('tab-b','kidney').length,0);
});
test('code fences and inline code do not create links',()=>{
 const tick=String.fromCharCode(96);
 const note='[[Heart]]\n'+tick.repeat(3)+'md\n[[Liver]]\n'+tick.repeat(3)+
  '\n'+tick+'[[Renal]]'+tick+'\n[[Kidney]]';
 const result=K.parse(note);
 assert.deepEqual(result.links.map(x=>x.label),['Heart','Kidney']);
});
test('explicit refs roundtrip unusual Unicode IDs and labels safely',()=>{
 const raw=K.format({rootId:'project:ν1',nodeId:'node 2/π',title:'μικρή | νότα'});
 const parsed=K.parseRef(raw.slice(2,-2));
 assert.equal(parsed.kind,'id');
 assert.equal(parsed.nodeId,'node 2/π');
 assert.equal(parsed.rootId,'project:ν1');
 assert.ok(!parsed.label.includes('|'));
});
test('import remapping affects only cloned canonical links, not external or code examples',()=>{
 const local=K.format({rootId:'original',nodeId:'a',title:'A'});
 const remote=K.format({rootId:'other',nodeId:'b',title:'B'});
 const tick=String.fromCharCode(96);
 const note=local+'\n'+remote+'\n'+tick.repeat(3)+'\n'+local+'\n'+tick.repeat(3)+
  '\n'+tick+local+tick;
 const result=K.remapInternal(note,'original','copy',new Map([['a','fresh-id']]));
 assert.ok(result.startsWith('[[nm:copy/fresh-id|A]]'));
 assert.ok(result.includes(remote));
 assert.ok(result.includes(tick.repeat(3)+'\n'+local+'\n'));
 assert.ok(result.includes(tick+local+tick));
 assert.equal(K.remapInternal(note,'bad','new',new Map([['a','x']])),note);
});
test('note editing creates one Undo snapshot, never truncates a legacy note',()=>{
 const node={id:'a',notes:'Before'},states=[],
  state={findNode:id=>id==='a'?node:null,pushHistory:()=>states.push(node.notes)};
 assert.equal(K.saveNote(state,'a','After'),true);
 assert.deepEqual(states,['Before']);
 assert.equal(K.saveNote(state,'a','After'),false);
 assert.deepEqual(states,['Before']);
 assert.throws(()=>K.saveNote(state,'a','x'.repeat(50001)),/50,000/);
 assert.equal(node.notes,'After');
});
test('unsafe links and raw HTML are text rather than executable content',()=>{
 assert.equal(K.safeURL('javascript:alert(1)'),'');
 assert.equal(K.safeURL('https://user:pass@example.com'),'');
 assert.equal(K.safeURL('file:///private/notes'),'');
 assert.equal(K.safeURL('https://example.org'),'https://example.org/');
 const tokens=K.inline('**Bold** <img src=x onerror=alert(1)> [bad](javascript:foo) [[Heart]]');
 assert.ok(tokens.some(t=>t.kind==='text'&&t.value.includes('<img')));
 assert.ok(!tokens.some(t=>t.kind==='url'&&t.url.startsWith('javascript:')));
 assert.ok(tokens.some(t=>t.kind==='wiki'));
});
test('bounded scanning never recurses infinitely or truncates underlying saved notes',()=>{
 const node={id:'r',text:'R',notes:'[[Heart]] '.repeat(100),children:[]};
 const result=K.parse(node.notes);
 assert.equal(result.links.length,64);assert.equal(result.overflow,true);
 const x=K.index([{id:'a',state:{root:node}}],{maxText:24});
 assert.equal(x.partial,true);
 assert.equal(node.notes.length,'[[Heart]] '.repeat(100).length);
});
test('40,000-node index survives deep and wide trees without copying originals',()=>{
 const root={id:'big-root',text:'Root',children:[]},nodes=[];
 for(let i=0;i<39999;i++)nodes.push({id:'n'+i,text:'Topic '+i,notes:i%199===0?'[[Topic 12]]':'',children:[]});
 root.children=nodes;const before=root.children[15].text;
 const x=K.index([{id:'tab',state:{root}}]);
 assert.equal(x.records.length,40000);
 assert.equal(x.backlinks('tab','n12').length,201);
 assert.equal(root.children[15].text,before);
 assert.equal(x.partial,false);
});
