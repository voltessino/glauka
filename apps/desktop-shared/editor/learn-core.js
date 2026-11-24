/* NeuroMap 6.19.0 Learning Core -- offline, deterministic, provider independent.
 * No tree mutation, no guessed scientific facts, and no automatic grading
 * of free-text answers. Recorded quiz results are separate from flashcards.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapLearningCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_NODES=15000,MAX_ITEMS=160,MAX_ATTEMPTS=2500;
 const val=x=>typeof x==='string'?x.trim():'';
 function walk(root){
  if(!root||typeof root!=='object')throw Error('Missing map');
  const index=new Map(),out=[],seen=new Set(),stack=[{node:root,parentId:null,depth:0}];
  while(stack.length){
   const {node,parentId,depth}=stack.pop();
   if(!node||typeof node!=='object'||seen.has(node)||!val(node.id)||
      index.has(node.id)||!Array.isArray(node.children)||depth>MAX_NODES||
      out.length>=MAX_NODES)throw Error('Invalid or oversized map');
   seen.add(node);const row={node,id:node.id,parentId,depth};
   index.set(node.id,row);out.push(row);
   for(let i=node.children.length-1;i>=0;i--)stack.push({
    node:node.children[i],parentId:node.id,depth:depth+1});
  }
  return {index,rows:out};
 }
 function subtree(root,scopeId){
  const {index,rows}=walk(root);
  const scope=index.get(scopeId)||index.get(root.id);
  // A bounded iterative walk avoids recursion failure on deep maps.
  const keep=new Set(),stack=[scope.node];
  while(stack.length&&keep.size<MAX_NODES){
   const n=stack.pop();
   if(keep.has(n.id))continue;
   keep.add(n.id);
   for(let i=n.children.length-1;i>=0;i--)stack.push(n.children[i]);
  }
  return {index,rows:rows.filter(r=>keep.has(r.id)),scope};
 }
 function recallIds(root,scopeId,limit=1200){
  const {rows,scope}=subtree(root,scopeId);
  const max=Math.min(1200,Math.max(1,Math.floor(limit)||1200));
  return rows.filter(r=>r.id!==root.id&&(r.id!==scope.id||scope.id!==root.id))
   .slice(0,max).map(r=>r.id);
 }
 function hash(input){
  let x=2166136261;
  for(let i=0;i<input.length;i++){x^=input.charCodeAt(i);x=Math.imul(x,16777619)}
  return x>>>0;
 }
 function quiz(root,{tabId='',scopeId='',studyCards=[],fresh=()=>true,limit=40}={}){
  const {rows,scope,index}=subtree(root,scopeId);
  const all=walk(root).rows;
  const max=Math.min(MAX_ITEMS,Math.max(1,Math.floor(limit)||40));
  const items=[],ids=new Set(rows.map(r=>r.id)),seen=new Set();
  const push=item=>{
   if(!item||seen.has(item.id)||items.length>=max)return;
   seen.add(item.id);items.push(item);
  };
  // Existing flashcards are reused as read-only questions. Their SRS cadence
  // must remain untouched by a different quiz workflow.
  for(const c of Array.isArray(studyCards)?studyCards.slice(0,3500):[]){
   if(items.length>=max)break;
   if(c?.sourceTabId!==tabId||!ids.has(c.sourceNodeId)||
      !val(c.question)||!val(c.answer)||!fresh(c))continue;
   push({id:'card:'+String(c.id).slice(0,150),format:'open',origin:'flashcard',
    nodeId:c.sourceNodeId,question:val(c.question).slice(0,240),
    answer:val(c.answer).slice(0,1000)});
  }
  // A direct-child question is objectively verifiable against the stored
  // map topology. This does not claim the distractors are factually false.
  for(const row of rows){
   if(items.length>=max)break;
   const node=row.node,children=node.children||[];
   if(!children.length)continue;
   const correct=children.find(c=>val(c.text));
   if(!correct)continue;
   const childLabels=new Set(children.map(c=>val(c.text).toLocaleLowerCase()));
   const options=[val(correct.text)];
   // Stop after three usable distractors; a deep chain must not trigger an
   // O(nodes squared) full-array filter on every parent.
   for(const alt of all){
    if(alt.id===root.id||alt.id===node.id||alt.parentId===node.id)continue;
    const label=val(alt.node.text);
    if(!label||childLabels.has(label.toLocaleLowerCase()))continue;
    if(!options.some(x=>x.toLocaleLowerCase()===label.toLocaleLowerCase()))options.push(label);
    if(options.length===4)break;
   }
   if(options.length<3)continue;
   const shift=hash(tabId+'|'+node.id)%options.length;
   const rotated=options.slice(shift).concat(options.slice(0,shift));
   push({id:'child:'+tabId+':'+node.id+':'+correct.id,format:'choice',
    origin:'map',nodeId:node.id,
    question:'Quale voce compare come figlia DIRETTA di «'+val(node.text).slice(0,90)+'» nella mappa?',
    answer:val(correct.text).slice(0,300),options:rotated,
    correctIndex:rotated.indexOf(val(correct.text))});
  }
  for(const row of rows){
   if(items.length>=max)break;
   const title=val(row.node.text),notes=val(row.node.notes);
   if(!title||!notes)continue;
   push({id:'notes:'+tabId+':'+row.id,format:'open',origin:'map',
    nodeId:row.id,question:'Cosa riportano gli appunti di «'+title.slice(0,100)+'»?',
    answer:notes.slice(0,1100)});
  }
  // When notes/cards are missing, recall the explicit mapped relationship.
  for(const row of rows){
   if(items.length>=max)break;
   if(row.id===root.id||!row.parentId||!val(row.node.text))continue;
   const parent=index.get(row.parentId)?.node;
   if(!parent)continue;
   push({id:'path:'+tabId+':'+row.id,format:'open',origin:'map',
    nodeId:row.id,question:'Nella mappa, quale concetto completa «'+
     val(parent.text).slice(0,90)+' → …»?',answer:val(row.node.text).slice(0,300)});
  }
  return items;
 }
 function cleanAttempts(raw){
  if(!Array.isArray(raw))return [];
  const out=[];
  for(const a of raw.slice(-MAX_ATTEMPTS)){
   if(!a||!val(a.tabId)||!val(a.nodeId)||!val(a.itemId)||
     !['open','choice'].includes(a.format)||typeof a.correct!=='boolean'||
     !Number.isFinite(a.answeredAt)||a.answeredAt<0)continue;
   out.push({tabId:a.tabId.slice(0,150),nodeId:a.nodeId.slice(0,150),
    itemId:a.itemId.slice(0,300),format:a.format,correct:a.correct,
    answeredAt:a.answeredAt,sourceSignature:val(a.sourceSignature).slice(0,150)});
  }
  return out;
 }
 function addAttempt(attempts,raw,now=Date.now()){
  if(!raw||!val(raw.tabId)||!val(raw.nodeId)||!val(raw.itemId)||
    !['open','choice'].includes(raw.format)||typeof raw.correct!=='boolean'||
    !Number.isFinite(now)||now<0)throw Error('Invalid learning result');
  const appended=cleanAttempts([...(Array.isArray(attempts)?attempts:[]),
    {...raw,answeredAt:now}]);
  return appended;
 }
 function stats(attempts,tabId){
  const rows=cleanAttempts(attempts).filter(a=>a.tabId===tabId);
  const mistakes=rows.filter(a=>!a.correct).length;
  return {answered:rows.length,correct:rows.length-mistakes,mistakes};
 }
 function refsOf(node){
  return Array.isArray(node?.sourceRefs)?node.sourceRefs:(Array.isArray(node?.refs)?node.refs:[]);
 }
 function matchSource(node,claimed){
  if(!claimed||typeof claimed!=='object')return null;
  const sha=String(claimed.sha256||'').toLowerCase();
  const page=Number(claimed.page);
  const name=String(claimed.fileName||'');
  if(!/^[a-f0-9]{64}$/.test(sha)||!Number.isInteger(page)||page<1||page>100000||!name)return null;
  const hit=refsOf(node).find(r=>r&&r.kind==='pdf'&&String(r.sha256||'').toLowerCase()===sha&&
    Number(r.page)===page&&String(r.fileName||'')===name);
  if(!hit)return null;
  return {kind:'pdf',title:val(hit.title||hit.fileName).slice(0,180),
    fileName:String(hit.fileName).slice(0,255),sha256:sha,page,
    quote:val(hit.quote).replace(/\s+/g,' ').slice(0,1800)};
 }
 function nodeSource(node){
  for(const ref of refsOf(node)){const hit=matchSource(node,ref);if(hit)return hit;}
  return null;
 }
 function promptNodes(nodes,{includeNotes=false}={}){
  return (Array.isArray(nodes)?nodes:[]).slice(0,80).map(n=>{
   const row={id:n.id,text:val(n.text).slice(0,180)};
   if(includeNotes&&val(n.notes))row.notes=val(n.notes).slice(0,115);
   const source=nodeSource(n);
   if(source)row.source={fileName:source.fileName,page:source.page,quote:source.quote,sha256:source.sha256};
   return row;
  });
 }
 function acceptQuiz(raw,catalog){
  let data;
  try{data=typeof raw==='string'?JSON.parse(raw):raw;}
  catch(error){const fail=Error('Risposta non valida');fail.code='STUDY_AI_JSON';throw fail;}
  const rows=Array.isArray(data)?data:data&&(data.questions||data.items||data.cards);
  if(!Array.isArray(rows)){const fail=Error('Risposta non valida');fail.code='STUDY_AI_JSON';throw fail;}
  const list=Array.isArray(catalog)?catalog:[];
  const before=JSON.stringify(list);
  const byId=new Map(list.map(n=>[n.id,n]));
  const items=[],rejected=[];
  for(const item of rows.slice(0,40)){
   if(!item||typeof item!=='object'){rejected.push('malformata');continue;}
   const node=byId.get(item.nodeId||item.sourceId||item.sourceNodeId);
   if(!node){rejected.push('nodo');continue;}
   const question=val(item.question).slice(0,240),answer=val(item.answer).slice(0,700);
   if(question.length<7||answer.length<2){rejected.push('breve');continue;}
   let source=null;
   if(item.source&&typeof item.source==='object'){
    source=matchSource(node,item.source);
    if(!source)rejected.push('fonte');
   }
   const options=Array.isArray(item.options)?item.options.map(o=>val(o).slice(0,180)).filter(Boolean).slice(0,6):[];
   const correctIndex=options.indexOf(answer);
   const choice=options.length>=2&&correctIndex>=0;
   if(options.length&&!choice)rejected.push('opzioni');
   items.push({id:'ai:'+node.id+':'+(hash(question+'\n'+answer)>>>0).toString(16),
    format:choice?'choice':'open',origin:'ai',nodeId:node.id,question,answer,
    ...(choice?{options,correctIndex}:{}),
    explanation:val(item.explanation).slice(0,500),source});
  }
  if(JSON.stringify(list)!==before)throw Error('Catalog changed');
  return {items,rejected};
 }
 return Object.freeze({MAX_NODES,MAX_ITEMS,MAX_ATTEMPTS,walk,subtree,
  recallIds,quiz,cleanAttempts,addAttempt,stats,matchSource,nodeSource,promptNodes,acceptQuiz});
});
