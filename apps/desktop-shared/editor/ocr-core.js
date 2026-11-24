/* Local OCR contracts: bounded explicit pages, original text and source provenance. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NeuroMapOCRCore=api;})(globalThis,function(){
'use strict';
const MAX_BATCH=5000,MAX_PAGES=10000,MAX_TEXT=45000,MAX_LINES=10000;
function fail(code){const e=Error(code);e.code=code;throw e}
function pages(input,total){
 if(!Number.isInteger(total)||total<1||total>MAX_PAGES)fail('pages');
 const out=new Set(),parts=String(input||'').split(',');
 if(parts.length>MAX_BATCH)fail('batch');
 for(const raw of parts){
  const m=/^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(raw);if(!m)fail('pages');
  const a=Number(m[1]),b=Number(m[2]||a);if(a<1||b<a||b>total)fail('pages');
  if(b-a+1>MAX_BATCH)fail('batch');
  for(let n=a;n<=b;n++){out.add(n);if(out.size>MAX_BATCH)fail('batch')}
 }
 return [...out].sort((a,b)=>a-b);
}
function tsv(input,width,height){
 if(typeof input!=='string'||input.length>8*1024*1024||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)fail('output');
 const rows=input.trim().split(/\r?\n/),head=rows.shift().split('\t');
 const cols=['level','block_num','par_num','line_num','left','top','width','height','conf','text'];
 if(!cols.every(c=>head.includes(c)))fail('output');
 const groups=new Map();
 for(const row of rows){
  const cells=row.split('\t'),get=k=>cells[head.indexOf(k)];
  if(get('level')!=='5'||!String(get('text')||'').trim())continue;
  const x=Number(get('left')),y=Number(get('top')),w=Number(get('width')),h=Number(get('height')),confidence=Number(get('conf'));
  if(![x,y,w,h,confidence].every(Number.isFinite)||Math.min(x,y,w,h)<0||x+w>width+1||y+h>height+1||confidence<0||confidence>100)fail('output');
  const k=['block_num','par_num','line_num'].map(get).join('/');
  const group=groups.get(k)||{text:[],x,y,right:0,bottom:0,scores:[],words:[]};
  group.words.push({text:get('text'),confidence:confidence/100,box:[x/width,y/height,Math.min(w/width,1-x/width),Math.min(h/height,1-y/height)]});group.text.push(get('text'));group.x=Math.min(group.x,x);group.y=Math.min(group.y,y);group.right=Math.max(group.right,x+w);group.bottom=Math.max(group.bottom,y+h);group.scores.push(confidence/100);groups.set(k,group);
  if(groups.size>MAX_LINES)fail('output');
 }
 const lines=[...groups.values()].map(g=>({text:g.text.join(' '),words:g.words,confidence:Math.min(...g.scores),box:[g.x/width,g.y/height,Math.min((g.right-g.x)/width,1-g.x/width),Math.min((g.bottom-g.y)/height,1-g.y/height)]}));
 const text=lines.map(l=>l.text).join('\n');if(text.length>MAX_TEXT||lines.some(l=>l.text.length>1500))fail('output');
 return {text,lines};
}
const UNITS=/\b\d+(?:[.,]\d+)?\s*(?:mmol(?:\/L)?|mcg|mg|ng|pg|ug|kg|g|mmHg|cm|mm|mL|ml|dL|L|UI|IU|µg|μg|%)(?=$|[^\p{L}\p{N}])/giu;
// Conservative painted-image area in PDF user coordinates. Unsupported repeat/
// group operators return unknown; they must not justify skipping OCR.
function imageCoverage(list,ops,view){
 if(!Array.isArray(view)||view.length!==4||!view.every(Number.isFinite)||view[2]<=view[0]||view[3]<=view[1]||!list?.fnArray||list.fnArray.length>200000)return null;
 const area=(view[2]-view[0])*(view[3]-view[1]);let m=[1,0,0,1,0,0],painted=0;const stack=[];
 for(let i=0;i<list.fnArray.length;i++){
  const fn=list.fnArray[i],v=list.argsArray[i];
  if(fn===ops.save){if(stack.length>1000)return null;stack.push(m.slice())}
  else if(fn===ops.restore){if(!stack.length)return null;m=stack.pop()}
  else if(fn===ops.transform){
   if(!Array.isArray(v)||v.length!==6||!v.every(Number.isFinite))return null;
   const [a,b,c,d,e,f]=m,[g,h,j,k,l,n]=v;
   m=[a*g+c*h,b*g+d*h,a*j+c*k,b*j+d*k,a*l+c*n+e,b*l+d*n+f];
  }else if(fn===ops.paintImageXObject||fn===ops.paintInlineImageXObject||fn===ops.paintImageMaskXObject){
   const [a,b,c,d,e,f]=m,x=[e,a+e,c+e,a+c+e],y=[f,b+f,d+f,b+d+f];
   const w=Math.max(0,Math.min(view[2],Math.max(...x))-Math.max(view[0],Math.min(...x)));
   const h=Math.max(0,Math.min(view[3],Math.max(...y))-Math.max(view[1],Math.min(...y)));
   if(!Number.isFinite(w*h))return null;painted+=w*h;
  }else if([ops.paintImageXObjectRepeat,ops.paintInlineImageXObjectGroup,ops.paintImageMaskXObjectGroup,ops.paintImageMaskXObjectRepeat].some(op=>op!==undefined&&fn===op))return null;
 }
 return Math.min(1,painted/area);
}
function warnings(result){return {units:(String(result.text||'').match(UNITS)||[]).slice(0,60),lowConfidence:(result.lines||[]).some(l=>l.confidence==null||l.confidence<.86),empty:!String(result.text||'').trim()}}
function suggestedTitle(text,page,pageLabel='Pagina'){
 const first=String(text||'').split(/\r?\n/).map(s=>s.trim()).find(s=>/\p{L}/u.test(s)&&s.length>=3);
 return first?first.slice(0,79)+(first.length>79?'…':''):pageLabel+' '+page;
}
function outline(results,source,approved,{pageLabel='Pagina',title='Testo dalle scansioni'}={}){
 if(approved!==true)fail('approval');
 if(!source||!source.fileName||!/^[a-f0-9]{64}$/.test(source.sha256||'')||!Array.isArray(results)||!results.length||results.length>MAX_BATCH)fail('source');
 const seen=new Set(),children=[];
 for(const row of results){
  if(!Number.isInteger(row.page)||row.page<1||row.page>MAX_PAGES||seen.has(row.page)||typeof row.edited!=='string'||!row.edited.trim()||row.edited.length>MAX_TEXT)fail('output');
  seen.add(row.page);const text=row.edited;
  children.push({text:typeof row.title==='string'&&row.title.trim()?row.title.trim().slice(0,100):pageLabel+' '+row.page,notes:text,knowledge:{tags:row.method==='native'&&!row.regionEdits?[]:['OCR'],fields:{sourceMethod:{type:'text',value:row.regionEdits?'Tesseract.js 6.0.1 / ita best / region review':row.method==='native'?'PDF.js text':'Tesseract.js 6.0.1 / ita best'},sourceReviewed:{type:'boolean',value:true}},dailyKey:''},sourceRefs:[{id:'src_ocr_'+source.sha256.slice(0,24)+'_'+row.page,kind:'pdf',title:source.fileName,fileName:source.fileName,sha256:source.sha256,page:row.page,quote:text.slice(0,1800),createdAt:new Date().toISOString()}],children:[]});
 }
 return {text:title,children};
}
return Object.freeze({MAX_BATCH,MAX_TEXT,pages,tsv,warnings,suggestedTitle,outline,imageCoverage});
});
