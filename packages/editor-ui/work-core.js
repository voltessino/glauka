/* NeuroMap task/time projections. Missing status/dates remain missing; never inferred. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NeuroMapWorkCore=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const STATUS=Object.freeze(['unassigned','todo','doing','done']);
const MAX_PREDECESSORS=12;
function cleanDependencies(value){
 if(!Array.isArray(value))return [];
 const out=[];
 for(const raw of value.slice(0,100)){
  if(typeof raw!=='string'||!raw||raw.length>140||!/^[A-Za-z0-9_:-]+$/.test(raw))continue;
  if(!out.includes(raw))out.push(raw);
  if(out.length>=MAX_PREDECESSORS)break;
 }
 return out;
}
function dependenciesOf(tree){
 const map=new Map(),stack=[tree],seen=new Set();
 while(stack.length){
  const node=stack.pop();
  if(!node||typeof node!=='object'||seen.has(node))throw Error('Invalid dependency tree');
  seen.add(node);if(seen.size>3500)throw Error('Dependency tree too large');
  if(typeof node.id!=='string'||map.has(node.id))throw Error('Duplicate or missing task IDs');
  map.set(node.id,cleanDependencies(node.taskDependsOn));
  for(const child of node.children||[])stack.push(child);
 }
 return map;
}
function validateDependencies(tree,id,predecessors){
 if(!Array.isArray(predecessors)||predecessors.length>MAX_PREDECESSORS)throw Error('At most 12 predecessors per task');
 if(new Set(predecessors).size!==predecessors.length||
    predecessors.some(x=>typeof x!=='string'||!/^[A-Za-z0-9_:-]{1,140}$/.test(x)))
  throw Error('Invalid or duplicated predecessor ID');
 const graph=dependenciesOf(tree);
 if(!graph.has(id)||id===tree.id)throw Error('Task not found');
 for(const p of predecessors)if(p===id||p===tree.id||!graph.has(p))throw Error('Predecessor must be a different existing task');
 graph.set(id,predecessors);
 const color=new Map();
 function visit(start){
  const stack=[{id:start,exit:false}];
  while(stack.length){
   const {id:cur,exit}=stack.pop();
   if(exit){color.set(cur,2);continue}
   if(color.get(cur)===2)continue;
   if(color.get(cur)===1)throw Error('Dependency cycle is not allowed');
   color.set(cur,1);stack.push({id:cur,exit:true});
   for(const p of graph.get(cur)||[])if(graph.has(p)&&color.get(p)!==2)stack.push({id:p,exit:false});
  }
 }
 for(const node of graph.keys())if(!color.has(node))visit(node);
 return predecessors.slice();
}
function status(value){return ['todo','doing','done'].includes(value)?value:'unassigned'}
const taskOrder=value=>Number.isInteger(value)&&value>=0&&value<2000?value:null;
function sortedKanbanGroup(candidates,stage){
 return candidates.filter(n=>n.status===stage).sort((a,b)=>{
  const x=a.taskOrder,y=b.taskOrder;
  if(x===null&&y===null)return 0;
  if(x===null)return 1;
  if(y===null)return -1;
  return x-y;
 });
}
// Plans an atomic canonical task change; no hierarchy reorder and no mutation.
function planKanbanMove(tree,id,nextStatus,beforeId=null){
 if(typeof id!=='string'||!id||!STATUS.includes(nextStatus)||
    (beforeId!==null&&(typeof beforeId!=='string'||!beforeId)))return null;
 const all=candidates(tree),moving=all.find(n=>n.id===id);
 if(!moving||moving.id===tree.id||beforeId===id)return null;
 const oldGroup=sortedKanbanGroup(all,moving.status);
 const target=sortedKanbanGroup(all,nextStatus).filter(n=>n.id!==id);
 if(beforeId!==null&&!target.some(n=>n.id===beforeId))return null;
 const position=beforeId===null?target.length:target.findIndex(n=>n.id===beforeId);
 target.splice(position,0,moving);
 if(nextStatus===moving.status&&target.length===oldGroup.length&&
    target.every((n,i)=>n.id===oldGroup[i].id))return null;
 const changes=[];
 for(let i=0;i<target.length;i++){
  const task=target[i];
  if(task.id===moving.id||task.taskOrder!==i)
   changes.push({id:task.id,
    ...(task.id===moving.id&&moving.status!==nextStatus?{taskStatus:nextStatus}:{}),
    taskOrder:i});
 }
 return {id,from:moving.status,to:nextStatus,beforeId,
  changes,orderedIds:target.map(n=>n.id)};
}
function parseDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const [year,month,day]=value.split('-').map(Number);
 if(year<1900||year>2200)return null;
 const date=Date.UTC(year,month-1,day);
 if(!Number.isFinite(date))return null;
 const d=new Date(date);
 if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)return null;
 return value;
}
const dayNum=value=>Date.parse(value+'T00:00:00Z')/86400000;
const TIMELINE_SCALES=Object.freeze(['auto','days','weeks','months']);
function timelineTicks(first,last,unit,scale){
  if(scale==='auto'){
    // Retain the legacy endpoint semantics of existing documents.
    const tickDays=[first],step=Math.ceil(112/unit);
    for(let day=first+step;day<last;day+=step)if((last-day)*unit>=112)tickDays.push(day);
    if(last!==first)tickDays.push(last);
    return tickDays.map((day,i)=>({date:new Date(day*86400000).toISOString().slice(0,10),
      x:300+(day-first)*unit,anchor:i===0&&last!==first?'end':i===tickDays.length-1?'start':'middle'}));
  }
  const days=[first],minDistance=140;
  if(scale==='months'){
    const start=new Date(first*86400000);
    const monthStride=Math.max(1,Math.ceil(minDistance/(30*unit)));
    let year=start.getUTCFullYear(),month=start.getUTCMonth()+1;
    // The first aligned tick is the first day of the following month.
    if(month===12){year++;month=0}
    for(let i=0;i<125&&year<=2201;i++){
      const day=Date.UTC(year,month,1)/86400000;
      if(day>=last)break;
      if((day-first)*unit>=minDistance&&(last-day)*unit>=minDistance)days.push(day);
      month+=monthStride;year+=Math.floor(month/12);month%=12;
    }
  }else{
    const stride=scale==='weeks'?
      7*Math.max(1,Math.ceil(minDistance/(unit*7))):Math.max(1,Math.ceil(minDistance/unit));
    // Weekly dates follow calendar Monday, daily dates follow a regular grid.
    const firstWeekday=new Date(first*86400000).getUTCDay();
    const offset=scale==='weeks'?(8-firstWeekday)%7:0;
    for(let day=first+offset+(offset===0?stride:0);day<last;day+=stride)
      if((day-first)*unit>=minDistance&&(last-day)*unit>=minDistance)days.push(day);
  }
  if(last!==first){
    // Do not stack the final tick label on the prior one.
    if(days.length>1&&(last-days.at(-1))*unit<minDistance)days.pop();
    days.push(last);
  }
  return days.map((day,i)=>{
    const date=new Date(day*86400000).toISOString().slice(0,10);
    const interior=i>0&&i<days.length-1;
    return {date,label:scale==='months'&&interior?date.slice(0,7):date,
      x:300+(day-first)*unit,anchor:i===0&&last!==first?'end':i===days.length-1?'start':'middle'};
  });
}
function candidates(tree,maxNodes=2000){
 if(!tree||typeof tree!=='object'||typeof tree.id!=='string')throw Error('Missing map root');
 const out=[],seen=new Set(),ids=new Set(),stack=[{node:tree,depth:0,path:[]}];
 while(stack.length){
  const {node,depth,path}=stack.pop();
  if(!node||typeof node.id!=='string'||!node.id||ids.has(node.id)||seen.has(node))throw Error('Invalid map hierarchy');
  seen.add(node);ids.add(node.id);
  if(seen.size>maxNodes)throw Error('Map too large');
  if(depth>0)out.push({id:node.id,text:String(node.text??''),status:status(node.taskStatus),
   startDate:parseDate(node.startDate),dueDate:parseDate(node.dueDate),taskOrder:taskOrder(node.taskOrder),dependsOn:cleanDependencies(node.taskDependsOn),depth,
   path:path.concat(String(node.text??'')).slice(-4).join(' › ')});
  const next=path.concat(String(node.text??''));
  const children=Array.isArray(node.children)?node.children:[];
  for(let i=children.length-1;i>=0;i--)stack.push({node:children[i],depth:depth+1,path:next});
 }
 return out;
}
function project(tree,mode,opts={}){
 if(mode!=='kanban'&&mode!=='timeline')throw Error('Unsupported work view');
 const all=candidates(tree,Math.min(2000,Math.max(2,Number(opts.maxNodes)||1500)));
 if(mode==='kanban'){
  const order=STATUS,groups=order.map(key=>sortedKanbanGroup(all,key));
  const nodes=[],columns=order.map((id,index)=>({id,x:135+index*235,width:214,count:groups[index].length}));
  const ROW_STEP=118,CARD_HEIGHT=100;
  for(let col=0;col<groups.length;col++)for(let row=0;row<groups[col].length;row++){
   const n=groups[col][row];nodes.push({...n,x:135+col*235,y:159+row*ROW_STEP,
    w:207,h:CARD_HEIGHT,column:col,row});
  }
  return {mode,nodes,edges:[],columns,width:1015,height:Math.max(400,260+Math.max(0,Math.max(...groups.map(x=>x.length))-1)*ROW_STEP),candidates:all,
   unassigned:groups[0].length,missingDates:all.filter(n=>!n.startDate&&!n.dueDate).length};
 }
 // Dates must be explicit: no implicit "today", durations or ordering from tree.
 const dated=all.filter(n=>n.startDate||n.dueDate)
   .filter(n=>!n.startDate||!n.dueDate||n.startDate<=n.dueDate)
   // Stable sort preserves source order on equal dates without repeated tree searches.
   .sort((a,b)=>String(a.startDate||a.dueDate).localeCompare(String(b.startDate||b.dueDate)));
 if(!dated.length)return {mode,nodes:[],edges:[],columns:[],width:850,height:320,candidates:all,empty:true,missingDates:all.length};
 const first=Math.min(...dated.map(n=>dayNum(n.startDate||n.dueDate)));
 const last=Math.max(...dated.map(n=>dayNum(n.dueDate||n.startDate)));
 if(last-first>3650)throw Error('Timeline spans more than ten years');
 const requested=TIMELINE_SCALES.includes(opts.timeScale)?opts.timeScale:'auto';
 const naturalUnit=requested==='days'?28:requested==='weeks'?12:
   requested==='months'?4:last-first>730?5:last-first>180?9:14;
 // Guard against a 10-year timeline expanding to hundreds of thousands of
 // CSS pixels when "days" is selected. Dates keep their true distances.
 const unit=Math.min(naturalUnit,18000/Math.max(1,last-first+2));
 const ticks=timelineTicks(first,last,unit,requested);
 const countByStart=new Map();
 for(const n of dated){
  const date=n.startDate||n.dueDate;
  countByStart.set(date,(countByStart.get(date)||0)+1);
 }
 const indexByStart=new Map();
 const nodes=dated.map((n,index)=>{
  const date=n.startDate||n.dueDate,start=dayNum(date),end=dayNum(n.dueDate||n.startDate);
  const width=Math.max(start===end?28:18,(end-start+1)*unit);
  const startGroupIndex=indexByStart.get(date)||0;
  indexByStart.set(date,startGroupIndex+1);
  return {...n,x:300+(start-first)*unit+width/2,y:122+index*64,w:width,h:28,
   milestone:start===end,startGroupIndex,startGroupCount:countByStart.get(date)};
 });
 const drawn=new Set(nodes.map(n=>n.id)),lookup=new Map(nodes.map(n=>[n.id,n]));
 const edges=[];
 for(const n of nodes)for(const predecessor of n.dependsOn||[])
   if(drawn.has(predecessor)){
    const earlier=lookup.get(predecessor);
    // A single-date predecessor is a milestone, not an undated task.
    // Its explicit start date is also its only known calendar point.
    const predecessorEnd=earlier?.dueDate||earlier?.startDate;
    const successorStart=n.startDate||n.dueDate;
    edges.push({fromId:predecessor,toId:n.id,type:'dependency',
     conflict:Boolean(predecessorEnd&&successorStart&&predecessorEnd>=successorStart)});
   }
 return {mode,nodes,edges,columns:[],ticks,width:Math.max(850,350+(last-first+2)*unit),
  height:Math.max(330,170+dated.length*64),candidates:all,empty:false,
  missingDates:all.length-dated.length,timeScale:requested,pxPerDay:unit,
  requestedPxPerDay:naturalUnit,scaleLimited:requested!=='auto'&&unit<naturalUnit,
  minDate:new Date(first*86400000).toISOString().slice(0,10),
  maxDate:new Date(last*86400000).toISOString().slice(0,10)};
}
return Object.freeze({STATUS,status,taskOrder,sortedKanbanGroup,planKanbanMove,TIMELINE_SCALES,timelineTicks,parseDate,candidates,project,cleanDependencies,validateDependencies,dependenciesOf,MAX_PREDECESSORS});
});
