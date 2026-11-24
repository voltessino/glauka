'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../../../apps/desktop-shared/editor/document-view-core.js');
const leaf=(id,title=id,notes='')=>({id,text:title,notes,children:[]});
function state(root){
 const history=[];
 return {root,history,findNode(id){const stack=[this.root],seen=new Set();
  while(stack.length){const n=stack.pop();if(!n||seen.has(n))continue;seen.add(n);
   if(n.id===id)return n;for(const c of n.children||[])stack.push(c);
  }return null;
 },pushHistory(){history.push(JSON.stringify(this.root));}};
}
test('Document projection preserves logical IDs, parent hierarchy and verbatim text',()=>{
 const root=leaf('root','  A  ','a\r\nb\n😎');root.children=[leaf('one','## Title','```\ncode\n```')];
 const rows=D.project(root);
 assert.deepEqual(rows.map(r=>[r.id,r.parentId,r.depth]),[['root',null,0],['one','root',1]]);
 assert.equal(rows[0].title,'  A  ');assert.equal(rows[0].notes,'a\r\nb\n😎');
 assert.equal(root.children[0].notes,'```\ncode\n```');
});
test('Lossless JSONL text export round-trips Unicode, CRLF, blank lines and markdown',()=>{
 const root=leaf('root',' A \nB ','\r\n  trailing  \n\n');root.children=[leaf('a','😎','[[nm:r/a|test]]\n```')];
 const before=JSON.stringify(root),out=D.exportText(root),rows=D.parseText(out);
 assert.equal(rows[0].title,root.text);assert.equal(rows[0].notes,root.notes);
 assert.equal(rows[1].notes,root.children[0].notes);assert.equal(JSON.stringify(root),before);
});
test('Two edited chapters share one Undo snapshot and no shadow nodes',()=>{
 const root=leaf('root','Root','A');root.children=[leaf('a','A','N')];
 const s=state(root),before=JSON.stringify(root);
 const result=D.commit(s,[{id:'root',expectedTitle:'Root',expectedNotes:'A',title:'Root 2'},
  {id:'a',expectedTitle:'A',expectedNotes:'N',notes:'  new\n'}]);
 assert.deepEqual(result.updatedIds,['root','a']);assert.equal(s.history.length,1);
 assert.equal(s.history[0],before);assert.equal(root.text,'Root 2');
 assert.equal(root.children[0].notes,'  new\n');
});
test('No-op edits do not add Undo snapshots',()=>{
 const s=state(leaf('root','Root','N'));
 assert.equal(D.commit(s,[{id:'root',expectedTitle:'Root',expectedNotes:'N',title:'Root'}]).changed,false);
 assert.equal(s.history.length,0);
});
test('Stale second edit fails entire batch without partial writes',()=>{
 const root=leaf('root','Root','N');root.children=[leaf('a','A','N')];const s=state(root);
 assert.throws(()=>D.commit(s,[{id:'root',expectedTitle:'Root',expectedNotes:'N',title:'Wrong'},
  {id:'a',expectedTitle:'OLD',expectedNotes:'N',title:'Other'}]),/Stale/);
 assert.equal(root.text,'Root');assert.equal(s.history.length,0);
});
test('Invalid, duplicate and oversized edits are rejected before history',()=>{
 const s=state(leaf('root','Root','N'));
 assert.throws(()=>D.commit(s,[{id:'missing',expectedTitle:'x',expectedNotes:'',title:'x'}]));
 assert.throws(()=>D.commit(s,[{id:'root',expectedTitle:'Root',expectedNotes:'N',title:'x'},
  {id:'root',expectedTitle:'Root',expectedNotes:'N',title:'y'}]));
 assert.throws(()=>D.commit(s,[{id:'root',expectedTitle:'Root',expectedNotes:'N',notes:'x'.repeat(50001)}]));
 assert.throws(()=>D.commit(s,[{id:'root',expectedTitle:'Root',expectedNotes:'N',title:'   '}]));
 assert.equal(s.history.length,0);assert.equal(s.root.text,'Root');
});
test('Failed pushHistory leaves document unchanged',()=>{
 const s=state(leaf('root','Root','N'));s.pushHistory=()=>{throw Error('history full')};
 assert.throws(()=>D.commit(s,[{id:'root',expectedTitle:'Root',expectedNotes:'N',title:'New'}]),/history full/);
 assert.equal(s.root.text,'Root');
});
test('Deep tree is iterative; cycles and duplicate IDs fail closed',()=>{
 const root=leaf('r0'),start=root;let current=start;
 for(let i=1;i<10000;i++){const n=leaf('r'+i);current.children=[n];current=n;}
 assert.equal(D.project(start).length,10000);
 current.children=[start];assert.throws(()=>D.project(start),/Cyclic/);
 current.children=[];start.children[0].id='r0';assert.throws(()=>D.project(start),/duplicate/);
});
test('3,500-node Android-sized map round-trips text export',()=>{
 const root=leaf('r');for(let i=0;i<3499;i++)root.children.push(leaf('n'+i,'node '+i,'note '+i));
 const rows=D.parseText(D.exportText(root));assert.equal(rows.length,3500);
 assert.equal(rows[3499].notes,'note 3498');
});
test('100 changes commit in one atomic snapshot',()=>{
 const root=leaf('r');for(let i=0;i<100;i++)root.children.push(leaf('n'+i));
 const s=state(root),edits=root.children.map(n=>({id:n.id,expectedTitle:n.text,expectedNotes:'',title:n.text+'!'}));
 assert.equal(D.commit(s,edits).updatedIds.length,100);
 assert.equal(s.history.length,1);
 assert.throws(()=>D.commit(s,edits.concat(edits[0])),/Too many/);
});
test('Export refuses truncated, cyclic or malformed structures',()=>{
 const root=leaf('r');root.children=[leaf('a')];root.children[0].children=[root];
 assert.throws(()=>D.exportText(root),/Cyclic/);
 assert.throws(()=>D.parseText('NEUROMAP-DOCUMENT-1\n["r",null,0,"t","n"]'),/Incomplete/);
 assert.throws(()=>D.parseText('NEUROMAP-DOCUMENT-1\n["r",null,0,"t","n"]\n["r",null,0,"t","n"]\n'),/duplicate|Invalid/);
});
