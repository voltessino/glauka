'use strict';
// Synthetic users, not human usability testing. Run: node --test packages/editor-ui/tests/student-journeys-20261027.test.js
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../../map-core');
globalThis.NeuroMapCore=Core;
const Docs=require('../../../apps/desktop-shared/editor/document-import-core');
const Learning=require('../../../apps/desktop-shared/editor/learn-core');
const Adaptive=require('../../../apps/desktop-shared/editor/learn-adaptive-core');
const Knowledge=require('../../../apps/desktop-shared/editor/knowledge-core');
const Sources=require('../../../apps/desktop-shared/editor/source-lens-core');
const AI=require('../ai-studio-core');

const NOW=Date.UTC(2026,9,27,12);
const DAY=86400000;
const EXAM='2026-11-17';
// Profiles encode tasks and stressors, NOT predictions of actual student behaviour.
const profiles=[
 ['liceo scientifico','Fisica','grandezze e unità','formule'],
 ['liceo classico','Storia','rivoluzioni e cronologia','date'],
 ['infermieristica','Fisiologia','circolazione e perfusione','termini clinici'],
 ['medicina','Anatomia','cuore e valvole','gerarchie profonde'],
 ['ingegneria','Reti','protocolli e pacchetti','simboli e codici'],
 ['giurisprudenza','Diritto','norme e gerarchie','citazioni'],
 ['lettere','Letteratura','autori e correnti','testo libero'],
 ['lingue','Spagnolo','grammatica e lessico','multilingua'],
 ['lavoratore serale','Contabilità','bilancio e costi','poco tempo'],
 ['tablet piccolo','Biologia','cellule e tessuti','schermo ridotto'],
 ['preferenza lettura accessibile','Geografia','regioni e clima','accessibilità'],
 ['molte materie','Chimica','legami e molecole','schede multiple']
];
function documentText(subject,topic,format,locale,p){
 const fact=locale==='it'?'osservazione':'observation';
 const multilingual=p===7?' español · 日本語 · α':'';
 if(format==='txt')return [
  subject+': '+topic+multilingual+' ('+fact+' 1).',
  'Schema: '+subject+' → '+topic+'; dettagli e note della lezione.',
  'Esempio concreto: caso 2; evidenza da verificare.',
  'Domanda aperta: quali passaggi sono indispensabili?'
 ].join('\n\n');
 return [
  '# '+subject,
  '## '+topic+multilingual,
  '- '+fact+' 1',
  '- Caso concreto',
  '- Domande da ripassare',
  '## Spunti della lezione',
  '- Struttura della mappa'
 ].join('\n');
}
const file=(name,text)=>({name,size:Buffer.byteLength(text),text:async()=>text});
function assignIds(node,prefix){
 let i=0,stack=[{node,parent:null}];
 while(stack.length){
  const {node:current,parent}=stack.pop();
  current.id=prefix+'_'+(++i);
  if(parent)current.parentId=parent.id;
  for(let j=(current.children||[]).length-1;j>=0;j--)
   stack.push({node:current.children[j],parent:current});
 }
 return node;
}
function semantic(n){
 return {text:n.text,notes:n.notes||'',children:(n.children||[]).map(semantic)};
}
const recorded=new Set();
for(let pi=0;pi<profiles.length;pi++){
 const [label,subject,topic,challenge]=profiles[pi];
 for(const locale of ['it','en'])for(const format of ['txt','md'])
 for(const minutes of [10,35,90]){
  const scenario=[label,locale,format,minutes].join(' / ');
  test('journey: '+scenario,async()=>{
   const tabId='student_'+pi+'_'+locale+'_'+format+'_'+minutes;
   assert.ok(!recorded.has(tabId));recorded.add(tabId);
   const data=documentText(subject,topic,format,locale,pi);
   const proposal=await Docs.preview(file(subject+'.'+format,data));
   assert.equal(proposal.kind,format);
   assert.ok(proposal.count>=4,'student must receive an outline');
   const root=assignIds(structuredClone(proposal.root),tabId);
   const baseline=JSON.stringify(root);
   const walk=Learning.walk(root);
   assert.equal(walk.rows.length,proposal.count);
   assert.equal(new Set(walk.rows.map(x=>x.id)).size,proposal.count);

   // The preview is detached, and search/review projections must not alter the map.
   assert.ok(!proposal.root.id);
   const index=Knowledge.indexTabs([{id:tabId,title:subject,state:{root}}]);
   assert.ok(Knowledge.search(index,subject,10).length>0);
   assert.equal(JSON.stringify(root),baseline);

   // Multi-document learning: explicit links cannot point to deleted nodes.
   const secondary={id:'other_'+tabId,text:'Secondo corso',
    children:[{id:'otherchild_'+tabId,text:subject,children:[]}]};
   assert.equal(Core.validateWorkspaceTabs([{root},{root:secondary}]),
    proposal.count+2);
   const cross=Knowledge.indexTabs([{id:tabId,title:subject,state:{root}},
    {id:'other_'+tabId,title:'Secondo corso',state:{root:secondary}}]);
   const edge={fromTab:tabId,fromNode:root.id,toTab:'other_'+tabId,
    toNode:secondary.children[0].id,label:'Collega argomenti'};
   assert.equal(Knowledge.normalizeEdges([edge,edge,{...edge,toNode:'missing'}],cross).length,1);
   assert.ok(Knowledge.route(cross,[edge],tabId,root.id,
    'other_'+tabId,secondary.children[0].id).length>=2);

   // Round-trip concerns only fields promised by structured Markdown, not node IDs/PDF evidence.
   const markdown=Core.serializeMarkdown(root);
   const reimported=Core.parseMarkdownExport(markdown);
   assert.equal(reimported.length,1);
   assert.deepEqual(semantic(reimported[0]),semantic(root));

   // Provenance must be explicit and deduplicated; never synthesize extracted PDF pages.
   const target=root.children[0],ref={id:'source_'+tabId.replace(/[^a-z0-9_]/gi,'').slice(0,70),
    kind:'pdf',title:subject,quote:topic,page:3,fileName:'dispensa.pdf',sha256:'a'.repeat(64)};
   assert.equal(Sources.attach(target,ref),true);
   assert.equal(Sources.attach(target,ref),false);
   assert.equal(target.sourceRefs[0].page,3);
   assert.equal(Sources.safeUrl('javascript:alert(1)'),'');
   // A generated AI suggestion is validated, not silently applied to existing nodes.
   const beforeAI=JSON.stringify(root);
   const suggestion=AI.hierarchy({id:'forged',text:'Riepilogo '+subject,
    children:[{text:topic,sourceRefs:[ref],executable:'alert(1)'}]});
   assert.equal(suggestion.id,undefined);
   assert.equal(suggestion.children[0].sourceRefs,undefined);
   assert.equal(JSON.stringify(root),beforeAI);

   // Quiz uses real map IDs; outcomes are OBSERVATIONS, never fake mastery.
   const quiz=Learning.quiz(root,{tabId,limit:15});
   assert.ok(quiz.length>0);
   const first=quiz[0];
   const node=Learning.walk(root).index.get(first.nodeId).node;
   const signatureFor=n=>n.text+'#v1';
   let attempts=Learning.addAttempt([],{tabId,nodeId:node.id,
    itemId:first.id,format:first.format,correct:false,
    sourceSignature:signatureFor(node)},NOW-60000);
   assert.equal(Learning.stats(attempts,tabId).mistakes,1);
   const cards=[{id:'card_'+tabId,sourceTabId:tabId,
    sourceNodeId:node.id,question:first.question,answer:first.answer,
    sr:{dueAt:NOW+2*DAY,reviews:1,lapses:0}}];
   const beforeRadar=JSON.stringify(root),beforeCards=JSON.stringify(cards);
   const report=Adaptive.radar(root,{tabId,attempts,cards,signatureFor,
    freshCard:()=>true,now:NOW});
   assert.equal(report.totals.mistakes,1);
   assert.equal(report.totals.dueCards,0);
   assert.ok(!report.nodes.some(x=>Object.hasOwn(x,'mastery')));
   const plans=Adaptive.setPlan([],{tabId,examDate:EXAM,
    minutesPerDay:minutes},NOW);
   const schedule=Adaptive.schedule(report,plans[0],NOW);
   assert.ok(schedule.days.length>=20);
   assert.ok(schedule.days.every(d=>d.estimatedMinutes<=minutes));
   const early=schedule.days.filter(d=>d.date<'2026-10-29');
   assert.ok(early.every(d=>d.items.every(x=>x.reason!=='due-flashcard')));
   assert.ok(schedule.days.some(d=>d.date>='2026-10-29' &&
    d.items.some(x=>x.nodeId===node.id&&x.reason==='due-flashcard')));
   assert.equal(JSON.stringify(root),beforeRadar);
   assert.equal(JSON.stringify(cards),beforeCards);

   // An edited source invalidates old exam evidence instead of counting an old error.
   node.text+=' · revisionato';
   const changed=Adaptive.radar(root,{tabId,attempts,cards,signatureFor,
    freshCard:()=>true,now:NOW});
   assert.equal(changed.totals.stale,1);
   assert.equal(changed.totals.mistakes,0);
   assert.ok(Knowledge.search(Knowledge.indexTabs([
    {id:tabId,title:subject,state:{root}}]),'revisionato').length>0);
   assert.ok(['formule','date','termini clinici','gerarchie profonde',
    'simboli e codici','citazioni','testo libero','multilingua',
    'poco tempo','schermo ridotto','accessibilità','schede multiple'].includes(challenge));
  });
 }
}
test('boundary: one course with 249 TXT paragraphs imports; 250 are rejected',async()=>{
 const many=n=>Array.from({length:n},(_,i)=>'Paragrafo numero '+i).join('\n\n');
 const p=await Docs.preview(file('capitolo.txt',many(249)));
 assert.equal(p.count,250);
 await assert.rejects(()=>Docs.preview(file('capitolo.txt',many(250))),/249 paragraphs/);
});
test('boundary: a workspace of 20 tabs is valid, 21 is rejected',()=>{
 const tabs=Array.from({length:20},(_,i)=>({root:{id:'r'+i,
    text:'Materia '+i,children:[]}}));
 assert.equal(Core.validateWorkspaceTabs(tabs),20);
 assert.throws(()=>Core.validateWorkspaceTabs([...tabs,tabs[0]]));
});
test('boundary: unsafe imports and invalid sources are rejected',async()=>{
 await assert.rejects(()=>Docs.preview(file('macro.js','alert(1)')));
 assert.equal(Sources.normalize({id:'bad_src_12',kind:'pdf',fileName:'x.pdf',
   page:0,sha256:'a'.repeat(64)}),null);
 assert.equal(Sources.normalize({id:'bad_url_12',kind:'web',
   url:'javascript:alert(1)'}),null);
 assert.throws(()=>AI.hierarchy({text:'x'.repeat(181)}));
 const cycle={text:'a',children:[]};cycle.children.push(cycle);
 assert.throws(()=>AI.hierarchy(cycle));
});
test('boundary: 3,500 node workspace limit is enforced and deep structures bounded',()=>{
 const root={id:'root',text:'Grande',children:[]};
 for(let i=0;i<3500;i++)root.children.push({id:'n'+i,text:'Nodo '+i,children:[]});
 assert.throws(()=>Core.validateWorkspaceTabs([{root}]));
 assert.throws(()=>Core.serializeMarkdown(root));
});

test('regression: root quiz evidence is scheduled, unobserved root stays hidden',()=>{
 const root={id:'root',text:'Corso',children:[
  {id:'chapter',text:'Primo capitolo',children:[]}
 ]};
 const blank=Adaptive.radar(root,{tabId:'t',now:NOW});
 assert.ok(!blank.ranked.some(x=>x.nodeId==='root'));
 const card={id:'root_card',sourceTabId:'t',sourceNodeId:'root',
  question:'Quale corso?',answer:'Corso',
  sr:{dueAt:NOW+DAY,reviews:1}};
 const quiz=Learning.quiz(root,{tabId:'t',studyCards:[card]});
 assert.equal(quiz[0].nodeId,'root');
 const attempts=Learning.addAttempt([],{tabId:'t',nodeId:'root',
  itemId:quiz[0].id,format:quiz[0].format,correct:false,
  sourceSignature:'Corso#v1'},NOW-1000);
 const radar=Adaptive.radar(root,{tabId:'t',attempts,cards:[card],
  signatureFor:n=>n.text+'#v1',now:NOW});
 assert.equal(radar.byId.get('root').mistakes,1);
 assert.ok(radar.ranked.some(x=>x.nodeId==='root'));
 const plan=Adaptive.schedule(radar,{examDate:'2026-10-31',minutesPerDay:35},NOW);
 assert.ok(plan.days.flatMap(d=>d.items).some(x=>x.nodeId==='root'));
 assert.ok(plan.days.filter(d=>d.date<'2026-10-28').every(d=>
  d.items.every(x=>x.reason!=='due-flashcard')));
});
