 function stateCache(app,force=false,includePoints=true){
   const state=app.state;
   if(!state?.root)return null;
   let result=cache.get(state);
   if(result&&!force&&(!includePoints||result.hasPoints))return result;
   try{
     const overview=core.overview(state.root,{maxGroups:60});
     const points=includePoints?core.layoutPoints(state.root,app.layout):[];
     result={overview,points,hasPoints:includePoints};
   }catch(error){
     console.warn('Navigation overview unavailable',error);
     result={overview:{total:0,groups:[],extraGroups:0},points:[],hasPoints:false};
   }
   cache.set(state,result);
   return result;
 }
 // Calculate the selected breadcrumb once per selection, not on every camera
 // frame. A bounded traversal is read-only, even for very deep maps.
 function selectionTrail(app){
   const state=app.state,selectedId=String(state?.selectedNodeId||'');
   const old=trailCache.get(state);
   if(old?.id===selectedId)return old;
   const rootNode=state?.root;
   if(!rootNode)return {id:selectedId,labels:[],level:0,index:0,count:0};
   const parent=new Map(),nodeById=new Map(),seen=new Set();
   const stack=[{node:rootNode,parentId:null,index:1,count:1,level:0}];
   let found=null,steps=0;
   while(stack.length&&steps++<25000){
     const item=stack.pop(),node=item.node;
     if(!node||typeof node!=='object'||!node.id||seen.has(node))continue;
     seen.add(node);
     const id=String(node.id);
     parent.set(id,item.parentId);nodeById.set(id,node);
     if(id===selectedId||String(node.logicalId||id)===selectedId){found={...item,id};break;}
     const children=Array.isArray(node.children)?node.children:[];
     for(let i=children.length-1;i>=0;i--)
       stack.push({node:children[i],parentId:id,index:i+1,count:children.length,level:item.level+1});
   }
   const labels=[];
   if(found){
     let id=found.id,depth=0;
     while(id&&depth++<64){
       const node=nodeById.get(id);
       labels.push(String(node?.text||'—').replace(/\s+/g,' ').trim().slice(0,48)||'—');
       id=parent.get(id);
     }
     labels.reverse();
   }
   const result={id:selectedId,labels:labels.slice(-4),level:found?.level||0,
     index:found?.index||1,count:found?.count||1};
   trailCache.set(state,result);
   return result;
 }
 function enterFocus(app,id){
   if(!app.state?.root||!id)return false;
   const path=core.focusPath(app.state.root,id);
   if(!path)return false;
   let focus=active.get(app.state);
   if(!focus){focus={restoreCamera:{...app.renderer.camera},targetId:id};active.set(app.state,focus)}
   focus.targetId=id;
   app.renderer.visualFocusIds=path.ids;
   const box=app.nm612Bounds?.(id);
   if(box&&Number.isFinite(box.width)&&Number.isFinite(box.height)){
     const animate=!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
     app.nm612FitBounds?.(box,{animated:animate,maxZoom:1.7,selectId:id});
   }
   app.selectNode?.(id);
   app.requestRender?.();schedule(app,true);return true;
 }
 function exitFocus(app,{silent=false}={}){
   const focus=active.get(app.state);
   if(!focus)return false;
   active.delete(app.state);app.renderer.visualFocusIds=null;
   if(focus.restoreCamera){
     app.stopTeleport?.();
     Object.assign(app.renderer.camera,focus.restoreCamera);
   }
   if(!silent){app.updateStatus?.();app.requestRender?.();schedule(app,true)}
   return true;
 }
