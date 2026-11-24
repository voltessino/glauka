/* NeuroMap 7.6 Knowledge Database — portable, bounded node metadata.
 * Stored inline on the existing logical node; no shadow database and no sync.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapKnowledgeDB=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_TAGS=16,MAX_FIELDS=20,MAX_ROWS=40000,MAX_VIEW=1000,MAX_NOTE=50000;
 const KEY=/^[\p{L}\p{N}_ -]{1,40}$/u;
 const RESERVED=new Set(['__proto__','constructor','prototype']);
 const DATE=/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
 const clean=x=>String(x??'').normalize('NFKC').trim().replace(/\s+/g,' ');
 const fold=x=>clean(x).toLocaleLowerCase();
 function date(x){
  const v=clean(x);
  if(!DATE.test(v))return '';
  const d=new Date(v+'T12:00:00Z');
  return Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==v?'':v;
 }
 function tag(v){const t=clean(v).replace(/^#+/,'').slice(0,48);
  return /^[\p{L}\p{N}_ -]{1,48}$/u.test(t)?t:'';}
 function tags(input){
  const source=Array.isArray(input)?input:typeof input==='string'?input.split(','):[];
  const values=[],seen=new Set();
  for(const raw of source.slice(0,128)){
   const t=tag(raw),key=fold(t);if(!t||seen.has(key))continue;seen.add(key);values.push(t);
   if(values.length>=MAX_TAGS)break;
  }
  return values;
 }
 function key(v){const k=clean(v);
  return KEY.test(k)&&!RESERVED.has(k.toLowerCase())?k:''}
 function typed(type,value){
  if(type==='boolean'){
   if(value===true||value==='true'||value===1)return {type,value:true};
   if(value===false||value==='false'||value===0)return {type,value:false};
   return null;
  }
  if(type==='number'){const n=Number(value);return Number.isFinite(n)&&String(value).trim()!==''&&Math.abs(n)<=1e12?{type,value:n}:null}
  if(type==='date'){const d=date(value);return d?{type,value:d}:null}
  if(type==='text'){return {type,value:String(value??'').slice(0,240)}}
  return null;
 }
 function fields(input){
  const result=Object.create(null);
  if(!input||typeof input!=='object'||Array.isArray(input))return result;
  let count=0;
  for(const [name,entry] of Object.entries(input).slice(0,120)){
   const k=key(name);if(!k||Object.prototype.hasOwnProperty.call(result,k))continue;
   const value=entry&&typeof entry==='object'&&!Array.isArray(entry)
     ?typed(entry.type,entry.value):typed('text',entry);
   if(!value)continue;
   result[k]=value;if(++count>=MAX_FIELDS)break;
  }
  return result;
 }
 function normalize(input){
  const value=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  return {tags:tags(value.tags),fields:fields(value.fields),dailyKey:date(value.dailyKey)};
 }
 function equal(a,b){return JSON.stringify(normalize(a))===JSON.stringify(normalize(b))}
 function update(state,nodeId,data){
  const node=state?.findNode?.(nodeId);if(!node)throw Error('Missing node');
  const next=normalize(data);
  if(equal(node.knowledge,next))return false;
  state.pushHistory();node.knowledge=next;return true;
 }
 const TEMPLATES=Object.freeze({
  study:{label:'Studio / Study',tags:['Studio'],fields:{materia:{type:'text',value:''},difficolta:{type:'number',value:1}},note:'## Obiettivi\n\n## Concetti chiave\n\n## Fonti\n\n## Ripasso\n'},
  clinical:{label:'Scheda clinica / Clinical',tags:['Clinica'],fields:{sistema:{type:'text',value:''},priorita:{type:'text',value:''}},note:'## Definizione\n\n## Fisiopatologia\n\n## Segni e sintomi\n\n## Accertamento\n\n## Interventi\n\n## Fonti\n'},
  project:{label:'Progetto / Project',tags:['Progetto'],fields:{responsabile:{type:'text',value:''},stato:{type:'text',value:'Da fare'}},note:'## Obiettivo\n\n## Attività\n\n## Rischi\n\n## Decisioni\n'},
  meeting:{label:'Riunione / Meeting',tags:['Riunione'],fields:{data:{type:'date',value:'2026-10-23'},partecipanti:{type:'text',value:''}},note:'## Ordine del giorno\n\n## Decisioni\n\n## Azioni\n'},
  daily:{label:'Diario / Daily',tags:['Diario'],fields:{},note:'## Cosa ho studiato\n\n## Collegamenti\n\n## Da ripassare\n\n## Note\n'}
 });
 function templates(){return Object.keys(TEMPLATES).map(id=>({id,label:TEMPLATES[id].label}))}
 function applyTemplate(state,nodeId,templateId,{today=''}={}){
  const entry=TEMPLATES[templateId];if(!entry)throw Error('Unknown template');
  const node=state?.findNode?.(nodeId);if(!node)throw Error('Missing node');
  const prior=normalize(node.knowledge),next=normalize(prior);
  next.tags=tags([...prior.tags,...entry.tags]);
  for(const [name,field] of Object.entries(entry.fields)){
   if(!Object.prototype.hasOwnProperty.call(next.fields,name)){
    next.fields[name]=field.type==='date'&&date(today)?{type:'date',value:date(today)}:{...field};
   }
  }
  const notes=String(node.notes||'');
  // Templates never silently overwrite existing user-authored Markdown.
  const writeNotes=!notes.trim()&&entry.note;
  const changed=!equal(prior,next)||!!writeNotes;
  if(!changed)return false;
  state.pushHistory();node.knowledge=normalize(next);
  if(writeNotes)node.notes=entry.note;
  return true;
 }
 function createDaily(state,layoutEngine,localDate){
  const keyDate=date(localDate);if(!keyDate)throw Error('Invalid calendar date');
  if(!state?.root?.id||!state.addChildNode)throw Error('Invalid map');
  const stack=[state.root],seen=new Set();let count=0;
  while(stack.length){
   const n=stack.pop();if(!n||seen.has(n))continue;seen.add(n);count++;
   if(normalize(n.knowledge).dailyKey===keyDate)return {node:n,created:false};
   for(const c of n.children||[])stack.push(c);
  }
  if(count>=3500)throw Error('Maximum 3500 nodes reached');
  const node=state.addChildNode(state.root.id,layoutEngine,'Diario · '+keyDate);
  if(!node)throw Error('Unable to create daily note');
  const entry=TEMPLATES.daily;
  node.text='Diario · '+keyDate;
  node.notes=entry.note;
  node.knowledge={tags:[...entry.tags],fields:Object.create(null),dailyKey:keyDate};
  return {node,created:true};
 }
 function rows(tabs,{limit=MAX_ROWS}={}){
  const result=[],max=Math.max(1,Math.min(MAX_ROWS,Number(limit)||MAX_ROWS));
  let partial=false;
  for(const t of Array.isArray(tabs)?tabs.slice(0,100):[]){
   if(!t?.state?.root)continue;
   const stack=[t.state.root],seen=new Set();
   while(stack.length){
    const n=stack.pop();if(!n||typeof n!=='object'||seen.has(n)){partial=true;continue}
    seen.add(n);
    if(result.length>=max){partial=true;break}
    const m=normalize(n.knowledge);
    result.push({tabId:t.id,nodeId:n.id,title:String(n.text||''),notes:String(n.notes||'').slice(0,600),
     tags:m.tags,fields:m.fields,dailyKey:m.dailyKey,
     taskStatus:n.taskStatus||'',dueDate:date(n.dueDate)});
    for(let i=(n.children||[]).length-1;i>=0;i--)stack.push(n.children[i]);
   }
  }
  return {records:result,partial};
 }
 function filter(index,{query='',tag:tagFilter='',field='',value='',status='',order='title',max=MAX_VIEW}={}){
  const results=[],needle=fold(query),wantedTag=fold(tagFilter),wantedValue=fold(value),wantedField=key(field);
  const bound=Math.min(MAX_VIEW,Math.max(1,Number(max)||MAX_VIEW));
  for(const item of index?.records||[]){
   if(needle&&!fold(item.title+' '+item.notes+' '+item.tags.join(' ')).includes(needle))continue;
   if(wantedTag&&!item.tags.some(t=>fold(t)===wantedTag))continue;
   if(status&&item.taskStatus!==status)continue;
   if(wantedField){
    const fieldValue=item.fields[wantedField];
    if(!fieldValue||(wantedValue&&!fold(fieldValue.value).includes(wantedValue)))continue;
   }
   results.push(item);
  }
  results.sort((a,b)=>{
   const ax=order==='due'?a.dueDate:order==='daily'?a.dailyKey:a.title;
   const bx=order==='due'?b.dueDate:order==='daily'?b.dailyKey:b.title;
   const aa=String(ax||'\uffff'),bb=String(bx||'\uffff');
   return aa.localeCompare(bb)||String(a.title).localeCompare(String(b.title));
  });
  return {items:results.slice(0,bound),total:results.length,partial:!!index?.partial||results.length>bound};
 }
 return Object.freeze({MAX_TAGS,MAX_FIELDS,MAX_ROWS,MAX_VIEW,normalize,tags,fields,tag,key,date,typed,
  update,equal,templates,applyTemplate,createDaily,rows,filter});
});
