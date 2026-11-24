'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../view-core');
const Network=require('../concept-network');
const Flow=require('../flow-core');
const Work=require('../work-core');
const Locale=require('./helpers/compose-localization.cjs')();
const samples=[
 {tag:'Italiano',value:'Memoria e apprendimento – città, più, perché'},
 {tag:'English',value:'My first mind map — child & sibling'},
 {tag:'Español',value:'Árbol de ideas: corazón y circulación'},
 {tag:'Français',value:'Éléments de la pensée – étude'},
 {tag:'Deutsch',value:'Überblick: Größenänderung & Äste'},
 {tag:'Português',value:'Coração, ação e informação'},
 {tag:'Türkçe',value:'Öğrenme, düğümler, küçük'},
 {tag:'Polski',value:'Zażółć gęślą jaźń'},
 {tag:'العربية',value:'خريطة ذهنية — العربية'},
 {tag:'עברית',value:'מפת חשיבה — עברית'},
 {tag:'中文',value:'大脑与学习 · 思维导图'},
 {tag:'日本語',value:'神経と記憶のマインドマップ'},
 {tag:'한국어',value:'학습과 기억 지도'},
 {tag:'हिन्दी',value:'तंत्रिका तंत्र और मस्तिष्क'},
 {tag:'Русский',value:'Нервная система — память'},
 {tag:'Greek',value:'Νευρικό σύστημα — μνήμη'},
 {tag:'emoji / combining',value:'👨‍👩‍👧‍👦 🧠 e\u0301 \u200fRTL\u200e'}
];
function fixture(){
 const root={id:'root',text:'Project · خطة · 案件',children:[]};
 for(let i=0;i<1020;i++){
  const sample=samples[i%samples.length];
  root.children.push({id:'n'+i,text:sample.value,taskStatus:
    ['todo','doing','done'][i%3],startDate:'2026-10-25',dueDate:'2026-11-05',
    sourceRefs:[{id:'source-'+i,page:i+1,title:sample.value}],children:[]});
 }
 const links=[{id:'flow',fromId:'n0',toId:'n1',kind:'sequence',label:'Sí · نعم · はい'},
  {id:'relation',fromId:'n1',toId:'n2',label:'þ · 中文'}];
 return {root,relationships:links,images:[{id:'img',attachedNodeId:'n0',src:'local'}]};
}
test('17 world-script samples survive every existing projection unchanged',()=>{
 const model=fixture(),serialized=JSON.stringify(model);
 const projected=[
  Core.project(model.root,'orgchart',{maxNodes:2000}),
  Core.project(model.root,'concept-tree',{maxNodes:2000}),
  Network.project(model.root,model.relationships),
  Flow.project(model.root,model.relationships,{maxCandidates:1200}),
  Work.project(model.root,'kanban'),
  Work.project(model.root,'timeline')
 ];
 assert.equal(JSON.stringify(model),serialized);
 for(const {tag,value}of samples){
  const matching=model.root.children.filter(n=>n.text===value);
  assert.ok(matching.length>0,tag);
  assert.ok(projected[0].nodes.some(n=>n.text===value),tag+' in orgchart');
  assert.ok(projected[1].nodes.some(n=>n.text===value),tag+' in concept tree');
  assert.ok(projected[2].nodes.some(n=>n.text===value),tag+' in network');
  assert.ok(projected[4].nodes.some(n=>n.text===value),tag+' in kanban');
  assert.ok(projected[5].nodes.some(n=>n.text===value),tag+' in timeline');
 }
 assert.equal(model.root.children.length,1020);
 assert.equal(projected[2].nodes.length,1021);
 assert.equal(projected[4].nodes.length,1020);
 assert.equal(projected[5].nodes.length,1020);
});
test('language toggle changes interface labels, never replaces arbitrary user text',()=>{
 assert.equal(Locale.translate('Testo','en'),'Text');
 assert.equal(Locale.translate('Testo','it'),'Testo');
 for(const s of samples){
  const value=s.value;
  assert.equal(Locale.translate(value,'en'),value,s.tag);
  assert.equal(Locale.translate(value,'it'),value,s.tag);
 }
});
test('bounded projections fail without mutating a 5,000-node source',()=>{
 const root={id:'root',text:'Project',children:[]};
 for(let i=0;i<5000;i++)
  root.children.push({id:'big-'+i,text:samples[i%samples.length].value,children:[]});
 const before=JSON.stringify(root);
 assert.throws(()=>Network.project(root),/limit/);
 assert.throws(()=>Flow.project(root,[],{maxCandidates:1200}),/too large/);
 assert.throws(()=>Work.project(root,'kanban'),/too large/);
 assert.equal(root.children.length,5000);
 assert.equal(JSON.stringify(root),before);
});
test('source references, right-to-left mark and emoji remain stable across repeat projections',()=>{
 const model=fixture(),before=JSON.stringify(model);
 for(let k=0;k<10;k++){
  Network.project(model.root,model.relationships);
  Work.project(model.root,'kanban');
  Core.project(model.root,'concept-tree',{maxNodes:2000});
 }
 assert.equal(JSON.stringify(model),before);
 assert.equal(model.root.children[16].text,samples[16].value);
 assert.ok(model.root.children[16].text.includes('🧠'));
 assert.equal(model.root.children[0].sourceRefs[0].page,1);
});
