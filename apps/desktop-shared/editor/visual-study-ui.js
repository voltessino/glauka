/* 7.2 Visual Learning: author image points, reveal labels, self-rate locally.
 * Original images, notes and logical nodes remain intact.
 */
(function(root){
 'use strict';
 const Core=root.NeuroMapVisualStudyCore;if(!Core)return;
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const CSS=[
 '#nm-visual-study[hidden],#nm-visual-study [hidden]{display:none!important}',
 '#nm-visual-study{position:fixed;inset:0;background:rgba(15,23,42,.56);backdrop-filter:blur(6px);z-index:2150;display:grid;place-items:center;padding:14px}',
 '#nm-visual-study .nm-vs-box{width:min(780px,100%);max-height:94dvh;overflow:auto;box-sizing:border-box;padding:18px;display:grid;gap:12px;background:var(--nm-skin-surface,var(--nm-ui-surface,#ffffff));border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));border-radius:16px;color:var(--nm-skin-ink,var(--nm-ui-ink,#141926));box-shadow:0 22px 64px rgba(15,23,42,.26);font:13.5px/1.45 var(--font-sans,Inter,system-ui,sans-serif)}',
 '#nm-visual-study .nm-vs-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
 '#nm-visual-study button,#nm-visual-study select{padding:8px 11px;min-height:38px;border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed));border-radius:10px;background:var(--nm-skin-top,var(--nm-ui-top,#f4f6fc));color:var(--nm-skin-ink,var(--nm-ui-ink,#141926));cursor:pointer;max-width:100%;font-weight:600}',
 '#nm-visual-study .nm-vs-image{position:relative;margin:auto;width:fit-content;max-width:100%;user-select:none}',
 '#nm-visual-study .nm-vs-image img{display:block;max-width:100%;max-height:49dvh;object-fit:contain;border-radius:12px;border:1px solid var(--nm-skin-stroke,var(--nm-ui-line,#d7deed))}',
 '#nm-visual-study .nm-vs-image button{position:absolute;width:30px;height:30px;min-height:30px;transform:translate(-50%,-50%);padding:0;border-radius:50%;font-weight:bold;background:#134f9f;color:#fff;border:2px solid #76d8ff;box-shadow:0 4px 12px rgba(15,23,42,.28)}',
 '#nm-visual-study .nm-vs-image button[data-revealed=true]{background:#116850;border-color:#9cf2bf}',
 '#nm-visual-study .nm-vs-status{min-height:18px;font-size:12px;overflow-wrap:anywhere;color:var(--nm-skin-muted,var(--nm-ui-muted,#5c6680))}',
 '#nm-visual-study .nm-vs-image[data-mode=edit]{cursor:crosshair}',
 '#nm-visual-study :is(button,select):focus-visible{outline:2px solid var(--nm-theme-focus,#7c5ce7);outline-offset:2px}'
 ].join('\n');
 function install(App){
  const old=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){const result=old.apply(this,args);mount(this);return result;};
 }
 function mount(app){
  if(app._nmVisualStudy)return;
  const menu=document.getElementById('dropdown-tools');if(!menu)return;
  if(!document.getElementById('nm-vs-css')){
   const s=el('style');s.id='nm-vs-css';s.textContent=CSS;document.head.append(s);
  }
  const launch=el('button','dropdown-item',tr('Visual Learning · immagini…','Visual Learning · images…'));
  launch.type='button';launch.id='nm-tool-visual-study';menu.append(launch);
  const shade=el('div');shade.id='nm-visual-study';shade.hidden=true;shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');
  shade.setAttribute('aria-label','Visual Learning');
  const box=el('section','nm-vs-box'),title=el('strong','',tr('Ripassa su immagini · punti anatomici e diagrammi','Study with images · hotspots & diagrams'));
  const controls=el('div','nm-vs-controls');
  const images=el('select'),nodes=el('select');
  images.setAttribute('aria-label',tr('Immagine','Image'));
  nodes.setAttribute('aria-label',tr('Concetto da collegare','Related concept'));
  const mode=el('button','',tr('Passa a Quiz','Start Quiz')),remove=el('button','',tr('Rimuovi ultimo punto','Remove last point'));
  const close=el('button','','×');close.setAttribute('aria-label',tr('Chiudi','Close'));
  for(const b of [mode,remove,close])b.type='button';
  controls.append(images,nodes,mode,remove,close);
  const info=el('small','',tr('Modifica: scegli il nodo e clicca una posizione sull’immagine. Quiz: clicca i punti per rivelare le etichette.','Edit: select a node and click on the image. Quiz: click points to reveal labels.'));
  const frame=el('div','nm-vs-image'),image=el('img');image.alt=tr('Immagine dello studio','Study image');frame.append(image);
  const rating=el('div','nm-vs-controls'),correct=el('button','',tr('Lo sapevo','I knew it')),wrong=el('button','',tr('Da ripassare','Review again'));
  correct.type=wrong.type='button';rating.append(correct,wrong);rating.hidden=true;
  const status=el('div','nm-vs-status');status.setAttribute('role','status');
  box.append(title,controls,info,frame,rating,status);shade.append(box);document.body.append(shade);
  let owner=null,ownerTab='',selectedImageId='',quiz=false,revealed=-1;
  const live=()=>!shade.hidden&&app.state===owner&&app.activeTabId===ownerTab;
  const img=()=>owner?.findImage?.(selectedImageId)||null;
  function closeDialog(){shade.hidden=true;quiz=false;rating.hidden=true;}
  function option(select,value,text){const n=el('option','',text);n.value=value;select.append(n);}
  function redraw(){
   const item=img();
   frame.querySelectorAll('button').forEach(b=>b.remove());
   frame.hidden=!item;image.hidden=!item;mode.disabled=!item;remove.disabled=!item||!(item.studyHotspots||[]).length||quiz;
   if(!item){status.textContent=tr('Nessuna immagine nella mappa: inserisci prima un’immagine dal menu Inserisci per posizionare i punti di studio.','No images in this map yet: insert an image first from the Insert menu to place study hotspots.');return;}
   image.src=item.src;
   frame.dataset.mode=quiz?'quiz':'edit';
   const valid=Core.normalize(item.studyHotspots).filter(p=>owner.findNode(p.nodeId));
   for(let i=0;i<valid.length;i++){
    const h=valid[i],b=el('button','',quiz&&i!==revealed?'?':String(i+1));
    b.type='button';b.style.left=(100*h.x)+'%';b.style.top=(100*h.y)+'%';
    b.dataset.revealed=String(!quiz||i===revealed);
    b.setAttribute('aria-label',quiz?tr('Rivela punto ','Reveal point ')+(i+1):h.label);
    b.title=quiz&&i!==revealed?'?':(owner.findNode(h.nodeId)?.text||h.label);
    b.addEventListener('click',e=>{
     e.stopPropagation();if(!live())return;
     if(quiz){revealed=i;rating.hidden=false;redraw();}
     else status.textContent=tr('Punto ','Point ')+(i+1)+': '+(owner.findNode(h.nodeId)?.text||h.label);
    });frame.append(b);
   }
   mode.textContent=quiz?tr('Torna a Modifica','Back to Edit'):tr('Passa a Quiz','Start Quiz');
   status.textContent=tr('Punti collegati: ','Linked hotspots: ')+valid.length+
    (quiz?tr(' · clicca ? per rivelare',' · click ? to reveal'):'');
   if(quiz&&revealed>=0&&valid[revealed])
    status.textContent=tr('Risposta: ','Answer: ')+(owner.findNode(valid[revealed].nodeId)?.text||valid[revealed].label);
  }
  launch.addEventListener('click',()=>{
   app.hideMenus?.();owner=app.state;ownerTab=app.activeTabId;
   shade.hidden=false;quiz=false;revealed=-1;rating.hidden=true;
   images.replaceChildren();nodes.replaceChildren();
   const mapImages=owner.images||[];
   if(!mapImages.length){
    const empty=el('option','',tr('Nessuna immagine','No images'));empty.value='';empty.disabled=true;images.append(empty);
   }else{
    for(const item of mapImages)option(images,item.id,tr('Immagine ','Image ')+(mapImages.indexOf(item)+1));
   }
   images.disabled=!mapImages.length;
   selectedImageId=owner.selectedImageId&&owner.findImage(owner.selectedImageId)?
    owner.selectedImageId:mapImages[0]?.id||'';
   images.value=selectedImageId;
   const stack=[owner.root];let amount=0;
   while(stack.length&&amount<1000){
    const n=stack.pop();if(!n)continue;option(nodes,n.id,String(n.text||'Nodo').slice(0,130));amount++;
    for(let j=(n.children||[]).length-1;j>=0;j--)stack.push(n.children[j]);
   }
   nodes.value=owner.selectedNodeId&&owner.findNode(owner.selectedNodeId)?owner.selectedNodeId:owner.root.id;
   redraw();
   images.focus({preventScroll:true});
  });
  close.addEventListener('click',closeDialog);
  shade.addEventListener('click',e=>{if(e.target===shade)closeDialog()});
  shade.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')closeDialog()});
  images.addEventListener('change',()=>{selectedImageId=images.value;revealed=-1;rating.hidden=true;redraw()});
  mode.addEventListener('click',()=>{if(!live())return;quiz=!quiz;revealed=-1;rating.hidden=true;redraw()});
  frame.addEventListener('click',e=>{
   if(!live()||quiz||e.target!==image)return;
   const item=img(),chosen=owner.findNode(nodes.value);if(!item||!chosen)return;
   try{
    const pos=Core.locate(image.getBoundingClientRect(),e.clientX,e.clientY);
    const next=Core.add(item.studyHotspots,{...pos,nodeId:chosen.id,label:chosen.text});
    owner.pushHistory();item.studyHotspots=next;app.markChanged();redraw();
   }catch(err){status.textContent=String(err.message||err);}
  });
  remove.addEventListener('click',()=>{
   if(!live()||quiz)return;const item=img();if(!item||!(item.studyHotspots||[]).length)return;
   owner.pushHistory();item.studyHotspots=Core.normalize(item.studyHotspots).slice(0,-1);
   app.markChanged();redraw();
  });
  function answer(correctAnswer){
   if(!live()||!quiz||revealed<0)return;
   const valid=Core.normalize(img()?.studyHotspots).filter(p=>owner.findNode(p.nodeId));
   const item=valid[revealed];if(!item)return;
   const node=owner.findNode(item.nodeId);
   if(root.NeuroMapLearningCore&&node){
    app.learningAttempts=root.NeuroMapLearningCore.addAttempt(app.learningAttempts||[],{
     tabId:ownerTab,nodeId:node.id,itemId:'image:'+selectedImageId+':'+revealed,
     format:'open',correct:correctAnswer,sourceSignature:app.v5Signature?.(node,owner)||''
    });
    app.scheduleSave();
   }
   revealed=-1;rating.hidden=true;redraw();
   app.showToast(correctAnswer?tr('Risposta registrata','Answer saved'):tr('Da ripassare registrato','Marked for review'),'STUDIO');
  }
  correct.addEventListener('click',()=>answer(true));
  wrong.addEventListener('click',()=>answer(false));
  app._nmVisualStudy={open:()=>launch.click(),close:closeDialog};
 }
 if(typeof NeuroMapApp!=='undefined')install(NeuroMapApp);
})(globalThis);
