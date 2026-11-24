/* 7.3: portable, all-day iCalendar events from explicitly dated NeuroMap tasks.
 * No inferred dates, alarms, schedule mutation, network or auto-sync.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapTaskCalendar=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const MAX_TASKS=2000;
 const Work=root.NeuroMapWorkCore;
 function escapeICS(s){
  return String(s??'').replace(/\\/g,'\\\\').replace(/\r\n?|\n/g,'\\n')
   .replace(/;/g,'\\;').replace(/,/g,'\\,');
 }
 function foldLine(line){
  const encoder=new TextEncoder(),chunks=[];let part='',bytes=0;
  for(const char of String(line)){
   const length=encoder.encode(char).length;
   if(bytes+length>75){chunks.push(part);part=' ';bytes=1}
   part+=char;bytes+=length;
  }
  if(part)chunks.push(part);return chunks.join('\r\n');
 }
 function date8(iso){return String(iso).replace(/-/g,'');}
 function nextDate(iso){
  const [y,m,d]=String(iso).split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d)+86400000).toISOString().slice(0,10);
 }
 function signature(input){
  let h=2166136261>>>0,h2=5381>>>0;
  for(const char of String(input)){const x=char.codePointAt(0);h=Math.imul(h^x,16777619)>>>0;h2=(Math.imul(h2,33)+x)>>>0}
  return h.toString(36)+h2.toString(36);
 }
 function inspect(tree){
  if(!Work?.candidates)throw Error('Work view module unavailable');
  const candidates=Work.candidates(tree,MAX_TASKS);
  const entries=[],issues={undated:0,inverted:0};
  for(const row of candidates){
   const start=row.startDate,end=row.dueDate;
   if(!start&&!end){issues.undated++;continue}
   if(start&&end&&start>end){issues.inverted++;continue}
   entries.push({id:row.id,text:row.text||'Attività',path:row.path,status:row.status,
    start:start||end,end:end||start});
  }
  return {entries,issues,candidates:candidates.length};
 }
 function render(tree,{now=new Date()}={}){
  const snapshot=inspect(tree);
  if(!snapshot.entries.length)throw Error('No valid dated tasks to export');
  const stamp=now instanceof Date?now:new Date(now);
  if(!Number.isFinite(stamp.getTime()))throw Error('Invalid export time');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//NeuroMap Architect//Task Calendar 7.3//EN',
   'CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for(const task of snapshot.entries){
   const label=String(task.text||'Attività').replace(/[\u0000-\u001f]/g,' ').trim();
   if(label.length>500)throw Error('Task title exceeds calendar export limit');
   const path=String(task.path||'');if(path.length>2000)throw Error('Task path exceeds calendar export limit');
   const details='NeuroMap activity\\nStatus: '+task.status+'\\nPath: '+path;
   const values=[
    'BEGIN:VEVENT',
    'UID:'+signature(String(tree.id)+'|'+task.id)+'@neuromap.local',
    'DTSTAMP:'+stamp.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'),
    'DTSTART;VALUE=DATE:'+date8(task.start),
    'DTEND;VALUE=DATE:'+date8(nextDate(task.end)),
    'SUMMARY:'+escapeICS(label||'Attività'),
    'DESCRIPTION:'+escapeICS(details.replace(/\\n/g,'\n')),
    'TRANSP:TRANSPARENT',
    'END:VEVENT'
   ];
   lines.push(...values);
  }
  lines.push('END:VCALENDAR');
  const content=lines.map(foldLine).join('\r\n')+'\r\n';
  if(content.length>6*1024*1024)throw Error('Calendar export exceeds 6 MB');
  return {content,count:snapshot.entries.length,issues:snapshot.issues};
 }
 return Object.freeze({inspect,render,escapeICS,foldLine,nextDate});
});
