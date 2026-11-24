/* Pure, offline-only overview primitives. Never mutate logical map nodes or camera state. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.NeuroMapNavigationCore=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const MAX_NODES=25000;
  const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
  const safeDimension=(value,fallback,min,max)=>{
    const n=Number(value);
    return Number.isFinite(n)?clamp(n,min,max):fallback;
  };
  // Corrupted coordinates cannot define a meaningful Radar world rectangle.
  const MAX_RADAR_COORD=1e12;
  // Ignore non-finite, negative and unrealistic layout dimensions in the Radar.
  const nodeDimension=(value,fallback=10)=>{
    const n=Number(value)||fallback;
    return Number.isFinite(n)?clamp(n,3,1e8):fallback;
  };
  function scan(tree,{visibleOnly=false,limit=MAX_NODES}={}){
    if(!tree||typeof tree!=='object'||!tree.id) return [];
    const seen=new Set(),nodes=[],stack=[{node:tree,parentId:null,depth:0,mainId:null}];
    while(stack.length){
      const entry=stack.pop(),node=entry.node;
      if(!node||typeof node!=='object'||!node.id||seen.has(node))continue;
      seen.add(node);
      if(nodes.length>=limit)throw Error('Navigation node limit exceeded');
      const mainId=entry.depth===1?node.id:entry.mainId;
      nodes.push({id:String(node.id),logicalId:String(node.logicalId||node.id),
        text:String(node.text||''),parentId:entry.parentId,depth:entry.depth,
        mainId,color:String(node.color||'#818cf8'),collapsed:!!node.collapsed,
        original:node});
      if(visibleOnly&&node.collapsed)continue;
      const children=Array.isArray(node.children)?node.children:[];
      for(let i=children.length-1;i>=0;i--)stack.push({node:children[i],parentId:node.id,depth:entry.depth+1,mainId});
    }
    return nodes;
  }
  // Read the same physical presentation as the renderer, including continuations.
  // Logical IDs remain available for selection; visual IDs keep copies distinct.
  function layoutPoints(tree,layout){
    if(!tree||!layout)return [];
    const visual=layout.presentationRoot||tree;
    const logical=visual===tree?null:new Map(scan(tree).map(n=>[n.id,n]));
    const points=[];
    for(const node of scan(visual,{visibleOnly:true})){
      const source=logical?.get(node.logicalId)||node;
      const box=layout.nodeLayoutMap?.get(node.id)||layout.getLayout?.(node.id);
      if(!box||!Number.isFinite(box.x)||!Number.isFinite(box.y))continue;
      points.push({id:node.id,logicalId:node.logicalId,mainId:source.mainId,
        parentId:node.original.isFloating?null:node.parentId,depth:source.depth,
        x:box.x,y:box.y,width:box.width,height:box.height,color:source.color});
    }
    return points;
  }
  function overview(tree,{maxGroups=14}={}){
    const nodes=scan(tree),counts=new Map(),parents=new Map();
    for(const item of nodes){
      if(item.depth===1&&!item.original.isSummary&&!item.original.isFloating)
        counts.set(item.id,1);
      if(item.mainId&&counts.has(item.mainId)&&item.depth>1&&!item.original.isSummary)
        counts.set(item.mainId,counts.get(item.mainId)+1);
      parents.set(item.id,item.parentId);
    }
    const groups=nodes.filter(n=>counts.has(n.id)).map(n=>({
      id:n.id,label:n.text||'—',color:n.color,count:counts.get(n.id),
      collapsed:n.collapsed,side:n.original.side||'auto'
    }));
    return {total:nodes.length,groups:groups.slice(0,Math.max(1,maxGroups)),extraGroups:Math.max(0,groups.length-maxGroups)};
  }
  function focusPath(tree,id){
    if(!id)return null;
    const nodes=scan(tree),key=String(id);
    const found=nodes.find(n=>n.id===key)||nodes.find(n=>n.logicalId===key);
    if(!found)return null;
    const byId=new Map(nodes.map(n=>[n.id,n])),ids=new Set();
    let pointer=found;
    while(pointer){ids.add(pointer.id);ids.add(pointer.logicalId);pointer=pointer.parentId?byId.get(pointer.parentId):null;}
    const stack=[found.original],seen=new Set();
    while(stack.length){
      const node=stack.pop();
      if(!node||seen.has(node))continue;
      seen.add(node);ids.add(String(node.id));ids.add(String(node.logicalId||node.id));
      if(!node.collapsed)for(const child of node.children||[])stack.push(child);
    }
    return {targetId:found.id,title:found.text,ids,descendants:seen.size};
  }
  function semanticTier(zoom,enabled=true){
    if(!enabled||!Number.isFinite(zoom))return 2;
    if(zoom<.24)return 0;
    if(zoom<.56)return 1;
    return 2;
  }
  function minimap(nodes,camera,viewport,{width=190,height=122,padding=10}={}){
    const valid=(Array.isArray(nodes)?nodes:[]).filter(n=>n&&Number.isFinite(n.x)&&Number.isFinite(n.y)
      &&Math.abs(n.x)<=MAX_RADAR_COORD&&Math.abs(n.y)<=MAX_RADAR_COORD);
    const nwidth=safeDimension(width,190,80,8192),nheight=safeDimension(height,122,60,8192),
      pad=safeDimension(padding,10,0,25);
    if(!valid.length)return {nodes:[],edges:[],viewport:null,width:nwidth,height:nheight};
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const n of valid){
      const hw=nodeDimension(n.width)/2,hh=nodeDimension(n.height)/2;
      minX=Math.min(minX,n.x-hw);maxX=Math.max(maxX,n.x+hw);
      minY=Math.min(minY,n.y-hh);maxY=Math.max(maxY,n.y+hh);
    }
    const worldW=Math.max(40,maxX-minX),worldH=Math.max(40,maxY-minY),
      scale=Math.min((nwidth-2*pad)/worldW,(nheight-2*pad)/worldH),
      left=(nwidth-worldW*scale)/2,top=(nheight-worldH*scale)/2;
    const px=x=>left+(x-minX)*scale,py=y=>top+(y-minY)*scale;
    const projected=valid.map(n=>({id:n.id,logicalId:n.logicalId||n.id,mainId:n.mainId,
      x:px(n.x),y:py(n.y),
      w:clamp(nodeDimension(n.width)*scale,1.6,38),
      h:clamp(nodeDimension(n.height)*scale,1.5,17),
      r:clamp(Math.min(nodeDimension(n.width,12),nodeDimension(n.height,12))*scale*.4,1.5,5.5),
      color:n.color||'#a5b4fc',depth:n.depth||0,parentId:n.parentId||null}));
    const lookup=new Map(projected.map(n=>[n.id,n]));
    const edges=projected.filter(n=>n.parentId&&lookup.has(n.parentId)).map(n=>{
      const p=lookup.get(n.parentId),right=n.x>=p.x;
      return {x1:p.x+(right?p.w/2:-p.w/2),y1:p.y,
        x2:n.x+(right?-n.w/2:n.w/2),y2:n.y,
        color:n.color,depth:n.depth,mainId:n.mainId,parentId:n.parentId,id:n.id};
    });
    const requestedZoom=Number(camera?.zoom),zoom=Math.max(.001,Number.isFinite(requestedZoom)&&requestedZoom!==0?requestedZoom:1);
    const screenW=Math.max(1,Number(viewport?.width)||windowWidthFallback()),
      screenH=Math.max(1,Number(viewport?.height)||600);
    const cameraX=Number(camera?.x),cameraY=Number(camera?.y);
    const vx0=-(Number.isFinite(cameraX)?cameraX:0)/zoom,vy0=-(Number.isFinite(cameraY)?cameraY:0)/zoom;
    const sx=px(vx0),sy=py(vy0),vx1=px(vx0+screenW/zoom),vy1=py(vy0+screenH/zoom);
    const x0=clamp(Math.min(sx,vx1),0,nwidth),
      y0=clamp(Math.min(sy,vy1),0,nheight),
      x1=clamp(Math.max(sx,vx1),0,nwidth),
      y1=clamp(Math.max(sy,vy1),0,nheight);
    const visible={x:x0,y:y0,width:x1-x0,height:y1-y0};
    return {nodes:projected,edges,viewport:visible,width:nwidth,height:nheight,
      world:{minX,minY,maxX,maxY,left,top,scale}};
  }
  function windowWidthFallback(){return 1000;}
  function minimapToWorld(result,x,y){
    if(!result?.world)return null;
    const v=result.world;
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>result.width||y<0||y>result.height)return null;
    return {x:v.minX+(x-v.left)/v.scale,y:v.minY+(y-v.top)/v.scale};
  }
  return Object.freeze({scan,layoutPoints,overview,focusPath,semanticTier,minimap,minimapToWorld,MAX_NODES});
});
