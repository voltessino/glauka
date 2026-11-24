'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const A=require('../../../apps/desktop-shared/editor/atlas-library-core.js');
const K=require('../../../apps/desktop-shared/editor/knowledge-core.js');
function tab(id,path,text='Heart',sheet=0,dirty=false){
 const root={id:'root-'+id,text:'Atlas '+id,children:[
  {id:'node-heart',text,notes:'Cardiac physiology',children:[
   {id:'node-pressure',text:'Pressure',notes:'notes '+id,collapsed:true,children:[]}]}]};
 return {id,title:'Atlas '+id,filePath:path,originSheetIndex:sheet,state:{root,isDirty:dirty}};
}
test('persistent path key survives window restart, stable sheet IDs, case-insensitive Windows path',()=>{
 assert.equal(A.keyFor(tab('one','C:\\Med\\HEART.neuromap')),
              A.keyFor(tab('two','c:/med/heart.neuromap')));
 assert.notEqual(A.keyFor(tab('one','/Users/a/Map.neuromap')),
                 A.keyFor(tab('two','/Users/a/map.neuromap')));
 assert.notEqual(A.keyFor(tab('one','C:\\Study\\multi.xmind','One',0)),
                 A.keyFor(tab('two','C:\\Study\\multi.xmind','Two',1)));
 assert.equal(A.keyFor(tab('one','../unsafe.neuromap')),'');
});
test('closed documents remain searchable, original IDs remain addressable with stable doc identity',()=>{
 const saved=tab('original','C:\\Study\\Anatomy.neuromap');
 let archive=A.update([], [saved],K);
 assert.equal(archive.length,1);
 const snapshot=JSON.stringify(archive);
 const reopened=A.clean(JSON.parse(snapshot));
 const index=A.project(K,[],reopened);
 const found=K.search(index,'cardiac',10);
 assert.equal(found.length,1);
 assert.equal(found[0].archived,true);
 assert.equal(found[0].tabId,A.keyFor(saved));
 assert.equal(found[0].nodeId,'node-heart');
 assert.equal(index.archivedDocuments,1);
 const newSessionTab=tab('next-session','C:\\Study\\Anatomy.neuromap');
 const live=A.project(K,[newSessionTab],reopened);
 assert.equal(live.archivedDocuments,0);
 assert.ok(live.perTab.get(A.keyFor(saved)).has('node-heart'));
 assert.equal(live.records.length,3,'not duplicated in the live view');
});
test('existing Atlas backlinks are migrated to stable paths even after original tab closes',()=>{
 const left=tab('old-left','C:\\Study\\Anatomy.neuromap'),right=tab('old-right','C:\\Study\\Physiology.neuromap');
 const archive=A.update([], [left,right],K);
 const link=[{fromTab:'old-left',fromNode:'node-heart',
  toTab:'old-right',toNode:'node-pressure',label:'Evidence'}];
 const afterRestart=A.project(K,[],archive);
 const normalized=A.normalizeEdges(K,link,afterRestart);
 assert.equal(normalized.length,1);
 assert.equal(normalized[0].fromTab,A.keyFor(left));
 assert.equal(normalized[0].toTab,A.keyFor(right));
 const backlinks=K.backlinks(afterRestart,normalized,A.keyFor(right),'node-pressure');
 assert.equal(backlinks.length,1);
 const reopened=A.project(K,[tab('another-id',left.filePath)],archive);
 assert.equal(A.normalizeEdges(K,link,reopened).length,1);
});
test('unsaved modifications never silently replace the last indexed on-disk snapshot',()=>{
 const t=tab('A','C:\\Test\\Project.neuromap','Original');
 const old=A.update([], [t],K);
 t.state.root.children[0].text='UNSAVED';t.state.isDirty=true;
 const now=A.update(old,[t],K);
 assert.equal(now[0].nodes.find(n=>n.id==='node-heart').text,'Original');
 assert.equal(old[0].updatedAt,now[0].updatedAt);
 const initialNative=A.capture(t,K,true);
 assert.equal(initialNative.nodes.find(n=>n.id==='node-heart').text,'UNSAVED');
});
test('old maps and unrelated images remain untouched during archive indexing',()=>{
 const source=tab('a','C:\\Test\\a.neuromap','Concept');
 source.state.images=[{id:'photo',src:'data:image/png;base64,AAAA'}];
 const before=JSON.stringify(source);
 const archive=A.update([], [source],K);
 assert.equal(JSON.stringify(source),before);
 assert.equal(JSON.stringify(archive).includes('data:image'),false);
 assert.equal(JSON.stringify(archive).includes('src'),false);
});
test('1000 personas: archive 60 capped documents, stable IDs and no duplicate reopening',()=>{
 const tabs=Array.from({length:1000},(_,i)=>tab('t'+i,'C:\\Books\\P'+i+'.neuromap','Concept '+i));
 let collection=[];
 let count=0;
 for(let i=0;i<1000;i+=25){
  collection=A.update(collection,tabs.slice(i,i+25),K);
  assert.ok(collection.length<=A.MAX_DOCUMENTS);count++;
 }
 assert.equal(count,40);
 assert.equal(collection.length,A.MAX_DOCUMENTS);
 const project=A.project(K,[],collection);
 assert.ok(project.records.length<=A.MAX_INDEX_NODES);
 assert.equal(project.archivedDocuments,A.MAX_DOCUMENTS);
 assert.equal(new Set(project.records.map(x=>JSON.stringify([x.tabId,x.nodeId]))).size,
              project.records.length);
 const open=tabs.at(-1);
 const refreshed=A.project(K,[tab('different-id',open.filePath,'Concept 999')],collection);
 assert.equal(refreshed.records.length,project.records.length);
});
test('70 oversized documents and malformed archives are bounded and never create unsafe paths',()=>{
 const t=tab('wide','C:\\Test\\Oversized.neuromap');
 t.state.root.children=Array.from({length:3500},(_,i)=>({id:'child-'+i,text:'Child '+i,children:[]}));
 const snap=A.capture(t,K);
 assert.equal(snap.nodes.length,A.MAX_PER_DOCUMENT);
 assert.equal(snap.truncated,true);
 const invalid=A.clean([{filePath:'../../secrets',nodes:[{id:'bad',text:'x'}]},
  {filePath:'https://example.com/a.neuromap',nodes:[{id:'web',text:'x'}]}]);
 assert.equal(invalid.length,0);
});

test('1000 reopens cannot lose Atlas links after transient tab IDs rotate',()=>{
 const leftPath='C:\\Study\\left.neuromap';
 const rightPath='C:\\Study\\right.neuromap';
 let records=A.update([],[
  tab('left-original',leftPath),tab('right-original',rightPath)],K);
 let edges=[{fromTab:'left-original',fromNode:'node-heart',
  toTab:'right-original',toNode:'node-pressure',label:'long-lived'}];
 // Each reopen uses a NEW session-specific tab ID. Links must instead
 // stabilize to document path keys; retaining aliases alone is not enough.
 for(let session=0;session<1000;session++){
  const open=[tab('left-session-'+session,leftPath),
              tab('right-session-'+session,rightPath)];
  edges=A.stabilizeEdges(edges,open,records);
  records=A.update(records,open,K);
  const index=A.project(K,[],records);
  const validated=A.normalizeEdges(K,edges,index);
  assert.equal(validated.length,1,'link lost after session '+session);
  assert.equal(validated[0].fromTab,A.keyFor(open[0]));
  assert.equal(validated[0].toTab,A.keyFor(open[1]));
  assert.ok(records.every(d=>(d.tabIds||[]).length<=32));
 }
 assert.equal(edges[0].fromTab,A.keyFor({filePath:leftPath}));
 assert.equal(edges[0].toTab,A.keyFor({filePath:rightPath}));
});
test('unknown old Atlas endpoints survive canonicalization without fake matches',()=>{
 const file=tab('known-id','C:\\Study\\only.neuromap');
 const library=A.update([],[file],K);
 const edges=[{fromTab:'known-id',fromNode:'node-heart',
  toTab:'missing-temporary-tab',toNode:'not-found',label:''}];
 const snapshot=JSON.parse(JSON.stringify(edges));
 const out=A.stabilizeEdges(edges,[],library);
 assert.equal(out.length,1);
 assert.equal(out[0].fromTab,A.keyFor(file));
 assert.equal(out[0].toTab,'missing-temporary-tab');
 assert.deepEqual(edges,snapshot,'input graph was mutated');
});
