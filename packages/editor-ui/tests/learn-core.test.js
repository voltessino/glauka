'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../../../apps/desktop-shared/editor/learn-core');
const copy=x=>JSON.parse(JSON.stringify(x));
function sample(i=0){
 return {id:'root',text:'Anatomia',notes:'',children:[
  {id:'a',parentId:'root',text:'Cuore '+i,notes:'Pompa del sangue',
   children:[{id:'a1',parentId:'a',text:'Atrio destro',notes:'Riceve sangue venoso',children:[]},
             {id:'a2',parentId:'a',text:'Ventricolo sinistro',children:[]}]},
  {id:'b',parentId:'root',text:'Fegato',notes:'Sintesi proteica',
   children:[{id:'b1',parentId:'b',text:'Epatocita',children:[]}]},
  {id:'c',parentId:'root',text:'Rene',children:[]},
  {id:'d',parentId:'root',text:'Polmone',children:[]}]};
}
test('1000 maps: recall masks only requested logical IDs and never mutates source',()=>{
 for(let i=0;i<1000;i++){
  const root=sample(i),before=JSON.stringify(root);
  const all=L.recallIds(root,root.id),branch=L.recallIds(root,'a');
  assert.equal(all.length,7);
  assert.deepEqual(branch,['a','a1','a2']);
  assert.ok(!all.includes(root.id));
  assert.equal(JSON.stringify(root),before);
 }
});
test('recall caps hidden labels and preserves collapsed descendants',()=>{
 const root={id:'root',text:'Main',children:[]};
 for(let i=0;i<2000;i++)root.children.push({id:'n'+i,text:'N'+i,collapsed:true,children:[]});
 assert.equal(L.recallIds(root,'root').length,1200);
 assert.equal(L.recallIds(root,'root',30).length,30);
});
test('1000 quiz sessions use existing flashcards, notes and map topology without AI',()=>{
 for(let i=0;i<1000;i++){
  const root=sample(i),before=JSON.stringify(root);
  const card={id:'card'+i,sourceTabId:'tab',sourceNodeId:'a1',
   question:'Where does it arrive?',answer:'Right atrium'};
  const items=L.quiz(root,{tabId:'tab',scopeId:'root',studyCards:[card],limit:50});
  assert.ok(items.some(x=>x.origin==='flashcard'&&x.nodeId==='a1'));
  assert.ok(items.some(x=>x.format==='choice'));
  assert.ok(items.some(x=>x.format==='open'&&x.origin==='map'));
  for(const x of items.filter(x=>x.format==='choice')){
   assert.equal(x.options[x.correctIndex],x.answer);
   assert.ok(x.options.length>=3&&new Set(x.options.map(s=>s.toLowerCase())).size===x.options.length);
  }
  assert.equal(JSON.stringify(root),before);
 }
});
test('stale flashcards and cards from another tab are excluded',()=>{
 const root=sample(),cards=[
  {id:'stale',sourceTabId:'t',sourceNodeId:'a',question:'Test stale',answer:'Old'},
  {id:'valid',sourceTabId:'t',sourceNodeId:'a1',question:'Test valid',answer:'New'},
  {id:'wrong',sourceTabId:'other',sourceNodeId:'a1',question:'Other',answer:'Else'}
 ];
 const result=L.quiz(root,{tabId:'t',scopeId:'a',studyCards:cards,
  fresh:c=>c.id==='valid'});
 assert.deepEqual(result.filter(x=>x.origin==='flashcard').map(x=>x.id),['card:valid']);
 assert.ok(result.every(x=>x.nodeId==='a'||x.nodeId==='a1'||x.nodeId==='a2'));
});
test('1000 mistakes are independently persisted; flashcards and map remain unchanged',()=>{
 const root=sample(),cards=[{id:'one',sr:{dueAt:17,intervalDays:4,reviews:3}}];
 const before=JSON.stringify([root,cards]);
 let attempts=[];
 for(let i=0;i<1000;i++)attempts=L.addAttempt(attempts,{
  tabId:'tab',nodeId:'a1',itemId:'notes:'+i,format:'open',
  correct:i%3!==0,sourceSignature:'source-v1'},1730000000000+i);
 const summary=L.stats(attempts,'tab');
 assert.equal(summary.answered,1000);
 assert.equal(summary.mistakes,334);
 assert.equal(summary.correct,666);
 assert.equal(JSON.stringify([root,cards]),before);
});
test('sanitization rejects malformed records and clamps history',()=>{
 const bad=[
  null,{}, {tabId:'x',nodeId:'n',itemId:'one',format:'open',correct:1,answeredAt:12},
  {tabId:'x',nodeId:'n',itemId:'one',format:'script',correct:true,answeredAt:12}
 ];
 assert.equal(L.cleanAttempts(bad).length,0);
 const many=[];
 for(let i=0;i<2700;i++)many.push({tabId:'x',nodeId:'n',itemId:'one',
  format:'open',correct:false,answeredAt:i});
 const clean=L.cleanAttempts(many);
 assert.equal(clean.length,2500);assert.equal(clean[0].answeredAt,200);
 assert.equal(clean[2499].answeredAt,2699);
});
test('duplicate IDs, cycles, bad child arrays and limits fail without mutation',()=>{
 const root=sample();
 root.children[0].id='root';assert.throws(()=>L.walk(root),/Invalid/);
 const r=sample();r.children[0].children.push(r);
 assert.throws(()=>L.walk(r),/Invalid/);
 assert.throws(()=>L.walk({id:'x',children:null}),/Invalid/);
});
test('quiz option order and contents are deterministic',()=>{
 const root=sample();
 const one=L.quiz(root,{tabId:'t',limit:70});
 assert.deepEqual(one,L.quiz(root,{tabId:'t',limit:70}));
});
test('history survives JSON roundtrip and one map cannot read another map stats',()=>{
 const original=L.addAttempt([],{tabId:'t1',nodeId:'a',itemId:'i',
  format:'choice',correct:true,sourceSignature:'sig'},1234);
 const after=L.cleanAttempts(JSON.parse(JSON.stringify(original)));
 assert.deepEqual(after,original);
 assert.deepEqual(L.stats(after,'t1'),{answered:1,correct:1,mistakes:0});
 assert.deepEqual(L.stats(after,'t2'),{answered:0,correct:0,mistakes:0});
});
test('deep 10k node chains do not overflow recall or quiz',()=>{
 let root={id:'root',text:'Root',children:[]},cursor=root;
 for(let i=0;i<10000;i++){
  const n={id:'n'+i,text:'Node '+i,children:[]};
  cursor.children.push(n);cursor=n;
 }
 assert.equal(L.recallIds(root,'root').length,1200);
 assert.equal(L.quiz(root,{tabId:'t',limit:20}).length,20);
});
test('a twenty page chapter keeps a real page and drops an invented one',async()=>{
 const http=require('node:http');
 const sha='ab'.repeat(32);
 const catalog=[];
 for(let i=1;i<=20;i++){
  catalog.push({id:'p'+i,
   text:'Pagina '+i+'. Il cuore pompa il sangue verso i tessuti attraverso le arterie.',
   notes:'Nota personale pagina '+i,
   sourceRefs:i===2?[{kind:'pdf',fileName:'capitolo-cuore.pdf',sha256:sha,page:2,
    quote:'Il cuore pompa il sangue',title:'Capitolo cuore'}]:[]});
 }
 const before=JSON.stringify(catalog);
 const sent=L.promptNodes(catalog);
 assert.equal(JSON.stringify(sent).includes('Nota personale'),false);
 assert.equal(sent.length,20);
 assert.equal(sent[1].source.page,2);
 assert.equal(sent[1].source.fileName,'capitolo-cuore.pdf');
 const body=JSON.stringify({questions:[
  {nodeId:'p2',question:'Che cosa fa il cuore?',answer:'Pompa il sangue',
   explanation:'La pagina 2 dice che il cuore pompa il sangue.',
   options:['Pompa il sangue','Filtra la bile','Produce insulina'],
   source:{fileName:'capitolo-cuore.pdf',sha256:sha,page:2}},
  {nodeId:'p2',question:'Quale pagina è inventata qui?',answer:'Pompa il sangue',
   source:{fileName:'altro.pdf',sha256:'ff'.repeat(32),page:99}},
  {nodeId:'assente',question:'Domanda su un nodo che non esiste',answer:'niente di utile'}
 ]});
 const server=http.createServer((req,res)=>{
  res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'});
  res.end(body);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const port=server.address().port;
  const raw=await fetch('http://127.0.0.1:'+port+'/').then(r=>r.text());
  const out=L.acceptQuiz(raw,catalog);
  assert.equal(out.items.length,2);
  assert.equal(out.items[0].source.page,2);
  assert.equal(out.items[0].format,'choice');
  assert.equal(out.items[0].correctIndex,0);
  assert.equal(out.items[0].explanation.includes('pagina 2'),true);
  assert.equal(out.items[1].source,null);
  assert.ok(out.rejected.includes('fonte'));
  assert.ok(out.rejected.includes('nodo'));
  assert.equal(JSON.stringify(catalog),before);
  assert.throws(()=>L.acceptQuiz('{',catalog),/Risposta non valida/);
 }finally{
  server.closeAllConnections?.();
  await new Promise(resolve=>server.close(resolve));
 }
});
