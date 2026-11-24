/* Reading-order and numeric review helpers. Never rewrite recognized values. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NeuroMapOCRQuality=api;})(globalThis,function(){
'use strict';
const LIMIT=45000,MAX_LINES=10000;
function region(box){if(!Array.isArray(box)||box.length!==4||!box.every(Number.isFinite)||box[0]<0||box[1]<0||box[2]<.005||box[3]<.005||box[0]+box[2]>1.00001||box[1]+box[3]>1.00001)throw Error('Invalid source region');return box.map(n=>Math.max(0,Math.min(1,n)))}
const position=line=>line.layoutBox||line.box;
function gutter(lines){
 const body=lines.filter(l=>position(l)[2]<.62&&l.text.trim()),starts=body.map(l=>position(l)[0]).sort((a,b)=>a-b);let gap=0,split=.5;
 for(let i=1;i<starts.length;i++)if(starts[i]-starts[i-1]>gap){gap=starts[i]-starts[i-1];split=(starts[i]+starts[i-1])/2}
 const left=body.filter(l=>position(l)[0]<split),right=body.filter(l=>position(l)[0]>=split);
 if(gap<.18||left.length<2||right.length<2||Math.min(left.length,right.length)/Math.max(left.length,right.length)<.25)return null;
 const end=Math.max(...left.map(l=>position(l)[0]+position(l)[2]));if(end>Math.min(...right.map(l=>position(l)[0]))-.015)return null;
 split=(end+Math.min(...right.map(l=>position(l)[0])))/2;
 const sorted=right.slice().sort((a,b)=>position(a)[1]-position(b)[1]);let hits=0;
 for(const l of left){let lo=0,hi=sorted.length;const y=position(l)[1];while(lo<hi){const mid=(lo+hi)>>1;if(position(sorted[mid])[1]<y)lo=mid+1;else hi=mid}
  if([sorted[lo-1],sorted[lo]].some(r=>r&&Math.abs(position(r)[1]-y)<Math.max(position(l)[3],position(r)[3])*.65))hits++;
 }
 const pairs=hits/left.length;
 const numeric=right.filter(l=>(l.text.match(/\d/g)||[]).length/Math.max(1,l.text.replace(/\s/g,'').length)>.3).length/right.length;
 const prose=body.filter(l=>l.text.trim().split(/\s+/).length>=4&&/[.!?]$/.test(l.text.trim())).length/body.length;
 return {split,pairs,numeric,prose};
}
function cells(line){
 if(!line.words?.length)return [line];
 const words=line.words.slice().sort((a,b)=>position(a)[0]-position(b)[0]),groups=[];
 for(const word of words){const previous=groups.at(-1),last=previous?.at(-1);if(last&&position(word)[0]-(position(last)[0]+position(last)[2])<Math.max(.035,position(word)[3]*1.5))previous.push(word);else groups.push([word])}
 if(groups.length===1)return [line];
 return groups.map(words=>{const boxes=words.map(position),x=Math.min(...boxes.map(b=>b[0])),y=Math.min(...boxes.map(b=>b[1])),right=Math.max(...boxes.map(b=>b[0]+b[2])),bottom=Math.max(...boxes.map(b=>b[1]+b[3]));return {text:words.map(w=>w.text).join(' '),box:[x,y,right-x,bottom-y],confidence:Math.min(...words.map(w=>w.confidence??0))}});
}
function readingOrder(lines,{mode='auto'}={}){
 if(!Array.isArray(lines)||lines.length>MAX_LINES||!['auto','engine','columns','rows'].includes(mode))throw Error('Invalid reading order');
 for(const l of lines)if(!l||typeof l.text!=='string'||!Array.isArray(position(l))||position(l).length!==4||!position(l).every(Number.isFinite))throw Error('Invalid OCR line');
 const candidates=lines.flatMap(cells);
 if(candidates.length>2000){const text=lines.map(l=>l.text).join('\n');if(text.length>LIMIT)throw Error('OCR text exceeds 45000 characters');return {text,lines:lines.slice(),mode:'engine',ambiguous:true,partial:true}}
 const g=gutter(candidates);let selected=mode,ambiguous=false;
 if(mode==='auto'){
  if(g&&g.pairs>.7&&g.numeric>.5)selected='rows';
  else if(g&&(g.pairs<.55||g.prose>=.75)&&g.numeric<.3)selected='columns';
  else {selected='engine';ambiguous=!!g}
 }
 const byPosition=(a,b)=>position(a)[1]-position(b)[1]||position(a)[0]-position(b)[0];let ordered=lines.slice(),text;
 if(selected==='columns'){
  ordered=candidates;const split=g?.split||.5,spanning=ordered.filter(l=>position(l)[0]<split&&position(l)[0]+position(l)[2]>split+.08).sort(byPosition),out=[];let remaining=ordered.filter(l=>!spanning.includes(l));
  for(const end of [...spanning,null]){
   const band=end?remaining.filter(l=>position(l)[1]<position(end)[1]):remaining;
   const left=band.filter(l=>position(l)[0]<split).sort(byPosition),right=band.filter(l=>position(l)[0]>=split).sort(byPosition);out.push(...left,...right);if(end)out.push(end);
   const used=new Set(band);remaining=remaining.filter(l=>!used.has(l));
  }
  ordered=out;text=out.map(l=>l.text).join('\n');
 }else if(selected==='rows'){
  ordered=ordered.flatMap(cells);ordered.sort(byPosition);const groups=[];
  for(const line of ordered){const cy=position(line)[1]+position(line)[3]/2,last=groups.at(-1);if(last&&Math.abs(last.cy-cy)<=Math.max(last.height,position(line)[3])*.55){last.lines.push(line);last.height=Math.max(last.height,position(line)[3])}else groups.push({cy,height:position(line)[3],lines:[line]})}
  text=groups.map(r=>r.lines.sort((a,b)=>position(a)[0]-position(b)[0]).map(l=>l.text).join('\t')).join('\n');ordered=groups.flatMap(r=>r.lines);
 }else text=ordered.map(l=>l.text).join('\n');
 if(text.length>LIMIT)throw Error('OCR text exceeds 45000 characters');
 return {text,lines:ordered,mode:selected,ambiguous};
}
function numericReview(text,native=''){
 const scan=s=>[...String(s||'').matchAll(/(?<![\p{L}\p{N}])(?<number>[+-]?(?:\d+(?:[.,]\d+)*|[OlI][.,]\d+|(?:[OlI]\d+|\d+[OlI]\d*)(?:[.,]\d+)?))\s*(?<unit>µg|μg|mcg|ug|mmol|mmHg|mg|ng|pg|kg|cm|mm|g|mL|ml|dL|L|UI|IU|%)?(?:\/(?<per>mL|ml|dL|L|kg|h|min))?(?![\p{L}\p{N}])/gu)].slice(0,120).map(m=>({value:m[0].trim(),number:m.groups.number,unit:m.groups.unit||'',index:m.index}));
 const tokens=scan(text),source=scan(native),alerts=[],scientificAlerts=[];
 // Scientific notation is review-only: no normalization of prefixes, exponents or signs.
 let scientificTruncated=false;
 const scientific=/(?:[α-ωΑ-ΩµμΩ°]|[₀-₉⁰-⁹⁺⁻]|\b(?:Na|K|Ca|Cl|HCO|CO|O)[0-9]*[+−-]|\d+(?:[.,]\d+)?\s*[×x]\s*10(?:\^?[+−-]?\d+|[⁰-⁹⁺⁻]+))/gu;
 for(const m of String(text).matchAll(scientific)){if(scientificAlerts.length>=40){scientificTruncated=true;break}scientificAlerts.push({value:m[0],index:m.index,kind:'scientific-symbol'})}
 for(const m of String(text).matchAll(/\b\d+(?:[.,]\d+)?\s*(?:rng|rnl|rnL|u9|m9|µ9)(?=$|[^\p{L}\p{N}])/gu))alerts.push({value:m[0],index:m.index,kind:'ambiguous-unit'});
 for(const item of tokens){
  if(/[OlI]/.test(item.number))alerts.push({...item,kind:'ambiguous-digit'});
  if(/\d[.,]\d{3}(?!\d)/.test(item.value))alerts.push({...item,kind:'decimal-separator'});
  if(/^(?:ug|µg|μg|mcg|mg|ng|pg)$/.test(item.unit))alerts.push({...item,kind:'dose-unit'});
 }
 if(source.length){const available=new Map();for(const p of tokens)available.set(p.value,(available.get(p.value)||0)+1);
  for(const item of source){const n=available.get(item.value)||0;if(n)available.set(item.value,n-1);else alerts.push({...item,kind:'differs-from-source'})}
 }
 alerts.push(...scientificAlerts);
 return {tokens,alerts:alerts.slice(0,80),partial:scientificTruncated||tokens.length>=120||source.length>=120||alerts.length>80};
}
return Object.freeze({region,readingOrder,numericReview});
});
