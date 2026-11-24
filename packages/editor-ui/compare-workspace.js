/* Compare two NeuroMap concepts without changing a single node or inventing facts. */
(function(root){
 'use strict';
 const core=root.NeuroMapComparisonCore;
 if(!core)return;
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const label=root.NeuroMapWorkspaceLocale?.bind||((element,it,en,attribute)=>{if(attribute)element.setAttribute(attribute,tr(it,en));else element.textContent=tr(it,en)});
 const STYLES=`
#nm616-compare-open{border-color:rgba(156,141,225,.5)!important;color:#e9dfff!important}
#nm616-compare{position:fixed;inset:6% 7%;z-index:5200;box-sizing:border-box;border:1px solid #6c6da0;border-radius:20px;background:#0b1426;color:#e8efff;box-shadow:0 24px 100px #000c;display:flex;flex-direction:column;overflow:hidden;font:13px system-ui}
#nm616-compare::before{content:"";position:fixed;inset:0;z-index:-1;background:#02071388}
#nm616-compare[hidden]{display:none!important}
#nm616-compare header{display:flex;align-items:center;gap:12px;padding:16px 20px;background:linear-gradient(115deg,#252144,#142543);border-bottom:1px solid #3b4c70;flex-wrap:wrap}
#nm616-compare header strong{font-size:17px;white-space:nowrap}
#nm616-compare header small{color:#a8b9d5;flex:1;min-width:150px}
#nm616-compare button,#nm616-compare select{border:1px solid #61759b;background:#213353;color:#f3f5ff;border-radius:10px;padding:8px 11px;font:600 12px system-ui;cursor:pointer}
#nm616-compare button:hover,#nm616-compare select:hover{border-color:#c4b5fd;background:#344472}
#nm616-compare button:focus-visible,#nm616-compare select:focus-visible{outline:2px solid #c4b5fd;outline-offset:2px}
#nm616-compare .nm616-compare-body{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;flex:1;min-height:0;padding:16px 19px;overflow:auto}
#nm616-compare .nm616-compare-side{border:1px solid #384b70;background:#111e33;border-radius:15px;min-width:0;display:flex;flex-direction:column;overflow:hidden}
#nm616-compare .nm616-compare-head{padding:14px 16px;border-bottom:1px solid #364764;background:#182a45}
#nm616-compare .nm616-compare-head h3{margin:0 0 5px;font:700 17px system-ui;overflow-wrap:anywhere}
#nm616-compare .nm616-compare-head small{color:#a4bad7}
#nm616-compare .nm616-compare-items{display:flex;flex-direction:column;gap:5px;padding:10px;overflow:auto;min-height:0}
#nm616-compare .nm616-compare-item{display:flex;align-items:center;text-align:left;gap:8px;border:1px solid transparent;background:#1b2a42;color:#dce8fc;padding:10px 11px;border-radius:9px;font-weight:500;line-height:1.4;overflow-wrap:anywhere}
#nm616-compare .nm616-compare-item[data-shared=true]{background:#283359;border-color:#68649e;color:#f3edff}
#nm616-compare .nm616-compare-item .nm616-compare-marker{color:#a5b4fc;font:700 11px system-ui;flex-shrink:0}
#nm616-compare .nm616-compare-item .nm616-compare-label{min-width:0;overflow-wrap:anywhere}
#nm616-compare footer{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:13px 18px;border-top:1px solid #314466;background:#131f35;flex-wrap:wrap}
#nm616-compare footer span{color:#c5b6fb;font-weight:700}
#nm616-compare footer small{color:#94a8c8}
#nm616-compare .nm616-compare-empty{color:#94a8c8;padding:12px;line-height:1.6}
@media(max-width:820px){#nm616-compare{inset:5px;border-radius:13px}#nm616-compare .nm616-compare-body{grid-template-columns:minmax(0,1fr);gap:10px}#nm616-compare .nm616-compare-side{max-height:45vh}#nm616-compare header{padding:10px}}
@media(prefers-reduced-motion:reduce){#nm616-compare button{transition:none}}
`;
 function install(App){
   if(!App?.prototype)return;
   let active=null,returnFocus=null;
   function ensure(app){
     if(document.getElementById('nm616-compare'))return;
     const style=document.createElement('style');style.id='nm616-compare-styles';style.textContent=STYLES;document.head.append(style);
     const action=document.createElement('button');action.id='nm616-compare-open';action.type='button';
     label(action,'⇄ Confronta','⇄ Compare');label(action,'Confronta concetti','Compare concepts','aria-label');
     label(action,'Confronta due nodi selezionati, o due rami fratelli','Compare two selected concepts or siblings','title');
     action.addEventListener('click',()=>open(app));
     const controls=document.getElementById('nm616-context-actions');
     const tools=document.getElementById('dropdown-tools');
     if(tools){action.classList.add('dropdown-item');label(action,'Confronta due rami…','Compare two branches…');tools.append(action)}
     else if(controls)controls.append(action);
     else document.querySelector('.nm-status-actions')?.append(action);
     const dialog=document.createElement('section');dialog.id='nm616-compare';
     dialog.className='nm6-skiptranslate';dialog.hidden=true;
     dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
     label(dialog,'Confronta concetti','Compare concepts','aria-label');
     const header=document.createElement('header'),title=document.createElement('strong');
     label(title,'⇄ Confronto concetti','⇄ Concept comparison');
     const hint=document.createElement('small');
     label(hint,'Voci riportate dalla mappa, senza interpretazioni AI','Map labels only, no AI assumptions');
     const depth=document.createElement('select');depth.id='nm616-compare-depth';
     label(depth,'Profondità del confronto','Comparison depth','aria-label');
     for(const [id,it,en] of [['1','Diretti','Direct'],['2','Due livelli','Two levels'],['3','Tre livelli','Three levels'],['5','Cinque livelli','Five levels']]){
       const opt=document.createElement('option');opt.value=id;label(opt,it,en);depth.append(opt);
     }
     depth.value='2';depth.addEventListener('change',()=>render(app));
     const swap=document.createElement('button');swap.type='button';swap.id='nm616-compare-swap';
     label(swap,'⇄ Inverti','⇄ Swap');
     swap.addEventListener('click',()=>{
       if(!active)return;const old=active.leftId;active.leftId=active.rightId;active.rightId=old;render(app);
     });
     const close=document.createElement('button');close.type='button';close.id='nm616-compare-close';
     label(close,'✕ Chiudi','✕ Close');close.addEventListener('click',closeComparison);
     header.append(title,hint,depth,swap,close);
     const body=document.createElement('div');body.className='nm616-compare-body';
     const makeSide=(id)=>{
       const side=document.createElement('section');side.className='nm616-compare-side';side.id=id;
       const heading=document.createElement('div');heading.className='nm616-compare-head';
       const h=document.createElement('h3'),info=document.createElement('small');heading.append(h,info);
       const list=document.createElement('div');list.className='nm616-compare-items';
       side.append(heading,list);body.append(side);
     };
     makeSide('nm616-compare-left');makeSide('nm616-compare-right');
     const footer=document.createElement('footer'),metric=document.createElement('span');
     metric.id='nm616-compare-common-count';
     const warning=document.createElement('small');warning.id='nm616-compare-warning';
     label(warning,'Coincidenza del testo ≠ equivalenza scientifica','Matching text ≠ scientific equivalence');
     footer.append(metric,warning);dialog.append(header,body,footer);document.body.append(dialog);
     root.NeuroMapWorkspaceLocale?.watch(()=>{if(active)render(app)});
     document.addEventListener('keydown',event=>{
       if(dialog.hidden||event.defaultPrevented)return;
       if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation?.();closeComparison();return}
       if(event.key!=='Tab')return;
       const focusable=[...dialog.querySelectorAll('button,select')].filter(n=>!n.disabled);
       if(!focusable.length)return;
       const index=focusable.indexOf(document.activeElement);
       const next=(index+(event.shiftKey?-1:1)+focusable.length)%focusable.length;
       event.preventDefault();focusable[next].focus();
     },true);
   }
   function drawSide(app,sideId,part,shared){
     const host=document.getElementById(sideId);if(!host)return;
     const heading=host.querySelector('h3'),info=host.querySelector('small'),
       list=host.querySelector('.nm616-compare-items');
     heading.textContent=part.title;
     info.textContent=part.items.length+tr(' voci nella mappa',' map entries')+
       (part.truncated?tr(' · anteprima limitata',' · preview limited'):'')+
       ' · '+part.uniqueCount+tr(' non condivise',' not shared');
     list.replaceChildren();
     if(!part.items.length){
       const empty=document.createElement('p');empty.className='nm616-compare-empty';
       label(empty,'Questo concetto non ha sottorami visibili.','This concept has no visible children.');
       list.append(empty);return;
     }
     for(const item of part.items){
       const button=document.createElement('button');button.type='button';
       button.className='nm616-compare-item';button.dataset.shared=String(shared.has(item.key));
       button.title=tr('Vai al nodo: ','Go to node: ')+item.text;
       const marker=document.createElement('span');marker.className='nm616-compare-marker';
       marker.textContent=shared.has(item.key)?'◆':'•';
       const label=document.createElement('span');label.className='nm616-compare-label';label.textContent=item.text||'—';
       button.style.paddingLeft=(10+(item.depth-1)*12)+'px';
       button.append(marker,label);
       button.addEventListener('click',()=>{
         const m=app.layout.getLayout(item.id);
         closeComparison();
         app.selectNode?.(item.id);
         if(m){
           const camera=app.renderer.camera;
           camera.x=root.innerWidth/2-m.x*camera.zoom;
           camera.y=root.innerHeight/2-m.y*camera.zoom;
           app.requestRender?.();
         }else app.showToast?.(tr('Nodo selezionato: espandi il ramo per visualizzarlo','Selected: expand the branch to view it'),'CONFRONTO');
       });
       list.append(button);
     }
   }
   function render(app){
     if(!active)return;
     const depth=Number(document.getElementById('nm616-compare-depth')?.value)||2;
     let result;
     try{result=core.compare(app.state.root,active.leftId,active.rightId,{maxDepth:depth})}
     catch(error){app.showToast?.(String(error.message),'CONFRONTO');closeComparison();return}
     drawSide(app,'nm616-compare-left',result.left,result.sharedKeys);
     drawSide(app,'nm616-compare-right',result.right,result.sharedKeys);
     const summary=document.getElementById('nm616-compare-common-count');
     summary.textContent=result.common.length+tr(' etichette condivise',' shared labels');
     document.getElementById('nm616-compare-warning').textContent=
       tr('Coincidenza del testo ≠ equivalenza scientifica','Matching text ≠ scientific equivalence');
   }
   function open(app){
     ensure(app);
     const state=app.state;
     if(!state?.root)return false;
     let pair;
     try{pair=core.choosePair(state.root,state.selectedNodeIds,state.selectedNodeId)}
     catch(error){app.showToast?.(String(error.message),'CONFRONTO');return false}
     if(!pair){app.showToast?.(tr('Seleziona due nodi con Ctrl+Clic o due rami fratelli','Select two nodes with Ctrl+Click or two siblings'),'CONFRONTO');return false}
     active={...pair,state};returnFocus=document.activeElement;
     const dialog=document.getElementById('nm616-compare');dialog.hidden=false;
     render(app);document.getElementById('nm616-compare-close')?.focus();
     return true;
   }
   function closeComparison(){
     const dialog=document.getElementById('nm616-compare');
     if(!dialog||dialog.hidden)return;
     dialog.hidden=true;active=null;returnFocus?.focus?.();returnFocus=null;
   }
   const bind=App.prototype.bindUI;
   App.prototype.bindUI=function(...args){const out=bind.apply(this,args);ensure(this);return out};
   const activate=App.prototype.activateTab;
   if(typeof activate==='function')App.prototype.activateTab=function(...args){
     if(this.activeTabId!==args[0])closeComparison();
     return activate.apply(this,args);
   };
   root.NeuroMapComparison=Object.freeze({open,close:closeComparison});
 }
 root.NeuroMapComparisonInstall=install;
})(globalThis);
