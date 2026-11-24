/* Bounded geometry-based document structure. Suggestions, never semantic synthesis. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NeuroMapOCRStructure=api;})(globalThis,function(){
'use strict';
const MAX_BLOCKS=400,MAX_TEXT=45000,MAX_LINES=10000;
const median=a=>{const s=a.slice().sort((a,b)=>a-b);return s[Math.floor((s.length-1)/2)]||0};
const roles=new Set(['heading','paragraph','list','table']);
function classify(line,bodyHeight){
 const text=line.text.trim(),height=(line.layoutBox||line.box)?.[3]||0,ratio=bodyHeight?height/bodyHeight:1;
 if(text.includes('\t'))return {role:'table',level:0};
 const numbered=/^(\d+(?:\.\d+){0,2})[.)]?\s+(\p{Lu}[^\n]{2,110})$/u.exec(text);
 if(text.length<=120&&ratio>=1.32)return {role:'heading',level:ratio>=1.8?1:2};
 if(numbered&&!/\b(?:mg|µg|μg|mmol|mL|mmHg|UI|IU)\b/u.test(text))return {role:'heading',level:Math.min(3,numbered[1].split('.').length)};
 if(/^\s*(?:[*•▪◦–-]|\d+[.)])\s+\S/u.test(text))return {role:'list',level:0};
 return {role:'paragraph',level:0};
}
function analyze(text,lines=[]){
 if(typeof text!=='string'||text.length>MAX_TEXT||!Array.isArray(lines)||lines.length>MAX_LINES)throw Error('Invalid document structure input');
 // Geometry is used only for exact text alignment; edits never inherit stale boxes.
 const parts=text.split('\n'),nonempty=parts.filter(s=>s.trim()),geometry=lines.length===nonempty.length&&nonempty.every((s,i)=>s===lines[i].text),heights=geometry?lines.filter(l=>l.text.trim()).map(l=>(l.layoutBox||l.box)?.[3]).filter(h=>Number.isFinite(h)&&h>0):[];
 const bodyHeight=median(heights),blocks=[];let offset=0,lineIndex=0;
 for(let i=0;i<parts.length;i++){
  const s=parts[i],start=offset;offset+=s.length+1;if(!s.trim())continue;
  const line=geometry?lines[lineIndex++]:{text:s},type=classify(line,bodyHeight),previous=blocks.at(-1),box=line.box;
  // Adjacent prose belongs to one paragraph only when geometry supports continuity.
  const pb=geometry?lines[lineIndex-2]?.box:null,close=box&&pb&&Math.abs(box[0]-pb[0])<.035&&box[1]-pb[1]<=Math.max(box[3],pb[3])*1.9&&box[1]>=pb[1];
  if(type.role==='paragraph'&&previous?.role==='paragraph'&&previous.end===start-1&&close){previous.end=start+s.length;previous.text=text.slice(previous.start,previous.end);continue}
  if(blocks.length>=MAX_BLOCKS)return {schemaVersion:'ocr-structure/v1',text,blocks:[],geometry,partial:true,reason:'block-budget'};
  blocks.push({id:'block-'+blocks.length,role:type.role,level:type.level,start,end:start+s.length,text:s,title:s.trim().slice(0,100),box:box?.slice()||null});
 }
 return {schemaVersion:'ocr-structure/v1',text,blocks,geometry,partial:false,bodyHeight};
}
function validate(proposal,text){
 if(!proposal||proposal.schemaVersion!=='ocr-structure/v1'||proposal.partial||proposal.text!==text||!Array.isArray(proposal.blocks)||proposal.blocks.length>MAX_BLOCKS)throw Error('Structure is stale or exceeds budget');
 let end=0;const ids=new Set();
 for(const b of proposal.blocks){
  if(!b||typeof b.id!=='string'||ids.has(b.id)||!roles.has(b.role)||!Number.isInteger(b.start)||!Number.isInteger(b.end)||b.start<end||b.end<=b.start||b.end>text.length||text.slice(b.start,b.end)!==b.text||text.slice(end,b.start).trim()||typeof b.title!=='string'||b.title.length>100||!b.title.trim()||!Number.isInteger(b.level)||(b.role==='heading'?(b.level<1||b.level>3):b.level!==0))throw Error('Invalid document block');
  ids.add(b.id);end=b.end;
 }
 if(text.slice(end).trim())throw Error('Structure omits source text');return true;
}
function children(proposal,text,pageNode){
 validate(proposal,text);const out=[],stack=[{level:0,children:out}];
 for(const b of proposal.blocks){
  const n={text:b.title,notes:b.text,children:[],knowledge:JSON.parse(JSON.stringify(pageNode.knowledge)),sourceRefs:pageNode.sourceRefs.map(r=>({...r,id:r.id+'_'+b.id,quote:b.text.slice(0,1800)}))};
  if(b.role==='heading'){while(stack.length>1&&stack.at(-1).level>=b.level)stack.pop();stack.at(-1).children.push(n);stack.push({level:b.level,children:n.children})}
  else stack.at(-1).children.push(n);
 }
 return out;
}
function nativeLines(content,viewport){
 if(!content||!Array.isArray(content.items)||content.items.length>60000||!viewport||!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||!Array.isArray(viewport.transform))throw Error('Invalid PDF geometry');
 const v=viewport.transform,lines=[];let current=null;
 const project=(x,y)=>[v[0]*x+v[2]*y+v[4],v[1]*x+v[3]*y+v[5]];
 for(const item of content.items){
  if(typeof item?.str!=='string'||!item.str.trim()||!Array.isArray(item.transform)||item.transform.length!==6||!item.transform.every(Number.isFinite))continue;
  const [a,b,c,d,x,y]=item.transform,h=Math.hypot(c,d)||item.height,w=Number(item.width);if(!Number.isFinite(w)||!Number.isFinite(h)||h<=0)continue;
  const len=Math.hypot(a,b)||1,ux=a/len,uy=b/len,pts=[[x,y],[x+w*ux,y+w*uy],[x-uy*h,y+ux*h],[x+w*ux-uy*h,y+w*uy+ux*h]].map(p=>project(...p));
  const clip=n=>Math.max(0,Math.min(1,n)),x0=clip(Math.min(...pts.map(p=>p[0]))/viewport.width),y0=clip(Math.min(...pts.map(p=>p[1]))/viewport.height),x1=clip(Math.max(...pts.map(p=>p[0]))/viewport.width),y1=clip(Math.max(...pts.map(p=>p[1]))/viewport.height),box=[x0,y0,x1-x0,y1-y0];
  const s=item.str.replace(/[\u0000-\u0008\u000b-\u001f]/g,' ').trim();
  if(current&&Math.abs(current.box[1]-box[1])<Math.min(current.box[3],box[3])*.35&&box[0]>=current.box[0]&&box[0]-(current.box[0]+current.box[2])<Math.max(.03,box[3]*1.5)){
   current.text+=' '+s;current.box[2]=Math.max(current.box[0]+current.box[2],x1)-current.box[0];current.box[3]=Math.max(current.box[3],box[3]);
  }else{current={text:s,box,confidence:1};lines.push(current)}
  if(item.hasEOL)current=null;
  if(lines.length>MAX_LINES)throw Error('PDF geometry exceeds line budget');
 }
 if(lines.reduce((n,l)=>n+l.text.length+1,0)>MAX_TEXT)throw Error('PDF geometry exceeds text budget');return lines;
}
return Object.freeze({analyze,classify,validate,children,nativeLines,MAX_BLOCKS});
});
