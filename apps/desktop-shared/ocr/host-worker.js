/* Dedicated owner for the nested Tesseract worker. Terminating this owner also
 * terminates its child worker, including model initialization/cancelled jobs. */
'use strict';
importScripts('./tesseract.min.js');
let engine;
self.onmessage=async({data})=>{
 const {id,type,image,psm=3}=data||{};
 try{
  if(type==='init'){
   const base=new URL('./',self.location.href).href;
   engine=await Tesseract.createWorker('ita',1,{workerPath:base+'worker.min.js',corePath:base,langPath:base,gzip:false,cacheMethod:'none',workerBlobURL:false,
    logger:p=>self.postMessage({type:'progress',status:p.status,progress:p.progress}),errorHandler:()=>{}});
   await engine.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'1'});
   self.postMessage({id,ok:true});
  }else if(type==='recognize'&&engine){
   if(![3,6,7,11].includes(psm))throw Error('Invalid reading mode');
   await engine.setParameters({tessedit_pageseg_mode:String(psm)});
   const {data:result}=await engine.recognize(image,{}, {text:true,tsv:true});
   if(typeof result.tsv!=='string')throw Error('Missing OCR TSV output');
   const header='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n';
   self.postMessage({id,ok:true,tsv:result.tsv.startsWith('level\t')?result.tsv:header+result.tsv});
  }else throw Error('OCR worker is not initialized');
 }catch(error){self.postMessage({id,ok:false,message:String(error?.message||error).slice(0,300)})}
};
