/* 7.2 Anki text interchange: UTF-8 tab-separated Front / Back.
 * This is NOT .apkg and does not transfer Anki scheduling statistics.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapAnkiTSV=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_CARDS=500,MAX_BYTES=2*1024*1024;
 const clean=(s,max)=>String(s==null?'':s).replace(/[\t\r\n\u0000-\u001f]+/g,' ').trim().slice(0,max);
 function parse(input){
  const source=String(input??'').replace(/^\uFEFF/,'');
  if(source.length>MAX_BYTES)throw Error('Anki text exceeds 2 MB');
  const lines=source.split(/\r?\n/).filter(x=>x.trim()),out=[],seen=new Set();
  for(const line of lines){
   if(/^#(?:separator|html|columns|deck|notetype|tags|guid column)(?::|\t)/i.test(line))continue;
   const fields=line.split('\t');
   if(fields.length<2||fields.length>5)throw Error('Anki TSV must contain Front and Back columns');
   const question=clean(fields[0],240),answer=clean(fields[1],700);
   if(!question||!answer)continue;
   if(question.toLowerCase()==='front'&&answer.toLowerCase()==='back')continue;
   const key=question.toLocaleLowerCase()+'\0'+answer.toLocaleLowerCase();
   if(seen.has(key))continue;seen.add(key);
   out.push({question,answer});
   if(out.length>MAX_CARDS)throw Error('Anki file has more than 500 cards');
  }
  if(!out.length)throw Error('No valid Anki Front/Back rows found');
  return out;
 }
 function exportTSV(cards){
  const lines=['#separator:tab','#html:false','#columns:Front\tBack'];
  let n=0;
  for(const card of Array.isArray(cards)?cards:[]){
   const q=clean(card?.question,240),a=clean(card?.answer,700);
   if(!q||!a)continue;
   lines.push(q+'\t'+a);if(++n>=MAX_CARDS)break;
  }
  if(!n)throw Error('No flashcards available for export');
  return '\uFEFF'+lines.join('\n')+'\n';
 }
 return Object.freeze({parse,exportTSV,clean,MAX_CARDS,MAX_BYTES});
});
