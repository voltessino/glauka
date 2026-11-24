'use strict';
// Deterministic functional verification against genuine Glauka domain modules.
// Simulated contexts are NOT human users, linguistic comprehension, or measured learning.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../../../tests/browser/fixtures/student-1000-profiles');
const M=require('../media-core');
const Core=require('../../map-core');
globalThis.NeuroMapCore=Core;
const Import=require('../../../apps/desktop-shared/editor/document-import-core');
const Learn=require('../../../apps/desktop-shared/editor/learn-core');
const Adaptive=require('../../../apps/desktop-shared/editor/learn-adaptive-core');
const Knowledge=require('../../../apps/desktop-shared/editor/knowledge-core');
const Sources=require('../../../apps/desktop-shared/editor/source-lens-core');
const AI=require('../ai-studio-core');
const NOW=Date.UTC(2026,9,27,12,0),DAY=86400000;
const file=(name,value)=>({name,size:Buffer.byteLength(value,'utf8'),text:async()=>value});
const clone=x=>JSON.parse(JSON.stringify(x));
const comparable=node=>({text:node.text,notes:node.notes||'',
 children:(node.children||[]).map(comparable)});
function ids(tree,tag){
 const stack=[{node:tree,parent:null}];let seq=0;
 while(stack.length){
  const {node,parent}=stack.pop();
  node.id=tag+'-n'+(++seq);
  if(parent)node.parentId=parent.id;
  for(let i=node.children.length-1;i>=0;i--)stack.push({node:node.children[i],parent:node});
 }
 return seq;
}
function body(s){
 const term=s.specimen+' · '+s.subject;
 if(s.seed%3===0)return {
  kind:'md',name:'appunti.md',value:'# '+s.subject+
   '\n## '+term+'\n- Teoria\n- Pratica\n- Verifica\n## Riepilogo\n- Ripasso'};
 if(s.seed%3===1)return {
  kind:'txt',name:'appunti.txt',value:[
   term,'Definizione di '+s.subject,'Caso applicativo: '+s.specimen,
   'Domanda di verifica e ripasso'
  ].join('\n\n')};
 return {kind:'txt',name:'appunti.txt',value:
  Array.from({length:8+(s.seed%20)},(_,j)=>s.subject+' · '+j+
   ' · '+s.specimen).join('\n\n')};
}
for(const s of P.STUDENTS){
 test(s.id+' · '+s.countryCode+' · '+s.subject+' · '+s.workflow,async()=>{
  const doc=body(s),preview=await Import.preview(file(doc.name,doc.value));
  assert.equal(preview.kind,doc.kind);
  assert.ok(preview.count>=4);
  assert.equal(preview.root.id,undefined,'preview must never acquire active node IDs');
  const root=clone(preview.root),quantity=ids(root,s.id);
  assert.equal(quantity,preview.count);
  const baseline=JSON.stringify(root);
  const nodes=Learn.walk(root);
  assert.equal(nodes.rows.length,quantity);
  assert.equal(Core.validateWorkspaceTabs([{root}]),quantity);

  const tabs=[{id:s.id,title:s.subject,state:{root}}],idx=Knowledge.indexTabs(tabs);
  assert.ok(Knowledge.search(idx,s.subject,20).length>0);
  assert.equal(JSON.stringify(root),baseline,'search must be read only');

  const markdown=Core.serializeMarkdown(root),parsed=Core.parseMarkdownExport(markdown);
  assert.deepEqual(comparable(parsed[0]),comparable(root),'loss of notes/order in Markdown');
  assert.equal(JSON.stringify(root),baseline);

  // A physical image is exercised separately in the browser suite. This checks
  // production metadata transformations, including dimensions and preservation.
  const c={left:(s.seed*3)%70,right:(s.seed*7)%40,top:(s.seed*11)%70,
   bottom:(s.seed*5)%40};
  const props=M.imageProps({rotation:s.seed%4*90,crop:c,
   frame:['none','thin','double'][s.seed%3],
   borderRadius:[0,8,16,24,32][s.seed%5],caption:s.specimen});
  const media={id:'im-'+s.id,src:'data:image/png;base64,TEST_FIXTURE_NOT_LOADED',
   ...props,width:400+(s.seed%200),height:200+(s.seed%80)};
  const originalMedia=clone(media);
  const rect=M.imageSourceRect(media.width,media.height,props.crop);
  assert.ok(rect.sw>0&&rect.sh>0,'empty image crop');
  assert.ok([0,90,180,270].includes(props.rotation));
  assert.ok(props.caption.includes(s.specimen));
  assert.equal(M.imageProps(props).frame,props.frame);
  assert.deepEqual(media,originalMedia);

  // Citation verified structurally; not a fact-check or actual PDF extraction.
  const target=root.children[0];
  const source={id:'source_'+s.id,kind:'pdf',title:s.subject,
   fileName:'dispensa-'+s.id+'.pdf',page:1+s.seed%200,
   quote:s.specimen,sha256:'f'.repeat(64)};
  assert.equal(Sources.attach(target,source),true);
  assert.equal(Sources.attach(target,source),false);
  assert.equal(target.sourceRefs.length,1);
  assert.equal(target.sourceRefs[0].page,source.page);
  assert.equal(Sources.normalize({...source,page:0}),null);

  // Provider response validated, no application of AI text before user consent.
  const unchanged=JSON.stringify(root);
  const suggestion=AI.hierarchy({text:'Sintesi '+s.subject,
   id:'forged',children:[{text:'Approfondimento',execute:'fake'}]});
  assert.equal(suggestion.id,undefined);
  assert.equal(suggestion.children[0].execute,undefined);
  assert.equal(JSON.stringify(root),unchanged);

  const quiz=Learn.quiz(root,{tabId:s.id,limit:20});
  assert.ok(quiz.length>0);
  const first=quiz[0],selected=Learn.walk(root).index.get(first.nodeId).node;
  const signature=n=>n.text+'#'+s.id;
  let attempts=Learn.addAttempt([],{tabId:s.id,nodeId:selected.id,
   itemId:first.id,format:first.format,correct:false,sourceSignature:signature(selected)},NOW-120000);
  assert.equal(Learn.stats(attempts,s.id).mistakes,1);
  // Real attempt with a future due date must not be scheduled early.
  const due=NOW+(1+s.seed%3)*DAY;
  const cards=[{id:'flash-'+s.id,sourceTabId:s.id,sourceNodeId:selected.id,
   question:'Cosa ricordi di '+s.subject+'?',answer:s.specimen,
   sr:{dueAt:due,reviews:1,lapses:0}}];
  const oldCards=JSON.stringify(cards),oldRoot=JSON.stringify(root);
  const radar=Adaptive.radar(root,{tabId:s.id,attempts,cards,
   signatureFor:signature,freshCard:()=>true,now:NOW});
  assert.equal(radar.totals.mistakes,1);
  assert.equal(radar.totals.dueCards,0);
  assert.ok(!radar.nodes.some(n=>Object.hasOwn(n,'mastery')));
  const plan=Adaptive.setPlan([],{tabId:s.id,examDate:'2026-11-30',
   minutesPerDay:s.minutes},NOW);
  const schedule=Adaptive.schedule(radar,plan[0],NOW);
  assert.ok(schedule.days.length>20);
  assert.ok(schedule.days.every(day=>day.estimatedMinutes<=s.minutes));
  const startDay=new Date(due).toISOString().slice(0,10);
  assert.ok(schedule.days.filter(day=>day.date<startDay).every(day=>
   day.items.every(item=>item.reason!=='due-flashcard')),'flashcard shown too early');
  assert.ok(schedule.days.some(day=>day.date>=startDay&&day.items.some(item=>
   item.nodeId===selected.id&&item.reason==='due-flashcard')));
  assert.equal(JSON.stringify(root),oldRoot);
  assert.equal(JSON.stringify(cards),oldCards);

  selected.text+=' · aggiornato';
  const revised=Adaptive.radar(root,{tabId:s.id,attempts,cards,
   signatureFor:signature,freshCard:()=>true,now:NOW});
  assert.equal(revised.totals.stale,1);
  assert.equal(revised.totals.mistakes,0);
 });
}
test('dataset: 1000 profiles, every one of 249 ISO alpha-2 country/territory codes',()=>{
 assert.equal(P.COUNTRY_CODES.length,249);
 assert.equal(new Set(P.COUNTRY_CODES).size,249);
 assert.equal(P.STUDENTS.length,1000);
 assert.equal(new Set(P.STUDENTS.map(s=>s.id)).size,1000);
 assert.equal(new Set(P.STUDENTS.map(s=>s.countryCode)).size,249);
 assert.ok(new Set(P.STUDENTS.map(s=>s.subject)).size>=70);
 assert.equal(new Set(P.STUDENTS.map(s=>s.workflow)).size,10);
 assert.ok(P.STUDENTS.every(s=>s.minutes>=10&&s.minutes<=180));
});
