/* Visual Learning 7.2 — source-linked hotspots on existing map images.
 * Coordinates are image-relative; no need to depend on canvas viewport scale.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapVisualStudyCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX=40;
 function normalize(rows){
  if(!Array.isArray(rows))return [];
  const result=[];
  for(const entry of rows.slice(0,MAX*3)){
   if(!entry||typeof entry!=='object')continue;
   const x=Number(entry.x),y=Number(entry.y),nodeId=String(entry.nodeId||'').trim();
   const label=String(entry.label||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,150);
   if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1||
      !/^[a-zA-Z0-9_:-]{1,140}$/.test(nodeId)||!label)continue;
   if(result.some(h=>h.nodeId===nodeId&&Math.abs(h.x-x)<.005&&Math.abs(h.y-y)<.005))continue;
   result.push(Object.freeze({x:Math.round(x*10000)/10000,y:Math.round(y*10000)/10000,nodeId,label}));
   if(result.length>=MAX)break;
  }return result;
 }
 function add(existing,item){
  const before=normalize(existing),next=normalize([...before,item]);
  if(next.length===before.length)throw Error('Hotspot is invalid, duplicated or limit reached');
  return next;
 }
 function locate(rect,clientX,clientY){
  if(!rect||rect.width<=0||rect.height<=0)throw Error('Image unavailable');
  const x=(clientX-rect.left)/rect.width,y=(clientY-rect.top)/rect.height;
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)
   throw Error('Choose a point inside the image');
  return {x:Math.round(x*10000)/10000,y:Math.round(y*10000)/10000};
 }
 function quiz(items,hasNode){
  const normalized=normalize(items);
  return normalized.filter(x=>typeof hasNode==='function'&&hasNode(x.nodeId))
   .map((h,i)=>({id:'hotspot-'+i,hotspot:h,answered:false}));
 }
 return Object.freeze({MAX,normalize,add,locate,quiz});
});
