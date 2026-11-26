/* Desktop refinements layered on the current editor, preserving its shared UI. */
(function(root){'use strict';
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const clipboardPending=new Map();
 function nativeClipboard(kind,text){
  const handler=root.webkit?.messageHandlers?.neuromapClipboard;
  if(!handler){if(kind==='read'){if(navigator.clipboard?.readText)return navigator.clipboard.readText();if(root.neuroMapApp?.internalClipboard)return Promise.resolve(root.neuroMapApp._clipboardPlain||'');}else if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text);return Promise.reject(Error(tr('Appunti di sistema non disponibili','System clipboard unavailable')));}
  return new Promise((resolve,reject)=>{const id='clip_'+crypto.randomUUID(),timer=setTimeout(()=>{clipboardPending.delete(id);reject(Error(tr('Gli appunti non rispondono','Clipboard did not respond')));},10000);clipboardPending.set(id,{resolve,reject,timer});try{handler.postMessage({id,kind,text:text??''});}catch(error){clearTimeout(timer);clipboardPending.delete(id);reject(error);}});
 }

 // Convert the selected image's actual bytes, whether PNG, JPEG, SVG, blob:
 // URL or native file URL. Never write placeholder text over system images.
 // Browser ClipboardItem accepts the returned Promise inside the key gesture.
 async function sourcePNG(source){
  if(typeof source!=='string'||!source.trim())throw Error(tr('Immagine senza dati','Image has no data'));
  const sizeLimit=32*1024*1024,maxPixels=40_000_000,maxDimension=8192;
  let blob=null;
  try{
   const response=await fetch(source);
   if(response.ok)blob=await response.blob();
  }catch(_){} // Decode URL directly when the fetch scheme is unavailable (e.g., file:).
  if(blob&&blob.size>sizeLimit)throw Error(tr('Immagine troppo grande per gli appunti','Image too large for clipboard'));
  if(blob?.type==='image/png'){
   // Raw PNG can be copied directly without a lossy decode/re-encode.
   // Even so, reject corrupt or outsized images before handing them to native host.
   const bitmap=typeof createImageBitmap==='function'?await createImageBitmap(blob).catch(()=>null):null;
   if(bitmap){
    const good=bitmap.width<=maxDimension&&bitmap.height<=maxDimension&&bitmap.width*bitmap.height<=maxPixels;
    bitmap.close?.();
    if(!good)throw Error(tr('Dimensioni troppo grandi per gli appunti','Image dimensions exceed clipboard limits'));
    return blob;
   }
  }
  let decoded=null,objectURL=null;
  try{
   if(blob&&typeof createImageBitmap==='function'){
    try{decoded=await createImageBitmap(blob)}catch(_){}
   }
   if(!decoded){
    decoded=new Image();
    objectURL=blob?URL.createObjectURL(blob):null;
    decoded.src=objectURL||source;
    if(typeof decoded.decode==='function')await decoded.decode();
    else await new Promise((resolve,reject)=>{decoded.onload=resolve;decoded.onerror=()=>reject(Error('Image decode failed'))});
   }
   const width=decoded.width||decoded.naturalWidth,height=decoded.height||decoded.naturalHeight;
   if(!width||!height||width>maxDimension||height>maxDimension||width*height>maxPixels)
    throw Error(tr('Dimensioni immagine non supportate','Unsupported image dimensions'));
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d');if(!ctx)throw Error(tr('Canvas non disponibile','Canvas unavailable'));
   ctx.drawImage(decoded,0,0,width,height);
   return await new Promise((resolve,reject)=>canvas.toBlob(
    output=>output&&output.size>0&&output.size<=sizeLimit?resolve(output):
     reject(Error(tr('Non è stato possibile creare il PNG','Unable to create PNG'))),'image/png'));
  }finally{
   if(decoded&&typeof decoded.close==='function')decoded.close();
   if(objectURL)URL.revokeObjectURL(objectURL);
  }
 }

 function writePNG(png){
  const native=root.neuromapDesktop?.writeClipboardPNG,mac=root.webkit?.messageHandlers?.neuromapClipboard;
  if(native||mac)return Promise.resolve(png).then(blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);})).then(data=>native?native(data):nativeClipboard('png',data));
  if(navigator.clipboard?.write&&typeof ClipboardItem!=='undefined')return navigator.clipboard.write([new ClipboardItem({'image/png':png})]);
  return Promise.resolve(png).then(()=>{throw Error(tr('Appunti immagine di sistema non disponibili','System image clipboard unavailable'))});
 }
 const clipboard={writePNG,sourcePNG,readText:()=>nativeClipboard('read'),writeText:text=>nativeClipboard('write',String(text))};
 function clipboardReply(result){const request=clipboardPending.get(result.id);if(!request)return;clearTimeout(request.timer);clipboardPending.delete(result.id);if(result.error)request.reject(Error(result.error));else request.resolve(result.text);}
 function fingerprint(state){
  const walk=n=>{const out={...n};delete out.side;delete out.colorIndex;out.children=(n.children||[]).map(walk);return out;};
  return JSON.stringify([walk(state.constructor.cloneTree(state.root)),state.constructor.cloneImages(state.images),state.constructor.cloneRelationships(state.relationships),state.balanceBias,state.compactness,state.branchGapX,state.strokeScale,state.activeThemeId,state.typographyPreset,state.typographyScale,state.branchStyle,state.defaultLabelWrapChars,state.wrapCustom]);
 }
 function saved(state){state._nmSavedFingerprint=fingerprint(state);}
 function sync(state){if(state._nmSavedFingerprint!=null)state.isDirty=fingerprint(state)!==state._nmSavedFingerprint;}
 function next(app,key){
  const current=app.state.findNode(app.state.selectedNodeId)||app.state.root,here=app.layout.getLayout(current.id);if(!here)return null;
  const visible=n=>app.layout.getLayout(n.id),rootNode=app.state.root;
  if(key==='ArrowLeft'||key==='ArrowRight'){
   const left=key==='ArrowLeft',outward=current===rootNode||((current.side==='left')===left);
   if(!outward){const p=app.state.findNode(current.parentId);return p&&visible(p)&&(left?visible(p).x<here.x-1:visible(p).x>here.x+1)?p:null;}
   const children=(current.collapsed?[]:current.children||[]).filter(n=>!n.isSummary&&visible(n)&&(left?visible(n).x<here.x-1:visible(n).x>here.x+1));
   children.sort((a,b)=>{
    const A=visible(a),B=visible(b);
    if(current===rootNode)return Math.abs(A.y-here.y)-Math.abs(B.y-here.y)||(left?B.y-A.y:A.y-B.y)||a.id.localeCompare(b.id);
    return (left?B.y-A.y:A.y-B.y)||a.id.localeCompare(b.id);
   });return children[0]||null;
  }
  const up=key==='ArrowUp';
  const nodes=app.state.getAllNodes().filter(n=>n.id!==current.id&&visible(n)&&(up?visible(n).y<here.y-1:visible(n).y>here.y+1));
  const score=n=>{const p=visible(n),dx=Math.abs(p.x-here.x),dy=Math.abs(p.y-here.y);return Math.hypot(dy,dx*1.5)+(n.parentId===current.parentId?0:40);};
  nodes.sort((a,b)=>score(a)-score(b)||Math.abs(visible(a).y-here.y)-Math.abs(visible(b).y-here.y)||a.id.localeCompare(b.id));return nodes[0]||null;
 }
 function titles(rootNode,label,modal,NM615,NM613){
  const result=NM615._originalPreview(rootNode,label,modal);NM615._namesRoot=rootNode;
  let panel=modal.querySelector('#nm-import-names');
  if(!panel){
   panel=document.createElement('section');panel.id='nm-import-names';panel.className='nm6-skiptranslate';panel.style.cssText='margin:12px 0;padding:12px;border:1px solid #44516a;border-radius:12px';
   const heading=document.createElement('label');heading.htmlFor='nm-import-name-mode';heading.textContent=tr('Nomi dei nodi centrali','Central topic names');
   const mode=document.createElement('select');mode.id='nm-import-name-mode';mode.setAttribute('aria-label',heading.textContent);
   for(const [value,it,en] of [['individual','Nome per scheda','Name per map'],['common','Nome comune','Common name']]){const option=document.createElement('option');option.value=value;option.textContent=tr(it,en);mode.append(option);}
   const common=document.createElement('input');common.id='nm-import-common-name';common.maxLength=200;common.value=rootNode.text||label;common.setAttribute('aria-label',tr('Nome comune','Common name'));common.hidden=true;
   const list=document.createElement('div');list.id='nm-import-name-list';list.style.cssText='display:grid;gap:8px;margin-top:10px';
   const hint=document.createElement('small');hint.textContent=tr('I nomi vuoti usano il titolo proposto. I nomi uguali sono consentiti: ogni mappa resta una scheda distinta.','Empty names use the proposed title. Repeated names are allowed: every map keeps its own tab.');
   const countLabel=document.createElement('label');countLabel.textContent=tr('Mappe desiderate (indicativo)','Desired maps (approximate)');const desired=document.createElement('input');desired.id='nm-import-desired-count';desired.type='number';desired.min='1';desired.max='20';desired.setAttribute('aria-label',countLabel.textContent);countLabel.append(desired);
   desired.onchange=()=>{const target=Math.max(1,Math.min(20,Number(desired.value)||1));let low=30,high=250,best=125,score=Infinity;for(let i=0;i<9&&low<=high;i++){const cap=Math.floor((low+high)/2),n=NM613.split(panel._source||rootNode,cap).length,cost=Math.abs(n-target);if(cost<score){score=cost;best=cap;}if(n>target)low=cap+1;else high=cap-1;}const selector=modal.querySelector('#nm615-capacity');if(Number(selector.value)===best)return;if(![...selector.options].some(o=>Number(o.value)===best)){const option=document.createElement('option');option.value=best;option.textContent=best+tr(' nodi',' nodes');selector.append(option);}selector.value=String(best);selector.onchange();};
   modal.addEventListener('click',event=>{const action=event.target.closest('[data-nm615]')?.dataset.nm615,app=root.neuroMapApp;if(!app||!['one','split'].includes(action)||!panel._source)return;const count=action==='split'?NM613.split(panel._source,Number(modal.querySelector('#nm615-capacity').value)).length:app._nmImportNewTab?1:0;if(app.tabs.length+count>20){event.preventDefault();event.stopImmediatePropagation();app.showToast(tr('Riduci il numero di mappe o chiudi alcune schede prima di importare.','Reduce the map count or close some tabs before importing.'),'IMPORT');}},true);
   panel.append(countLabel,heading,mode,common,list,hint);modal.querySelector('#nm615-import-preview').before(panel);
   panel._localize=()=>{heading.textContent=tr('Nomi dei nodi centrali','Central topic names');mode.setAttribute('aria-label',heading.textContent);mode.options[0].textContent=tr('Nome per scheda','Name per map');mode.options[1].textContent=tr('Nome comune','Common name');common.setAttribute('aria-label',tr('Nome comune','Common name'));countLabel.firstChild.nodeValue=tr('Mappe desiderate (indicativo)','Desired maps (approximate)');desired.setAttribute('aria-label',countLabel.firstChild.nodeValue);hint.textContent=tr('I nomi vuoti usano il titolo proposto. I nomi uguali sono consentiti: ogni mappa resta una scheda distinta.','Empty names use the proposed title. Repeated names are allowed: every map keeps its own tab.');panel.querySelectorAll('[data-page]').forEach((input,i)=>{const text=tr('Scheda ','Map ')+(i+1);input.parentElement.firstChild.nodeValue=text;input.setAttribute('aria-label',text);});};
   new MutationObserver(()=>panel._localize()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
   mode.onchange=()=>{common.hidden=mode.value!=='common';list.hidden=mode.value==='common';};
  }
  const sameSource=panel._source===rootNode;
  if(!sameSource){panel.querySelector('#nm-import-desired-count').value='';panel.querySelector('#nm-import-common-name').value=rootNode.text||label;panel.querySelector('select').value='individual';panel.querySelector('select').onchange();panel._source=rootNode;}
  const old=new Map(sameSource?[...panel.querySelectorAll('[data-page]')].map(e=>[e.dataset.page,e.value]):[]);
  const chunks=NM613.split(rootNode,Number(modal.querySelector('#nm615-capacity').value));
  const list=panel.querySelector('#nm-import-name-list');list.replaceChildren();
  chunks.forEach((chunk,i)=>{const label=document.createElement('label');label.textContent=tr('Scheda ','Map ')+(i+1);const input=document.createElement('input');input.dataset.page=String(i);input.maxLength=200;input.value=old.get(String(i))??chunk.text;input.setAttribute('aria-label',label.textContent);input.style.width='100%';label.append(input);list.append(label);});
  panel._localize();return result;
 }
 function install(App,State,{NM615,NM613,NM614,NM611,Layout}){
  const p=App.prototype;
  // Reserve attached-image footprints, without enlarging the painted node pills.
  const compute=Layout.prototype.computeLayout;Layout.prototype.computeLayout=function(...args){
   if(Array.isArray(args[2]))this._nmImages=args[2];
   this._nmImageMap=new Map();if(this.branchStyle!=='radial')for(const image of this._nmImages||[])if(image.mode==='attached'&&!image.graphic){const list=this._nmImageMap.get(image.attachedNodeId)||[];list.push(image);this._nmImageMap.set(image.attachedNodeId,list);}return compute.apply(this,args);
  };
  const measure=Layout.prototype.measureNode;Layout.prototype.measureNode=function(node,...args){const m=measure.call(this,node,...args);let left=m.width/2,right=m.width/2;for(const image of this._nmImageMap?.get(node.id)||[]){const dx=Number(image.offset?.dx)||0,w=Number(image.width)||135;left=Math.max(left,w/2-dx);right=Math.max(right,w/2+dx);}return {...m,_nmOccupiedLeft:left,_nmOccupiedRight:right};};
  const height=Layout.prototype.computeSubtreeHeight;Layout.prototype.computeSubtreeHeight=function(node,...args){const base=height.call(this,node,...args),m=this.nodeLayoutMap.get(node.id);if(!m||m._nmImageClearance)return base;let top=base/2,bottom=base/2;for(const image of this._nmImageMap?.get(node.id)||[]){const dy=Number(image.offset?.dy??-84)||0,h=Number(image.height)||100;top=Math.max(top,h/2-dy);bottom=Math.max(bottom,h/2+dy);}m._nmImageShift=(top-bottom)/2;m.subtreeHeight=top+bottom;return m.subtreeHeight;};
  const position=Layout.prototype.positionSubtreeRecursive;Layout.prototype.positionSubtreeRecursive=function(node,x,y,...args){const m=this.nodeLayoutMap.get(node.id);return position.call(this,node,x,y+(m&&!m._nmImageClearance?m._nmImageShift||0:0),...args);};
  const recalc=p.recalculateAndRender;p.recalculateAndRender=function(...args){this.layout._nmImages=this.state.images;return recalc.apply(this,args);};
  const count=NM611.count;NM611.count=function(node){return node?._nmDocuments?node._nmDocuments.reduce((total,doc)=>total+count.call(this,doc),0):count.call(this,node);};
  const split=NM613.split;NM613.split=function(node,capacity=this.capacity()){return node?._nmDocuments?node._nmDocuments.flatMap(doc=>NM611.count(doc)<=capacity?[doc]:split.call(this,doc,capacity)):split.call(this,node,capacity);};
  p.nm611ImportDocuments=function(documents,options={}){if(documents.length===1)return this.nm611ImportRoot(documents[0],options);return this.nm611ImportRoot({text:options.label||'Documenti importati',children:documents,_nmDocuments:documents},{...options,newTab:true});};
  const push=State.prototype.pushHistory;State.prototype.pushHistory=function(...args){if(!this.isDirty&&this.root)saved(this);return push.apply(this,args);};
  const mark=p.markChanged;p.markChanged=function(...args){const result=mark.apply(this,args);sync(this.state);this.renderTabBar();return result;};
  const imageDrag=p.updateImageDrag;p.updateImageDrag=function(...args){const was=this.drag?.moved,result=imageDrag.apply(this,args);if(this.drag?.moved){this.state.isDirty=true;this.scheduleSave();if(!was)this.renderTabBar();}return result;};
  const bind=p.bindUI;p.bindUI=function(...args){const result=bind.apply(this,args);for(const tab of this.tabs)if(!tab.state.isDirty)saved(tab.state);
   const group=document.getElementById('ctx-group-node');if(group){const box=document.createElement('div');box.className='nm-clipboard-primary';box.style.cssText='display:grid;grid-template-columns:minmax(0,1fr);gap:4px;padding:8px 3px;border-bottom:1px solid #44516a';
    for(const id of ['ctx-cut','ctx-copy','ctx-paste']){const button=document.getElementById(id);if(button)box.append(button);}group.prepend(box);
    group.querySelectorAll('details').forEach(d=>{if(!d.querySelector('button'))d.remove();});
   }
   return result;
  };
  const menu=p.showContextMenu;p.showContextMenu=function(x,y,hit){if(!hit)this.clearSelection();const result=menu.call(this,x,y,hit);const available=!!this.state.selectedImageId||this.selectedTopLevelNodes().length>0;for(const id of ['ctx-cut','ctx-copy']){const el=document.getElementById(id);el.disabled=!available;el.setAttribute('aria-disabled',String(!available));}return result;};
  const newState=p.newState;p.newState=function(...args){const state=newState.apply(this,args);state.compactness=55;state.branchStyle='xmind8';return state;};
  p.nm611MoveSelection=function(key){const n=next(this,key);if(!n)return false;this.selectNode(n.id);this.canvas.focus({preventScroll:true});const m=this.layout.getLayout(n.id),pt=this.renderer.worldToScreen(m.x,m.y);if(pt.x<50||pt.x>innerWidth-50||pt.y<120||pt.y>innerHeight-70)this.teleportToNode(n.id);return true;};
  const renderTabs=p.renderTabBar;p.renderTabBar=function(...args){const result=renderTabs.apply(this,args);const nodes=document.querySelectorAll('#tabs-list .tab-item');nodes.forEach((el,i)=>{const tab=this.tabs[i];if(tab?.filePath)el.title=tab.title+'\n'+tab.filePath;});return result;};
  const load=p.loadAutosave;p.loadAutosave=function(...args){const result=load.apply(this,args);if(result)for(const tab of this.tabs){if(tab.state.isDirty)tab.state._nmSavedFingerprint=null;else saved(tab.state);}return result;};
  for(const name of ['saveActiveTabSafe','saveAllTabs','saveProjectFile','saveAllInOneFile']){const original=p[name];if(!original)continue;p[name]=async function(...args){const result=await original.apply(this,args);if(result)for(const tab of this.tabs)if(!tab.state.isDirty)saved(tab.state);return result;};}
  const perform=NM614.performSave;NM614.performSave=async function(...args){const result=await perform.apply(this,args);if(result.ok)for(const tab of args[0].tabs)if(!tab.state.isDirty)saved(tab.state);return result;};
  const parse=p.parseTextHierarchy;p.parseTextHierarchy=function(text,ext){
   if(['md','markdown'].includes(ext)&&String(text).length<=1400000&&String(text).split('\n').length<=3300){const own=root.NeuroMapCore.parseMarkdownExport(text);const maps=own||root.NeuroMapCore.parseMarkdownDocuments(text);if(!maps.length)throw Error(tr('Il file è vuoto.','The file is empty.'));return maps.length===1?{root:maps[0]}:{workspace:maps.map(root=>({root}))};}
   return parse.call(this,text,ext);
  };
  const paste=p.nm66PasteOutline;p.nm66PasteOutline=function(text,html=''){
   if(/^\s*#{1,6}\s+|^\s*(?:```|~~~)/m.test(text)||(String(text).match(/^\s*(?:[-*+] |\d+[.)] )/gm)||[]).length>=3){
    document.getElementById('paste-modal-textarea').value=String(text);document.getElementById('paste-modal').classList.remove('hidden');document.getElementById('btn-confirm-paste-newtab')?.focus();return;
   }return paste.call(this,text,html);
  };
  NM615._originalPreview=NM615.updatePreview;NM615.updatePreview=function(rootNode,label,modal){return titles(rootNode,label,modal,NM615,NM613);};
  const choice=p.nm611LargeImportChoice;p.nm611LargeImportChoice=async function(rootNode,label){this._nmImportNames=null;NM615._namesRoot=null;const result=await choice.call(this,rootNode,label);const panel=document.getElementById('nm-import-names');if(result!=='cancel'&&panel&&NM615._namesRoot===rootNode){const mode=panel.querySelector('select').value;this._nmImportNames={mode,common:panel.querySelector('#nm-import-common-name').value.trim(),names:[...panel.querySelectorAll('[data-page]')].map(e=>e.value.trim())};}return result;};
  p.nm611ImportRoot=async function(rootNode,options={}){
   if(this._nmImportBusy){this.showToast(tr('Completa prima l’importazione in corso.','Finish the current import first.'),'IMPORT');return -1;}
   this._nmImportBusy=true;this._nmImportNewTab=options.newTab!==false;try{
   const action=await this.nm611LargeImportChoice(rootNode,options.label||'Documento');if(action==='cancel')return -1;
   const maps=action==='split'?NM613.split(rootNode):[rootNode],naming=this._nmImportNames;
   if(this.tabs.length+(action==='split'||options.newTab!==false?maps.length:0)>(root.GlaukaNativeOpen?.MAX_TABS||100))throw Error(tr('Troppe schede aperte: chiudine alcune prima di importare.','Too many open maps: close some before importing.'));
   let count=0;for(let i=0;i<maps.length;i++){const title=naming?.mode==='common'?naming.common:naming?.names[i];const map=title?{...maps[i],text:title}:maps[i];count+=this.importHierarchy(map,{...options,newTab:action==='split'||options.newTab!==false});await new Promise(resolve=>setTimeout(resolve,0));}return count;
   }finally{this._nmImportBusy=false;}
  };
 }
 root.NeuroMapDesktopWorkflow={install,fingerprint,saved,next,clipboard,clipboardReply};
})(globalThis);
