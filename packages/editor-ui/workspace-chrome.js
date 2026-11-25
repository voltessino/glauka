/* Reserve one compact header row for navigation and selection; no map mutations. */
(function(root){
 'use strict';
 let rail;
 const css=`
#nm-workspace-rail{display:flex;align-items:center;gap:10px;min-width:0;min-height:36px;padding:3px 12px;box-sizing:border-box;background:var(--nm-skin-top,#0c1425);border-bottom:1px solid var(--nm-skin-stroke,#34415a80);pointer-events:auto;position:relative}
#nm-workspace-rail[hidden]{display:none}
body #nm-view-overlay,body #nm-view-overlay.nm-side-panel{top:var(--nm-workspace-chrome-bottom,86px)}
#nm-workspace-rail #nm616-navigation{position:static;flex:0 0 auto;max-width:none;font:12px/1.4 system-ui}
#nm616-nav-disclosure>summary{list-style:none;display:flex;align-items:center;gap:8px;cursor:pointer;padding:5px 9px;border:1px solid var(--nm-skin-stroke,#455575);border-radius:9px;background:var(--nm-skin-top,#192840);color:var(--nm-skin-ink,#e8efff);font:600 11px system-ui;white-space:nowrap}
#nm616-nav-disclosure>summary::-webkit-details-marker{display:none}
#nm616-nav-disclosure>summary::after{content:'⌄';color:var(--nm-theme-focus,#a5b4fc)}
#nm616-nav-disclosure[open]>summary,#nm616-nav-disclosure>summary[data-focus=true]{border-color:var(--nm-theme-focus,#a5b4fc);background:var(--nm-ui-hover,#2b3257)}
#nm616-nav-disclosure>summary:focus-visible{outline:2px solid var(--nm-theme-focus,#a5b4fc);outline-offset:2px}
#nm-workspace-rail .nm616-nav-card{position:absolute;left:10px;top:calc(100% + 5px);width:min(350px,calc(100vw - 20px));box-sizing:border-box;padding:12px;gap:8px;max-height:calc(100dvh - 180px);overflow:auto;background:var(--nm-skin-surface,#101c30);color:var(--nm-skin-ink,#edf2fa);z-index:1}
#nm-workspace-rail .nm616-nav-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%}
#nm-workspace-rail #nm616-nav-caption{font-size:10px}
#nm-workspace-rail #nm616-context{position:static;flex:1;max-width:none;min-width:0;border:0;border-left:1px solid var(--nm-skin-stroke,#46547180);border-radius:0;padding:0 0 0 9px;background:transparent;box-shadow:none;backdrop-filter:none;flex-wrap:nowrap;font-size:11px;gap:6px}
#nm-workspace-rail #nm616-context-path{flex:1 1 auto;min-width:0;overflow:hidden}
#nm-workspace-rail #nm616-context-path .nm616-crumb{max-width:190px;font-size:11px;padding:4px}
#nm-workspace-rail #nm616-context-actions{gap:3px;flex:0 0 auto}
#nm-workspace-rail #nm616-context-actions button{font-size:0;width:29px;height:29px;padding:5px;box-sizing:border-box;display:grid;place-items:center;background:transparent;border:1px solid transparent;border-radius:7px;color:var(--nm-skin-ink,#c6d4ef)}
#nm-workspace-rail #nm616-context-actions button:hover{background:var(--nm-ui-hover,#2c3c59);border-color:var(--nm-theme-focus,#7387ab)}
#nm-workspace-rail #nm616-context-actions button::before{content:'';display:block;width:16px;height:16px;background:currentColor;mask:var(--nm-action-icon) center/contain no-repeat;-webkit-mask:var(--nm-action-icon) center/contain no-repeat}
body.nm-orbit-workspace #nm-workspace-rail{background:var(--nm-orbit-panel);border-color:var(--nm-orbit-line)}
body.nm-workspace-inspector-open:not(.nm616-zen) #nm616-minimap-shell{right:var(--nm-minimap-right,var(--nm-workspace-radar-right,430px));bottom:var(--nm-minimap-bottom,16px)}
body.nm-workspace-inspector-open:not(.nm616-zen) .hud-bottom-right{right:12px!important;bottom:12px!important}
/* Never hide an enabled minimap: shrink/move it instead of parking it. */
body.nm-minimap-compact #nm616-minimap-shell{transform:scale(var(--nm-minimap-scale,.72));transform-origin:bottom right}
body.nm-minimap-aside #nm616-minimap-shell{right:var(--nm-minimap-right,var(--nm-workspace-radar-right,430px))!important}
body.nm616-zen #nm-workspace-rail{position:fixed;top:10px;left:10px;right:185px;min-height:32px;background:transparent;border:0;padding:0;z-index:100;pointer-events:none}
body.nm616-zen #nm616-navigation{pointer-events:auto}
#nm614-navigation-flyout #nm616-context{position:static;max-width:none;min-width:0;border:0;border-top:1px solid var(--nm-skin-stroke,#7386a544);border-radius:0;padding:10px 0;margin-top:8px;box-shadow:none;background:none;font-size:11px}
#nm614-navigation-flyout #nm616-context-path{flex-wrap:wrap;overflow-wrap:anywhere}
#nm614-navigation-flyout #nm616-context-actions{flex-wrap:wrap}

@media(max-width:650px){#nm-workspace-rail{gap:5px;padding:3px 6px}#nm-workspace-rail #nm616-context{padding-left:4px;gap:3px}#nm-workspace-rail #nm616-context-actions{gap:0}#nm-workspace-rail #nm616-context-actions button{width:27px}#nm-workspace-rail #nm616-context-path .nm616-crumb:not(:last-child),#nm-workspace-rail .nm616-separator{display:none}#nm616-nav-disclosure>summary{padding:5px 7px;gap:5px}}
`;
 const icons={
  'nm616-quick-edit':'M4 16l1-5L15 1l4 4L9 15zM13 3l4 4M3 19h15',
  'nm616-quick-add':'M10 3v14M3 10h14',
  'nm616-quick-focus':'M7 2H2v5m11-5h5v5M2 13v5h5m6 0h5v-5M6 10h8m-4-4v8',
  'nm616-quick-style':'M3 5h14M3 15h14M7 2v6m6 4v6',
  'nm616-compare-open':'M3 6h14l-4-4M17 14H3l4 4'
 };
 function decorate(){
  const empty=[...rail.children].every(el=>el.hidden);
  if(rail.hidden!==empty)rail.hidden=empty;
  for(const [id,path]of Object.entries(icons)){
   const button=document.getElementById(id);if(!button||button.dataset.nmRailIcon)continue;
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="${path}" fill="none" stroke="black" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
   button.style.setProperty('--nm-action-icon',`url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
   button.dataset.nmRailIcon='true';
   button.setAttribute('aria-label',button.title||button.textContent);
  }
 }
 const sidePanelIds=['inspector-sidebar','nm-knowledge-panel','nm-ai-studio',
  'nm-learn-panel','nm-insert-panel','nm614-navigation-flyout','image-controls','gl-cloud-dialog',
  'nm-drawing-toolbar'];
 function restingMinimap(){
  // Match the unshifted shell in navigation-experience-styles.js, including
  // the narrow-screen scale whose origin is the bottom-right corner.
  const width=root.innerWidth||0,height=root.innerHeight||0;
  const narrow=width<=560,mid=width<=800;
  const scale=narrow?0.7:mid?0.83:1;
  const insetRight=narrow?50:mid?65:88,insetBottom=narrow?61:mid?64:72;
  const boxWidth=224*scale,boxHeight=194*scale,right=width-insetRight,bottom=height-insetBottom;
  return {left:right-boxWidth,top:bottom-boxHeight,right,bottom};
 }
 function placeRadar(){
  // The minimap must not cover *any* active right-side panel, not just Aspetto.
  const panels=sidePanelIds.map(id=>document.getElementById(id)).filter(Boolean);
  const visible=panels.map(panel=>{
    if(panel.id!=='gl-cloud-dialog')return panel;
    // The dialog spans the viewport; only its docked card occupies map space.
    return !panel.hidden&&panel.classList.contains('gl-cloud-docked')
      ?panel.querySelector('.gl-cloud-card'):null;
   }).filter(panel=>panel&&!panel.hidden&&!panel.classList.contains('collapsed')&&
   !panel.classList.contains('hidden')&&panel.offsetWidth>0&&panel.offsetHeight>0);
  // Disposizione is anchored on the left. On a wide window it never meets the
  // minimap; on a narrow window it grows across that corner and must reserve it.
  const layout=document.querySelector?.('.hud-bottom-left');
  if(layout&&!layout.hidden&&!layout.classList.contains('collapsed')&&
   !layout.classList.contains('hidden')&&layout.offsetWidth>0&&layout.offsetHeight>0){
   const bounds=layout.getBoundingClientRect?.(),slot=restingMinimap();
   if(bounds&&Math.min(bounds.right,slot.right)-Math.max(bounds.left,slot.left)>8&&
    Math.min(bounds.bottom,slot.bottom)-Math.max(bounds.top,slot.top)>8)visible.push(layout);
  }
  // A docked Cloud card may coexist with a right-side tool. The first
  // panel in the list is not necessarily the widest: reserve the maximum
  // occupied horizontal strip so Radar never sits over another open card.
  const active=visible.length>0;
  if(document.body.classList.contains('nm-workspace-inspector-open')!==active)
   document.body.classList.toggle('nm-workspace-inspector-open',active);
  if(active){
   const clearance=visible.reduce((max,panel)=>{
    // Painted geometry is authoritative: a responsive panel may be moved by
    // transforms or anchored from the left, with computed right set to "auto".
    // Keep the CSS fallback for non-layout test doubles and older hosts.
    const bounds=panel.getBoundingClientRect?.();
    const actualLeft=bounds?.left;
    if(Number.isFinite(actualLeft))
     return Math.max(max,(root.innerWidth||0)-actualLeft+12);
    const right=panel.classList.contains('gl-cloud-card')
     ?Math.max(0,(root.innerWidth||0)-(bounds?.right||0))
     :parseFloat(getComputedStyle(panel).right)||0;
    return Math.max(max,panel.offsetWidth+right+12);
   },88);
   document.body.style.setProperty('--nm-workspace-radar-right',clearance+'px');
   const menu=document.getElementById('nm616-nav-disclosure');
   if(menu&&!menu.closest('#nm614-navigation-flyout'))menu.open=false;
  }
  fitFloatingChrome(visible);
  placeMinimapClear();
  clearViewCorner();
 }
 function nodeHitsBox(box,pad=40){
  if(!box||box.width<20||box.height<20)return 0;
  const app=root.neuroMapApp;
  const layout=app&&app.layout,renderer=app&&app.renderer,rootNode=app&&app.state&&app.state.root;
  if(!layout||typeof layout.getLayout!=='function'||!renderer||typeof renderer.worldToScreen!=='function'||!rootNode)return 0;
  const stack=[rootNode];
  let guard=0,hits=0;
  while(stack.length&&guard<80){
   const node=stack.pop();guard++;
   if(!node)continue;
   const place=layout.getLayout(node.id);
   if(place&&Number.isFinite(place.x)&&Number.isFinite(place.y)){
    const halfW=(Number(place.width)||80)/2,halfH=(Number(place.height)||32)/2;
    const corners=[[place.x,place.y],[place.x-halfW,place.y-halfH],[place.x+halfW,place.y-halfH],[place.x-halfW,place.y+halfH],[place.x+halfW,place.y+halfH]];
    for(const pair of corners){
     const point=renderer.worldToScreen(pair[0],pair[1]);
     if(point&&point.x>=box.left-pad&&point.x<=box.right+pad&&point.y>=box.top-pad&&point.y<=box.bottom+pad){hits++;break;}
    }
   }
   const kids=node.children;
   if(kids)for(let i=0;i<kids.length;i++)stack.push(kids[i]);
  }
  return hits;
 }
 function nodeHitsMinimap(){
  if(typeof document.getElementById!=='function')return 0;
  const shell=document.getElementById('nm616-minimap-shell');
  if(!shell||shell.hidden||typeof shell.getBoundingClientRect!=='function')return 0;
  return nodeHitsBox(shell.getBoundingClientRect());
 }
 function placeMinimapClear(){
  const body=document.body;
  if(!body||!body.classList||typeof body.classList.remove!=='function'||typeof body.classList.add!=='function')return;
  body.classList.remove('nm-minimap-yield','nm-minimap-parked','nm-minimap-compact');
  body.style?.removeProperty?.('--nm-minimap-scale');
 }
 function clearViewCorner(){
  const style=document.body&&document.body.style;
  if(!style||typeof style.setProperty!=='function'||typeof style.removeProperty!=='function')return;
  const overlay=document.getElementById('nm-view-overlay');
  const zoom=typeof document.querySelector==='function'?document.querySelector('.hud-bottom-right'):null;
  if(!overlay||overlay.hidden||!zoom||typeof zoom.getBoundingClientRect!=='function'||typeof overlay.getBoundingClientRect!=='function'){
   style.removeProperty('--nm-view-corner-clear');
   return;
  }
  const view=overlay.getBoundingClientRect(),badge=zoom.getBoundingClientRect();
  const across=Math.min(view.right,badge.right)-Math.max(view.left,badge.left);
  const down=Math.min(view.bottom,badge.bottom)-Math.max(view.top,badge.top);
  const pad=across>8&&down>8?Math.ceil(view.right-badge.left+8):12;
  style.setProperty('--nm-view-corner-clear',Math.max(12,pad)+'px');
 }
 function fitFloatingChrome(panels){
  const style=document.body&&document.body.style;
  const body=document.body;
  if(!style||typeof style.getPropertyValue!=='function'||typeof document.querySelector!=='function')return;
  const width=root.innerWidth||0,height=root.innerHeight||0;
  if(!panels.length||!width||!height){
   style.removeProperty('--nm-zoom-right');
   style.removeProperty('--nm-minimap-right');
   style.removeProperty('--nm-minimap-bottom');
   style.removeProperty('--nm-minimap-scale');
   body?.classList?.remove?.('nm-minimap-parked','nm-minimap-yield','nm-minimap-aside','nm-minimap-compact');
   return;
  }
  // Prefer left of the open side panel; try more seats when nodes or chrome collide.
  const clearance=Math.max(12,parseFloat(style.getPropertyValue('--nm-workspace-radar-right'))||88);
  const zoom=document.querySelector('.hud-bottom-right');
  const zoomBox=zoom&&zoom.getBoundingClientRect?zoom.getBoundingClientRect():null;
  const zoomWide=zoomBox&&zoomBox.width>40?Math.ceil(zoomBox.width)+16:164;
  const layoutBtn=document.getElementById('v6-show-layout');
  const layoutBtnBox=layoutBtn&&!layoutBtn.classList.contains('hidden')&&layoutBtn.offsetWidth>0?layoutBtn.getBoundingClientRect?.():null;
  // Keep bottom-right zoom anchored at right: 12px, bottom: 12px (right panels stop above it).
  const narrow=width<=560,mid=width<=800;
  const defaultBottom=narrow?12:mid?14:16;
  const scale=width<=900?Math.max(0.5,Math.min(0.82,(width-clearance-24)/224)):1;
  const mapHeight=194*scale,mapWidth=224*scale;
  const clampRight=(value)=>Math.max(12,Math.min(value,width-mapWidth-12));
  const clampBottom=(value)=>Math.max(12,Math.min(value,height-mapHeight-12));
  const blocks=panels.slice().map(panel=>panel.getBoundingClientRect?.()).filter(Boolean);
  if(zoomBox&&zoomBox.width>40)blocks.push(zoomBox);
  if(layoutBtnBox&&layoutBtnBox.width>10)blocks.push(layoutBtnBox);
  const overlaps=(box,right,bottom)=>{
   const left=width-right-mapWidth,top=height-bottom-mapHeight;
   const across=Math.min(box.right,left+mapWidth)-Math.max(box.left,left);
   const down=Math.min(box.bottom,top+mapHeight)-Math.max(box.top,top);
   return across>8&&down>8;
  };
  const besideZoom=Math.max(clearance,zoomWide+16);
  const aboveLayoutBtn=layoutBtnBox?Math.ceil(height-layoutBtnBox.top+12):72;
  const candidates=[
   {right:besideZoom,bottom:defaultBottom},
   {right:besideZoom,bottom:aboveLayoutBtn},
   {right:clearance,bottom:zoomBox?Math.ceil(height-zoomBox.top+12):72},
   {right:besideZoom+Math.round(mapWidth*0.45)+28,bottom:defaultBottom},
   {right:besideZoom+Math.round(mapWidth*0.9)+44,bottom:defaultBottom},
   {right:clearance,bottom:Math.max(72,Math.round(height*0.34))},
   {right:clearance+Math.round(mapWidth*0.55)+40,bottom:Math.max(72,Math.round(height*0.3))},
   {right:Math.min(width-mapWidth-24,besideZoom+220),bottom:defaultBottom},
   {right:Math.max(besideZoom+120,Math.round(width*0.42)),bottom:Math.max(72,Math.round(height*0.22))}
  ].map(c=>({right:clampRight(c.right),bottom:clampBottom(c.bottom)}));
  let best=candidates[0],bestScore=Infinity;
  for(const candidate of candidates){
   let score=candidate.right*0.001+candidate.bottom*0.0005;
   for(const box of blocks)if(overlaps(box,candidate.right,candidate.bottom))score+=140;
   if(score<bestScore){bestScore=score;best=candidate;}
  }
  style.removeProperty('--nm-zoom-right');
  style.setProperty('--nm-minimap-right',best.right+'px');
  style.setProperty('--nm-minimap-bottom',best.bottom+'px');
  body?.classList?.remove?.('nm-minimap-parked','nm-minimap-yield','nm-minimap-compact');
  body?.classList?.add?.('nm-minimap-aside');
  if(scale<0.98){
   body?.classList?.add?.('nm-minimap-compact');
   style.setProperty('--nm-minimap-scale',String(Math.round(scale*100)/100));
  }else{
   style.removeProperty('--nm-minimap-scale');
  }
 }
 function watchRightPanels(){
  if(!document.body||!root.MutationObserver||!root.ResizeObserver)return;
  const seen=new WeakSet();
  const observer=new MutationObserver(placeRadar),resizer=new ResizeObserver(placeRadar);
  const attach=()=>{
   for(const id of sidePanelIds){
    const panel=document.getElementById(id);
    if(!panel||seen.has(panel))continue;
    seen.add(panel);
    observer.observe(panel,{attributes:true,attributeFilter:['class','hidden','style']});
    resizer.observe(panel);
   }
   const layout=document.querySelector('.hud-bottom-left');
   if(layout&&!seen.has(layout)){
    seen.add(layout);
    observer.observe(layout,{attributes:true,attributeFilter:['class','hidden','style']});
    resizer.observe(layout);
   }
   placeRadar();
  };
  // Only direct body additions: avoids observing thousands of canvas nodes.
  new MutationObserver(attach).observe(document.body,{childList:true});
  attach();
 }
 function placeViews(){
  const chrome=document.querySelector('.top-chrome');
  const bottom=chrome?.getBoundingClientRect().bottom||rail?.getBoundingClientRect().bottom||70;
  document.body.style.setProperty('--nm-workspace-chrome-bottom',Math.ceil(bottom+8)+'px');
  clearViewCorner();
 }
 function mount(element){
  const chrome=document.querySelector('.top-chrome');
  if(!chrome){document.body.append(element);return;}
  if(!rail){
   const style=document.createElement('style');style.textContent=css;document.head.append(style);
   rail=document.createElement('div');rail.id='nm-workspace-rail';chrome.append(rail);
   new MutationObserver(()=>{
    const target=document.body.classList.contains('nm616-zen')?document.body:chrome;
    if(rail.parentElement!==target)target.append(rail);placeViews();
   }).observe(document.body,{attributes:true,attributeFilter:['class']});
   root.addEventListener('resize',placeRadar);watchRightPanels();
   root.addEventListener('pointerup',()=>{placeMinimapClear();clearViewCorner();});
   root.requestAnimationFrame?.(()=>{placeMinimapClear();clearViewCorner();});
   new ResizeObserver(placeViews).observe(chrome);placeViews();
   new MutationObserver(decorate).observe(rail,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  }
  const compass=document.getElementById('nm614-navigation-flyout');
  if(compass&&['nm616-navigation','nm616-context'].includes(element.id))(compass.querySelector(':scope>.nm-panel-body')||compass).append(element);else rail.append(element);decorate();
 }
 root.NeuroMapWorkspaceChrome=Object.freeze({mount,refresh(){placeMinimapClear();clearViewCorner();}});
})(globalThis);
