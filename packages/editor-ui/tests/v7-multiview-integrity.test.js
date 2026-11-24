'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const view=require('../view-core'),network=require('../concept-network');
const flow=require('../flow-core'),work=require('../work-core');
function fixture(){
 const root={id:'root',text:'Progetto',viewMode:'mindmap',children:[
  {id:'research',text:'Ricerca',side:'right',color:'#3498db',
   sourceRefs:[{id:'pdf1',kind:'pdf',title:'Documento',page:12,quote:'Revisione'}],
   children:[{id:'check',text:'Verifica',taskStatus:'doing',
    startDate:'2026-10-25',dueDate:'2026-10-27',children:[]}]},
  {id:'publish',text:'Pubblicazione',taskStatus:'todo',
   dueDate:'2026-11-02',children:[]},
  {id:'marketing',text:'Promozione',taskStatus:'done',children:[]}
 ]};
 const images=[{id:'img1',attachedNodeId:'research',mode:'attached',src:'local'}];
 const relationships=[
  {id:'flow',fromId:'research',toId:'check',kind:'sequence',label:'Segue'},
  {id:'yes',fromId:'check',toId:'publish',kind:'yes',label:'OK'},
  {id:'note',fromId:'publish',toId:'marketing',label:'Dipende da'}
 ];
 return {root,images,relationships};
}
function projectAll(doc){
 return {
  mindmap:view.project(doc.root,'mindmap'),
  orgchart:view.project(doc.root,'orgchart'),
  'concept-tree':view.project(doc.root,'concept-tree'),
  'concept-network':network.project(doc.root,doc.relationships),
  flowchart:flow.project(doc.root,doc.relationships),
  kanban:work.project(doc.root,'kanban'),
  timeline:work.project(doc.root,'timeline')
 };
}
test('all seven current view modes are projections of one unchanged original map',()=>{
 const source=fixture(),original=JSON.stringify(source);
 const previews=projectAll(source);
 assert.deepEqual(Object.keys(previews),view.MODES);
 assert.equal(JSON.stringify(source),original);
 const allIds=new Set(['root','research','check','publish','marketing']);
 for(const [mode,p]of Object.entries(previews)){
  assert.ok(p&&Array.isArray(p.nodes)&&Array.isArray(p.edges),mode);
  assert.ok(Number.isFinite(p.width)&&Number.isFinite(p.height),mode);
  assert.equal(new Set(p.nodes.map(n=>n.id)).size,p.nodes.length);
  assert.ok(p.nodes.every(n=>allIds.has(n.id)),mode);
 }
 assert.deepEqual(previews.orgchart.nodes.map(n=>n.id),['root','research','check','publish','marketing']);
 assert.deepEqual(previews['concept-tree'].nodes.map(n=>n.id),previews.orgchart.nodes.map(n=>n.id));
 assert.equal(previews['concept-network'].nodes.length,5);
 assert.equal(previews.flowchart.edges.length,2,'ordinary untyped references are not guessed as process transitions');
 assert.equal(previews.kanban.nodes.length,4);
 assert.deepEqual(previews.timeline.nodes.map(n=>n.id),['check','publish']);
});
test('changing the metadata for one mode never touches source references, images or edges',()=>{
 const doc=fixture(),snapshot=JSON.stringify(doc);
 for(let round=0;round<12;round++)projectAll(doc);
 assert.equal(JSON.stringify(doc),snapshot);
 assert.equal(doc.root.children[0].sourceRefs[0].page,12);
 assert.equal(doc.images[0].attachedNodeId,'research');
 assert.equal(doc.relationships[2].label,'Dipende da');
});
test('collapsed nodes remain persisted even when hidden in an orgchart preview',()=>{
 const doc=fixture();doc.root.children[0].collapsed=true;
 const saved=JSON.stringify(doc);
 const projection=view.project(doc.root,'orgchart');
 assert.equal(projection.nodes.some(n=>n.id==='check'),false);
 assert.equal(doc.root.children[0].children[0].id,'check');
 assert.equal(JSON.stringify(doc),saved);
});
test('over-capacity previews reject safely, rather than silently deleting source nodes',()=>{
 const doc=fixture();
 for(let i=0;i<1201;i++)
  doc.root.children.push({id:'more-'+i,text:'Unit '+i,children:[]});
 const snapshot=JSON.stringify(doc);
 assert.throws(()=>network.project(doc.root,doc.relationships),/safe display limit/);
 assert.throws(()=>flow.project(doc.root,doc.relationships),/too large/);
 assert.equal(view.project(doc.root,'orgchart',{maxNodes:2000}).nodes.length,1206);
 assert.equal(JSON.stringify(doc),snapshot);
});
test('timeline does not invent dates and workflow never infers transition order from siblings',()=>{
 const doc=fixture();
 doc.relationships=[];
 const before=JSON.stringify(doc);
 const process=flow.project(doc.root,doc.relationships);
 assert.equal(process.empty,true);
 const timeline=work.project(doc.root,'timeline');
 assert.equal(timeline.missingDates,2);
 assert.equal(timeline.nodes.length,2);
 assert.equal(JSON.stringify(doc),before);
});
