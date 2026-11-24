/* NeuroMap Android preview: no developer entitlement or secret is embedded. */
(()=>{'use strict';
  const mobileText=value=>window.GlaukaI18n?.translate(value)||NeuroMapLocale.translate(value,document.documentElement.lang);
  // Native Android AI response dispatcher (license enforced before networking).
  window.nmAndroidAiReply=(id,json)=>{
    const entry=window.nmAndroidAiPending?.get(id);if(!entry)return;
    window.nmAndroidAiPending.delete(id);
    try{entry.resolve(JSON.parse(json))}catch(e){entry.reject(e)}
  };
  // Redirect download actions to Android Storage Access Framework when packaged in WebView.
  // No privileged bridge is exposed when viewing this file in Chrome.
  const originalClick=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){
    const bridge=window.NMAndroid;
    if(bridge&&typeof bridge.saveProject==='function'&&
       window.NeuroMapLifecycle?.androidExport&&this.download&&this.href.startsWith('blob:')){
      const filename=String(this.download||'mappa.neuromap').replace(/[\\/]/g,'_').slice(0,120);
      // Even legacy <a download> actions use the same acknowledged native
      // request as modern PNG, Markdown, XMind and full-workspace exports.
      fetch(this.href).then(r=>{
        if(!r.ok)throw Error('File esportato non disponibile');
        return r.blob();
      }).then(blob=>window.NeuroMapLifecycle.androidExport(blob,filename))
        .then(ok=>{if(!ok)feedback('Esportazione annullata');})
        .catch(e=>feedback('Salvataggio non riuscito: '+e.message));
      return;
    }
    return originalClick.call(this);
  };
  function feedback(message){let node=document.getElementById('mobile-feedback');if(!node){node=document.createElement('div');node.id='mobile-feedback';document.body.appendChild(node)}node.textContent=message;clearTimeout(feedback.timer);feedback.timer=setTimeout(()=>node.remove(),3200)}
  function dock(action){const app=window.neuroMapApp;const canvas=document.getElementById('mindmap-canvas');if(!app)return feedback('Attendi il caricamento della mappa');
    try{switch(action){
      case 'child':document.getElementById('quick-icon-child')?.click();break;
      case 'edit':if(app.state?.selectedNodeId)app.editSelected();else feedback('Tocca prima un nodo');break;
      case 'file':if(window.NMAndroid?.pickProjectDocument&&window.NeuroMapLifecycle?.androidOpenProject)window.NeuroMapLifecycle.androidOpenProject(null);else document.getElementById('file-import-input')?.click();break;
      case 'center':app.fitToScreen();break;
      case 'style':document.getElementById('btn-toggle-inspector')?.click();break;
      case 'add':{
        const candidates=[[.77,.63],[.23,.65],[.72,.78],[.28,.37],[.82,.36]];
        const found=candidates.map(([a,b])=>({x:innerWidth*a,y:innerHeight*b})).find(p=>!app.findHit(p.x,p.y));
        if(!found){feedback('Sposta la mappa e riprova');break;}
        const x=found.x,y=found.y;
        const e=new MouseEvent('dblclick',{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,view:window});canvas.dispatchEvent(e);
        break;
      }
    }}catch(err){feedback(err.message||'Comando non disponibile')}
  }
  document.addEventListener('DOMContentLoaded',async()=>{if(window.GlaukaAppReady)await window.GlaukaAppReady;
    setTimeout(()=>{
    // Shared plan panel: the native signed license controls both retail and private previews.
    document.getElementById('nm6-license-input')?.setAttribute('autocapitalize','none');
    window.nmProduct?.syncBadge();
    // Native on-screen focus/tap feedback must not cover the whole Canvas.
    document.getElementById('mindmap-canvas')?.setAttribute('tabindex','-1');
    },0);

    const c=document.getElementById('mindmap-canvas');
    document.querySelectorAll('#mobile-dock button').forEach(b=>b.addEventListener('click',()=>dock(b.dataset.mobile)));
    // Map gestures are owned by mobile-gestures.js before canvas drag listeners.
    c.addEventListener('contextmenu',e=>e.preventDefault());
  });
})();
