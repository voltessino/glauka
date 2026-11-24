/* 7.1 Quick Capture — explicit add-child on the selected tab.
 * Data remains local; one state-machine history step, no external requests.
 */
(function(root){
 'use strict';
 const Core=root.NeuroMapCaptureCore;if(!Core)return;
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const css=[
 '#nm-capture[hidden]{display:none!important}',
 '#nm-capture{position:fixed;inset:0;z-index:2110;background:#03091dc9;display:grid;place-items:center;padding:15px}',
 '#nm-capture .nm-capture-box{display:grid;gap:12px;max-height:93dvh;overflow:auto;width:min(560px,100%);box-sizing:border-box;background:linear-gradient(135deg,#102a59,#071327);border:1px solid #4381dc;border-radius:18px;padding:19px;color:#f5f8ff;box-shadow:0 15px 60px #0009}',
 '#nm-capture .nm-capture-box label{display:grid;gap:5px;font:12px system-ui}',
 '#nm-capture input,#nm-capture textarea{box-sizing:border-box;width:100%;min-width:0;padding:9px;border-radius:9px;background:#0b203e;color:#fff;border:1px solid #4675ab}',
 '#nm-capture textarea{min-height:150px;resize:vertical}',
 '#nm-capture .nm-capture-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}',
 '#nm-capture button{cursor:pointer;background:#164679;color:white;border:1px solid #568ee1;border-radius:10px;padding:9px 13px}',
 '#nm-capture button.nm-capture-primary{background:linear-gradient(100deg,#1678d8,#6443c7);font-weight:750}',
 '#nm-capture [role=status]{font-size:12px;color:#bddbfc}',
 '#nm-capture :focus-visible{outline:2px solid #6bd9ff;outline-offset:2px}'
 ].join('\n');
 function mount(app){
  if(app._nmCapture)return;
  const toolsMenu=document.getElementById('dropdown-tools')||document.getElementById('dropdown-file');if(!toolsMenu)return;
  if(!document.getElementById('nm-capture-style')){const style=make('style');style.id='nm-capture-style';style.textContent=css;document.head.append(style);}
  const opener=make('button','dropdown-item',tr('Quick Capture · raccogli appunti…','Quick Capture · collect notes…'));
  opener.type='button';opener.id='nm-capture-open';toolsMenu.append(opener);
  const shade=make('div');shade.id='nm-capture';shade.hidden=true;
  shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');
  shade.setAttribute('aria-label',tr('Quick Capture','Quick Capture'));
  const box=make('section','nm-capture-box');
  const heading=make('strong','',tr('Cattura nella mappa','Capture into map'));
  const lead=make('small','',tr('Testi e collegamenti vengono aggiunti soltanto alla tua mappa locale.','Text and links are added only to your local map.'));
  const label=(name,kind,max)=>{const l=make('label','',name),field=make(kind);field.maxLength=max;l.append(field);return {l,field};};
  const title=label(tr('Titolo (facoltativo)','Title (optional)'),'input',180);
  const url=label(tr('URL HTTP(S) (facoltativo)','HTTP(S) URL (optional)'),'input',2048);
  url.field.type='url';url.field.placeholder='https://';
  const excerpt=label(tr('Testo da raccogliere','Captured text'),'textarea',Core.MAX_TEXT);excerpt.field.rows=6;
  const status=make('div');status.setAttribute('role','status');
  const actions=make('div','nm-capture-actions');
  const cancel=make('button','',tr('Annulla','Cancel'));
  const confirm=make('button','nm-capture-primary',tr('Aggiungi come sotto-ramo','Add as child'));
  cancel.type=confirm.type='button';actions.append(cancel,confirm);
  box.append(heading,lead,title.l,url.l,excerpt.l,status,actions);
  shade.append(box);document.body.append(shade);
  let state=null,tab=null,selection=null;
  const close=()=>{shade.hidden=true;status.textContent='';};
  const open=()=>{
   app.hideMenus?.();state=app.state;tab=app.activeTabId;selection=app.state.selectedNodeId;
   title.field.value='';url.field.value='';excerpt.field.value='';
   shade.hidden=false;status.textContent='';excerpt.field.focus();
  };
  opener.addEventListener('click',open);cancel.addEventListener('click',close);
  shade.addEventListener('click',e=>{if(e.target===shade)close()});
  shade.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')close()});
  confirm.addEventListener('click',()=>{
   if(state!==app.state||tab!==app.activeTabId||selection!==app.state.selectedNodeId){
    status.textContent=tr('Selezione cambiata: riapri Quick Capture.','Selection changed: reopen Quick Capture.');return;
   }
   try{
    const proposed=Core.propose({title:title.field.value,text:excerpt.field.value,url:url.field.value});
    const target=state.findNode(selection)||state.root;
    if(!target)throw Error('No selected node');
    if(state.getAllNodesIncludingCollapsed().length>=3500)throw Error('Map node limit reached');
    const child=state.addChildNode(target.id,app.layout);
    if(!child)throw Error('Cannot create a child node');
    child.text=proposed.title;
    child.notes=proposed.notes;
    if(proposed.linkUrl)child.linkUrl=proposed.linkUrl;
    app.markChanged();app.selectNode(child.id);
    close();
    app.showToast(tr('Appunto aggiunto alla mappa','Captured note added'),'CAPTURE');
   }catch(e){status.textContent=String(e.message||e);}
  });
  app._nmCapture={open,close};
 }
 function install(App){
  const prior=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){const output=prior.apply(this,args);mount(this);return output};
 }
 if(typeof NeuroMapApp!=='undefined')install(NeuroMapApp);
})(globalThis);
