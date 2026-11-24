/* NeuroMap 8.2 — read-only dashboard of actual open-map data.
 * No inferred progress, network access, timers, or persistent shadow index.
 */
(function(root,factory){
 const api=factory(root.NeuroMapKnowledgeDB ||
  (typeof module==='object'&&module.exports?require('./knowledge-db-core.js'):null));
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapDashboard82=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(DB){
 'use strict';
 if(!DB?.rows||!DB?.date)throw Error('Knowledge Database 7.6 is required');
 const MAX_ITEMS=80;
 function localDay(now=new Date()){
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('Invalid date');
  return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),
   String(now.getDate()).padStart(2,'0')].join('-');
 }
 function validDay(value){
  const day=DB.date(value);
  const year=Number(day.slice(0,4));
  return day===value&&year>=1900&&year<=2200;
 }
 function plusDays(value,days){
  const d=new Date(value+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
 }
 const cmp=(a,b)=>String(a.dueDate||a.dailyKey||'').localeCompare(String(b.dueDate||b.dailyKey||''))||
  String(a.tabId).localeCompare(String(b.tabId))||String(a.nodeId).localeCompare(String(b.nodeId));
 function snapshot(tabs,{today,limit=40000,maxItems=40}={}){
  if(!validDay(today))throw Error('Dashboard requires an explicit valid local date');
  const max=Math.max(1,Math.min(40000,Number.isFinite(limit)?Math.floor(limit):40000));
  const show=Math.max(1,Math.min(MAX_ITEMS,Number.isFinite(maxItems)?Math.floor(maxItems):40));
  const index=DB.rows(tabs,{limit:max}),records=index.records;
  const skippedTabs=Array.isArray(tabs)&&tabs.length>100&&tabs.slice(100).some(t=>t?.state?.root);
  const keys=new Map(),ambiguous=new Set();
  const roots=new Set((Array.isArray(tabs)?tabs:[]).filter(t=>t?.state?.root)
   .map(t=>JSON.stringify([t.id,t.state.root.id])));
  for(const row of records){
   const k=JSON.stringify([row.tabId,row.nodeId]);
   keys.set(k,(keys.get(k)||0)+1);
   if(keys.get(k)>1)ambiguous.add(k);
  }
  const summary={openMaps:(Array.isArray(tabs)?tabs:[]).filter(t=>t?.state?.root).length,
   nodes:records.length,tagged:0,projects:0,dailyNotes:0,tasks:0,
   todo:0,doing:0,done:0,undated:0,overdue:0,today:0,next7:0,
   ambiguousReferences:ambiguous.size};
  const groups={overdue:[],today:[],next7:[],projects:[],dailyNotes:[]};
  const next7=plusDays(today,7);
  for(const row of records){
   const tags=Array.isArray(row.tags)?row.tags:[];
   const project=tags.some(t=>['progetto','project'].includes(String(t).toLocaleLowerCase()));
   const daily=validDay(row.dailyKey);
   const status=['todo','doing','done'].includes(row.taskStatus)?row.taskStatus:'';
   const due=validDay(row.dueDate)?row.dueDate:'';
   // The map's central topic is not a task (same convention as WorkCore.candidates).
   const task=!roots.has(JSON.stringify([row.tabId,row.nodeId]))&&(!!status||!!due);
   const ref={tabId:row.tabId,nodeId:row.nodeId,title:String(row.title||'').slice(0,200),
    dueDate:due,dailyKey:daily?row.dailyKey:'',taskStatus:status,
    navigable:!ambiguous.has(JSON.stringify([row.tabId,row.nodeId]))&&
     (typeof row.tabId==='string'||Number.isSafeInteger(row.tabId))&&
     typeof row.nodeId==='string'&&row.nodeId.length>0};
   if(tags.length)summary.tagged++;
   if(project){summary.projects++;groups.projects.push(ref)}
   if(daily){summary.dailyNotes++;groups.dailyNotes.push(ref)}
   if(!task)continue;
   summary.tasks++;
   if(status)summary[status]++;
   if(!due&&status!=='done')summary.undated++;
   if(status==='done'||!due)continue;
   if(due<today){summary.overdue++;groups.overdue.push(ref)}
   else if(due===today){summary.today++;groups.today.push(ref)}
   else if(due<=next7){summary.next7++;groups.next7.push(ref)}
  }
  for(const name of Object.keys(groups)){
   groups[name].sort(cmp);
   groups[name]=groups[name].slice(0,show);
  }
  return {today,through:next7,summary,groups,partial:!!index.partial||!!skippedTabs,
   limits:{scanned:max,shownPerGroup:show},source:'open-tabs-only'};
 }
 return Object.freeze({snapshot,localDay,validDay,plusDays,MAX_ITEMS});
});