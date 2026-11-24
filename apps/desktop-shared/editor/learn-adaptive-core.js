/* NeuroMap 6.19.1 Adaptive Learning — offline and evidence-only.
 * Observed outcomes stay distinct from planning heuristics. No model calls,
 * no node mutations, no invented mastery or clinical study claims.
 */
(function(root,factory){
 const api=factory(root.NeuroMapLearningCore ||
  (typeof module==='object'&&module.exports?require('./learn-core.js'):null));
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapAdaptiveCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(L){
 'use strict';
 if(!L)throw Error('NeuroMap Learning Core must load first');
 const MINUTE=60000,DAY=86400000,MAX_PLANS=80,MAX_DAYS=180;
 const str=x=>typeof x==='string'?x.trim():'';
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 function validDay(value){
  const s=str(value);
  if(!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s))return '';
  const [y,m,d]=s.split('-').map(Number);
  const stamp=Date.UTC(y,m-1,d);
  return new Date(stamp).toISOString().slice(0,10)===s?s:'';
 }
 function dayNumber(value){
  if(!validDay(value))return NaN;
  const [y,m,d]=value.split('-').map(Number);
  return Date.UTC(y,m-1,d)/DAY;
 }
 function dayString(now=Date.now()){
  if(!Number.isFinite(now))throw Error('Invalid clock');
  const d=new Date(now);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),
   String(d.getDate()).padStart(2,'0')].join('-');
 }
 function dayAt(n){
  return new Date(n*DAY).toISOString().slice(0,10);
 }
 function cleanPlans(data){
  const out=[],seen=new Set();
  for(const p of Array.isArray(data)?data.slice(-500):[]){
   const tabId=str(p?.tabId),examDate=validDay(p?.examDate);
   const minutes=Number(p?.minutesPerDay);
   if(!tabId||tabId.length>150||!examDate||!Number.isInteger(minutes)||
      minutes<10||minutes>180)continue;
   if(seen.has(tabId)){
    const i=out.findIndex(v=>v.tabId===tabId);if(i>=0)out.splice(i,1);
   }
   seen.add(tabId);
   out.push({tabId,examDate,minutesPerDay:minutes,
    updatedAt:Number.isFinite(p.updatedAt)&&p.updatedAt>=0?
     Math.floor(p.updatedAt):0});
  }
  return out.slice(-MAX_PLANS);
 }
 function setPlan(data,raw,now=Date.now()){
  const candidate=cleanPlans([{...raw,updatedAt:now}]);
  if(candidate.length!==1)throw Error('Exam plan must have valid date and 10-180 daily minutes');
  return cleanPlans([...(Array.isArray(data)?data:[]).filter(x=>x?.tabId!==candidate[0].tabId),
   candidate[0]]);
 }
 function radar(tree,{tabId='',attempts=[],cards=[],signatureFor=null,
  freshCard=null,now=Date.now()}={}){
  const structure=L.walk(tree),lookup=structure.index;
  const groups=new Map(),stale=new Map(),cardGroups=new Map();
  const add=(map,id,item)=>{if(!map.has(id))map.set(id,[]);map.get(id).push(item)};
  for(const a of L.cleanAttempts(attempts)){
   if(a.tabId!==tabId||!lookup.has(a.nodeId))continue;
   const node=lookup.get(a.nodeId).node;
   // Each 6.19 attempt contains an immutable content signature. A changed
   // source must never contribute to a current success/failure assessment.
   if(typeof signatureFor==='function'&&a.sourceSignature&&
      a.sourceSignature!==signatureFor(node))add(stale,a.nodeId,a);
   else if(typeof signatureFor==='function'&&!a.sourceSignature)add(stale,a.nodeId,a);
   else add(groups,a.nodeId,a);
  }
  for(const c of Array.isArray(cards)?cards.slice(0,3500):[]){
   if(c?.sourceTabId!==tabId||!lookup.has(c.sourceNodeId))continue;
   if(typeof freshCard==='function'&&!freshCard(c))continue;
   add(cardGroups,c.sourceNodeId,c);
  }
  const totals={nodes:structure.rows.length,attempts:0,correct:0,mistakes:0,
   stale:0,needsReview:0,recovering:0,reviewed:0,unreviewed:0,dueCards:0};
  const nodes=[];
  for(const row of structure.rows){
   const history=(groups.get(row.id)||[]).slice().sort((a,b)=>a.answeredAt-b.answeredAt);
   const older=stale.get(row.id)||[],linked=cardGroups.get(row.id)||[];
   const wrong=history.filter(a=>!a.correct).length,right=history.length-wrong;
   const latest=history.at(-1)||null;
   let streak=0;for(let j=history.length-1;j>=0&&history[j].correct;j--)streak++;
   let dueCards=0,nextCardDue=null;
   for(const c of linked){
    const due=Number(c?.sr?.dueAt);
    if(Number.isFinite(due)&&due>0){
     if(nextCardDue===null||nextCardDue>due)nextCardDue=due;
     if(due<=now)dueCards++;
    }
   }
   const status=!history.length?'unreviewed':
    latest.correct?(wrong?'recovering':'reviewed'):'needs-review';
   // Suggested practice is a transparent study heuristic, NOT a mastery score
   // or an actual SRS due date. SRS scheduling stays controlled by flashcards.
   const suggestedAt=latest?
    latest.answeredAt+(latest.correct?(streak>=2?3:1)*DAY:0):null;
   const dueSuggested=suggestedAt!==null&&suggestedAt<=now;
   // Priority order from observable mistakes/due cards, not AI inference.
   const priority=(status==='needs-review'?100:status==='recovering'?55:0)+
    Math.min(wrong,15)*3+(dueCards?40:0)+(dueSuggested?12:0)+
    (status==='unreviewed'?8:0);
   const item={nodeId:row.id,text:String(row.node.text||''),depth:row.depth,
    status,attempts:history.length,correct:right,mistakes:wrong,
    staleAttempts:older.length,lastAt:latest?.answeredAt||null,
    lastCorrect:latest?.correct??null,consecutiveCorrect:streak,
    dueCards,nextCardDue,suggestedAt,dueSuggested,priority};
   nodes.push(item);
   totals.attempts+=history.length;totals.correct+=right;
   totals.mistakes+=wrong;totals.stale+=older.length;
   totals.dueCards+=dueCards;
   totals[status==='needs-review'?'needsReview':status]++;
  }
  // The root is normally only a document container. However, when a real
  // quiz attempt or scheduled flashcard targets it, omitting it would hide
  // observed learning activity from the exam plan (notably Markdown imports).
  const ranked=nodes.filter(n=>(n.depth>0||n.attempts>0||n.nextCardDue!==null)&&
   n.text.trim()).sort((a,b)=>
   b.priority-a.priority||a.depth-b.depth||a.nodeId.localeCompare(b.nodeId));
  return {tabId,nodes,totals,ranked,now,byId:new Map(nodes.map(x=>[x.nodeId,x]))};
 }
 function prioritizeQuiz(items,report){
  const list=Array.isArray(items)?items:[];
  const score=id=>report?.byId?.get(id)?.priority||0;
  return list.map((item,i)=>({item,i})).sort((a,b)=>
   score(b.item.nodeId)-score(a.item.nodeId)||a.i-b.i).map(r=>r.item);
 }
 function schedule(report,plan,now=Date.now()){
  const date=validDay(plan?.examDate),minutes=Number(plan?.minutesPerDay);
  if(!date||!Number.isInteger(minutes)||minutes<10||minutes>180)
   throw Error('Invalid exam plan');
  const today=dayNumber(dayString(now)),exam=dayNumber(date);
  if(exam<today)throw Error('Exam date has already passed');
  const days=clamp(exam-today+1,1,MAX_DAYS),truncated=exam-today+1>MAX_DAYS;
  const candidates=(report?.ranked||[]).slice(0,500);
  const slots=clamp(Math.floor(minutes/7),1,20);
  const daily=[],dueAssigned=new Set();
  for(let i=0;i<days;i++){
   const date=dayAt(today+i),selection=[],todaySelected=new Set();
   const add=(item,reason)=>{
    if(todaySelected.has(item.nodeId)||selection.length>=slots)return;
    todaySelected.add(item.nodeId);
    selection.push({nodeId:item.nodeId,text:item.text,reason,
     attempts:item.attempts,mistakes:item.mistakes});
   };
   // Respect actual flashcard due dates where available: a future due
   // card appears on (or after) its date, not prematurely in the schedule.
   const due=candidates.filter(x=>x.nextCardDue!==null&&
    Number.isFinite(x.nextCardDue)&&x.nextCardDue>0&&
    dayNumber(dayString(x.nextCardDue))<=today+i&&!dueAssigned.has(x.nodeId))
    .sort((x,y)=>x.nextCardDue-y.nextCardDue||y.priority-x.priority);
   for(const item of due){
    if(selection.length>=slots)break;
    add(item,'due-flashcard');dueAssigned.add(item.nodeId);
   }
   if(candidates.length){
    // Rotate everyday practice over all candidate IDs while preserving
    // capacity for overdue real flashcards.
    const offset=(i*slots)%candidates.length;
    for(let j=0;j<candidates.length&&selection.length<slots;j++){
     const item=candidates[(offset+j)%candidates.length];
     add(item,item.status==='needs-review'?'mistake':
      item.status==='unreviewed'?'not-yet-tested':
      item.status==='recovering'?'previous-mistake':'practice');
    }
   }
   daily.push({date,minutesPerDay:minutes,
    estimatedMinutes:Math.min(minutes,selection.length*7),items:selection});
  }
  return {examDate:date,daysUntilExam:exam-today,days:daily,truncated,
   candidates:candidates.length,minutesPerDay:minutes};
 }
 return Object.freeze({validDay,dayNumber,dayString,cleanPlans,setPlan,
  radar,prioritizeQuiz,schedule,MAX_DAYS,MAX_PLANS});
});
