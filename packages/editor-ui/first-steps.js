/* NeuroMap 7: explicitly invoked first-steps guide; no mutations of the user's map.
 * Desktop IT/EN only. In particular it never translates user node content.
 */
(function(root){
 'use strict';
 const copy={
  it:{
   open:'Primi passi',title:'Comincia in tre gesti',
   intro:'La tua mappa è già pronta per essere usata. Puoi imparare questi gesti senza cambiare le impostazioni.',
   steps:[
    ['1. Seleziona e scrivi','Clicca un nodo e inizia a digitare per cambiarne il testo. F2 apre la modifica.'],
    ['2. Fai crescere la mappa','Premi Tab per un sottoramo, Invio per un ramo vicino. Puoi anche usare il tasto destro.'],
    ['3. Salva il tuo lavoro','Premi Ctrl+S su Windows o ⌘+S su Mac. Per annullare l’ultima modifica usa Ctrl+Z su Windows o ⌘+Z su Mac.']
   ],
   note:'Vuoi pulsanti e testo più grandi? Apri i Temi dell’interfaccia e scegli «Più leggibile · comandi grandi».',
   close:'Chiudi guida',label:'Guida introduttiva a Glauka'
  },
  en:{
   open:'First steps',title:'Start in three steps',
   intro:'Your mind map is ready to use. Try these actions without changing any settings.',
   steps:[
    ['1. Select and type','Click a node and start typing to edit its text. F2 also opens editing.'],
    ['2. Grow your map','Press Tab for a child branch or Enter for a sibling. You can also right-click.'],
    ['3. Save your work','Press Ctrl+S on Windows or ⌘+S on Mac. Undo with Ctrl+Z on Windows or ⌘+Z on Mac.']
   ],
   note:'Want bigger labels and buttons? Open Interface themes and choose “Comfortable · larger controls”.',
   close:'Close guide',label:'Glauka getting started guide'
  }
 };
 function current(){return document.documentElement.lang==='en'?copy.en:copy.it}
 function install(App){
  if(!App?.prototype?.bindUI)return;
  const before=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){
   const result=before.apply(this,args);
   mount();return result;
  };
 }
 function mount(){
  const button=document.getElementById('nm7-guide-open');
  if(!button||button.dataset.nm7Bound)return;
  button.dataset.nm7Bound='true';
  if(!document.getElementById('nm7-guide-styles')){
   const style=document.createElement('style');style.id='nm7-guide-styles';
   style.textContent=`
#nm7-guide-dialog{width:min(540px,calc(100vw - 24px));max-height:calc(100dvh - 24px);
 overflow-y:auto;margin:auto;padding:24px;border:1px solid var(--nm-skin-stroke,#74869e);border-radius:16px;
 background:var(--nm-skin-surface,#132139);color:var(--nm-skin-ink,#edf2fa);box-shadow:var(--nm-skin-shadow,0 25px 80px #0005);font:15px/1.55 system-ui;}
#nm7-guide-dialog:not([open]){display:none}
#nm7-guide-dialog::backdrop{background:rgba(3,8,20,.75)}
#nm7-guide-dialog h2{font-size:clamp(20px,3vw,26px);margin:0 0 10px}
#nm7-guide-dialog p{line-height:1.6;margin:0 0 14px}
#nm7-guide-dialog ol{padding:0;list-style:none;display:grid;gap:12px;margin:12px 0 18px}
#nm7-guide-dialog li{padding:12px;border:1px solid var(--nm-skin-stroke,#74869e);border-radius:10px;background:var(--nm-skin-top,#1f2d48)}
#nm7-guide-dialog li strong{display:block;font-size:16px;margin-bottom:5px;color:var(--nm-skin-ink,#edf2fa)}
#nm7-guide-dialog li p{margin:0;font-size:14px;color:var(--nm-skin-muted,#b8c5d9)}
#nm7-guide-dialog .nm7-help-note{color:var(--nm-skin-muted,#b8c5d9);font-size:14px}
#nm7-guide-dialog button{min-width:120px;min-height:44px;font:600 15px system-ui;
 border:1px solid var(--nm-theme-focus,#b5a6ff);border-radius:9px;background:var(--nm-theme-action,#6654ca);color:var(--nm-theme-on-action,#fff);cursor:pointer;padding:9px 18px}
#nm7-guide-dialog :focus-visible,#nm7-guide-open:focus-visible{outline:3px solid var(--nm-theme-focus,#b5a6ff);outline-offset:3px}
@media(prefers-reduced-motion:reduce){#nm7-guide-dialog,#nm7-guide-dialog *{animation:none!important;transition:none!important}}
`;
   document.head.append(style);
  }
  let dialog=document.getElementById('nm7-guide-dialog');
  if(!dialog){
   dialog=document.createElement('dialog');dialog.id='nm7-guide-dialog';
   dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
   dialog.setAttribute('aria-labelledby','nm7-guide-title');
   dialog.setAttribute('aria-describedby','nm7-guide-intro');
   dialog.className='nm6-skiptranslate';
   const title=document.createElement('h2');title.id='nm7-guide-title';
   const intro=document.createElement('p');intro.id='nm7-guide-intro';
   const steps=document.createElement('ol');steps.id='nm7-guide-steps';
   for(let i=0;i<3;i++){
    const li=document.createElement('li'),h=document.createElement('strong'),
          p=document.createElement('p');
    li.append(h,p);steps.append(li);
   }
   const note=document.createElement('p');note.id='nm7-guide-note';
   note.className='nm7-help-note';
   const close=document.createElement('button');close.type='button';
   close.id='nm7-guide-close';close.addEventListener('click',()=>dialog.close());
   let closingWithApp=false;
   root.NeuroMapLifecycle?.registerDraft({hasPending:()=>dialog.open,confirmClose:async()=>{closingWithApp=true;dialog.close();return true}});
   dialog.addEventListener('close',()=>{
    if(closingWithApp){closingWithApp=false;return;}
    // The opener now lives in Help, which closes when the dialog opens.
    const target=button.closest?.('.dropdown-panel.hidden')
      ?document.getElementById('btn-menu-help'):button;
    (target||button).focus();
   });
   dialog.append(title,intro,steps,note,close);document.body.append(dialog);
  }
  function translate(){
   const c=current();
   button.textContent='? '+c.open;
   button.title=c.label;button.setAttribute('aria-label',c.label);
   dialog.setAttribute('aria-label',c.label);
   document.getElementById('nm7-guide-title').textContent=c.title;
   document.getElementById('nm7-guide-intro').textContent=c.intro;
   document.getElementById('nm7-guide-note').textContent=c.note;
   document.getElementById('nm7-guide-close').textContent=c.close;
   const steps=dialog.querySelectorAll('li');
   for(let i=0;i<3;i++){
    steps[i].querySelector('strong').textContent=c.steps[i][0];
    steps[i].querySelector('p').textContent=c.steps[i][1];
   }
  }
  button.addEventListener('click',()=>{
   translate();
   if(!dialog.open){dialog.showModal();document.getElementById('nm7-guide-close').focus();}
  });
  if(typeof root.MutationObserver==='function'){
   const observer=new root.MutationObserver(()=>{if(dialog.open)translate();else{
    button.textContent='? '+current().open;button.title=current().label;
    button.setAttribute('aria-label',current().label);
   }});
   observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  }
  translate();
 }
 root.NeuroMapFirstStepsInstall=install;
})(globalThis);
