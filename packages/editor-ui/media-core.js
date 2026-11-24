/* Data-only editor helpers; safe to share across desktop and portable tests. */
(function(root,factory) {
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.NeuroMapMediaCore=api;
})(typeof globalThis==='object'?globalThis:this, function(){
 'use strict';
 const clamp=(x,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(x))?Number(x):min));
 const step=(n,min,max)=>Math.min(max,Math.max(min,Math.round((Number(n)-min)/5)*5+min));
 function spacing(raw){
  return {compactness:Number.isFinite(Number(raw?.compactness))?step(raw.compactness,55,145):55,
    branchGapX:Number.isFinite(Number(raw?.branchGapX))?step(raw.branchGapX,30,220):30};
 }
 function safeURL(raw){
  if(typeof raw!=='string'||raw.length>2048||/[\u0000-\u001f\u007f]/.test(raw))return '';
  const input=raw.trim();if(!input)return '';
  try {const url=new URL(input);return ['https:','http:'].includes(url.protocol)&&url.hostname&&!url.username&&!url.password?url.href:'';}catch{return '';}
 }
 function crop(raw){
  const obj=raw&&typeof raw==='object'?raw:{};
  let left=clamp(obj.left,0,95),right=clamp(obj.right,0,95),top=clamp(obj.top,0,95),bottom=clamp(obj.bottom,0,95);
  if(left+right>95)right=95-left;
  if(top+bottom>95)bottom=95-top;
  return {left,right,top,bottom};
 }
 function imageProps(raw){
  const value=Number(raw?.rotation),rotation=Number.isFinite(value)?(Math.round(value/90)*90%360+360)%360:0;
  return {rotation, crop:crop(raw?.crop),
   borderRadius:([0,8,16,24,32].includes(Number(raw?.borderRadius))?Number(raw.borderRadius):8),
   frame:['none','thin','double'].includes(raw?.frame)?raw.frame:'thin',
   caption:String(raw?.caption||'').replace(/\r\n?/g,'\n').slice(0,2000),
   captionAlign:['left','center','right'].includes(raw?.captionAlign)?raw.captionAlign:'left',
   captionFontSize:Number.isInteger(raw?.captionFontSize)&&raw.captionFontSize>=9&&raw.captionFontSize<=36?raw.captionFontSize:11,
   ...(globalThis.NeuroMapCaption?.sanitize(raw?.caption,raw?.captionStyles).spans.length?{captionStyles:globalThis.NeuroMapCaption.sanitize(raw.caption,raw.captionStyles).spans}:{})};
 }
 function imageSourceRect(imageWidth,imageHeight,rawCrop){
  const c=crop(rawCrop),width=Math.max(1,Number(imageWidth)||1),height=Math.max(1,Number(imageHeight)||1);
  return {sx:width*c.left/100,sy:height*c.top/100,sw:width*(100-c.left-c.right)/100,sh:height*(100-c.top-c.bottom)/100};
 }
 return Object.freeze({spacing,safeURL,crop,imageProps,imageSourceRect});
});
