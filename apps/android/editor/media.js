    NeuroMapApp.prototype.nm54SyncSettings=function(){
      const current=this.state.findNode(this.state.selectedNodeId);
      const chars=Math.max(8,Math.min(60,Number(current?.labelWrapChars||this.state.defaultLabelWrapChars)||18));
      const global=Math.max(8,Math.min(60,Number(this.state.defaultLabelWrapChars)||18));
      const selected=nm54('nm54-wrap-slider'),all=nm54('nm54-map-wrap-slider');
      if(selected&&document.activeElement!==selected)selected.value=chars;
      if(all&&document.activeElement!==all)all.value=global;
      if(nm54('nm54-wrap-label'))nm54('nm54-wrap-label').textContent=chars+' caratteri';
      if(nm54('nm54-map-wrap-label'))nm54('nm54-map-wrap-label').textContent=String(global);
      for(const el of document.querySelectorAll('#nm54-style-grid button'))el.setAttribute('aria-pressed',String((this.state.branchStyle||'neon')===el.dataset.style));
      const thickness=document.getElementById('nm63-stroke-range');
      if(thickness&&!thickness.dataset.bound){thickness.dataset.bound='1';
        thickness.addEventListener('input',()=>{const out=document.getElementById('nm63-stroke-value');if(out)out.textContent=Math.round(Number(thickness.value)*100)+'%';});
        thickness.addEventListener('change',()=>{const value=Math.round(Number(thickness.value)*10)/10;
          if(!Number.isFinite(value)||this.state.strokeScale===value)return;
          this.state.pushHistory();this.state.strokeScale=value;this.markChanged();this.nm54SyncSettings();});}
      if(thickness&&document.activeElement!==thickness)thickness.value=this.state.strokeScale||1;
      const thickValue=document.getElementById('nm63-stroke-value');
      if(thickValue)thickValue.textContent=Math.round((this.state.strokeScale||1)*100)+'%';
      const rootGap=Number.isFinite(+this.state.rootBranchGap)?Math.max(0,Math.min(36,+this.state.rootBranchGap)):14;
      const gapInput=document.getElementById('nm-root-branch-gap');
      if(gapInput&&!gapInput.dataset.bound){gapInput.dataset.bound='1';
        gapInput.addEventListener('input',()=>{const out=document.getElementById('nm-root-branch-gap-value');const v=Number(gapInput.value)||0;if(out)out.textContent=v===0?'Attaccato':v+' px';});
        gapInput.addEventListener('change',()=>{const value=Math.round(Math.max(0,Math.min(36,Number(gapInput.value)||0)));
          if(this.state.rootBranchGap===value)return;
          this.state.pushHistory();this.state.rootBranchGap=value;this.markChanged();this.nm54SyncSettings();});}
      if(gapInput&&document.activeElement!==gapInput)gapInput.value=rootGap;
      const gapOut=document.getElementById('nm-root-branch-gap-value');
      if(gapOut)gapOut.textContent=rootGap===0?'Attaccato':rootGap+' px';
      const detach=document.getElementById('nm-root-branch-detach');
      if(detach&&!detach.dataset.bound){detach.dataset.bound='1';
        detach.addEventListener('change',()=>{const next=detach.checked?(this._nmLastRootGap||14):0;
          if((Number(this.state.rootBranchGap)||0)>0)this._nmLastRootGap=Number(this.state.rootBranchGap);
          this.state.pushHistory();this.state.rootBranchGap=next;this.markChanged();this.nm54SyncSettings();});}
      if(detach)detach.checked=rootGap>0;
    };
    NeuroMapApp.prototype.nm54ApplyWrapSelected=function(value){
      const n=Math.max(8,Math.min(60,Number(value)||18));
      const nodes=this.v6SelectedNodes?.()||[];if(!nodes.length)return;
      if(nodes.every(x=>x.labelWrapChars===n))return;
      this.state.pushHistory();nodes.forEach(node=>node.labelWrapChars=n);
      this.markChanged();this.nm54SyncSettings();
      this.showToast('Testo a capo: '+n+' caratteri su '+nodes.length+' nodo/i','STILE');
    };
    NeuroMapApp.prototype.nm54ApplyWrapMap=function(value){
      const n=Math.max(8,Math.min(60,Number(value)||18));if(this.state.defaultLabelWrapChars===n)return;
      this.state.pushHistory();this.state.defaultLabelWrapChars=n;this.markChanged();this.nm54SyncSettings();
    };
    NeuroMapApp.prototype.nm54Style=function(name){
      if(!['neon','xmind8','buzan','thickparents','simple','radial','elbow','straight','arc','dashed','wave','fork'].includes(name)||this.state.branchStyle===name)return;
      this.state.pushHistory();this.state.branchStyle=name;this.markChanged();this.nm54SyncSettings();
      if(name==='radial'||this._nm63PreviousStyle==='radial')this.fitToScreen();
      this._nm63PreviousStyle=name;
    };
    NeuroMapApp.prototype.nm54OpenIllustrate=async function(mode='node'){
      this.hideMenus();this.nm54IconNodeId=this.state.selectedNodeId;
      this.nm54IconTabId=this.activeTabId;
      nm54('nm54-illustration-modal').classList.remove('hidden');
      this.nm54SwitchIllustrate(mode);
      if(mode==='node'){
        const node=this.state.findNode(this.nm54IconNodeId);
        nm54('nm54-node-name').textContent=node?'Nodo: '+node.text:'Seleziona un nodo da illustrare';
        nm54('nm54-icon-results').textContent='Preparazione della ricerca…';
        if(node){const keyword=await get_iconify_keyword(node.text);if(!this.nm54IsModalOpen())return;
          nm54('nm54-icon-query').value=keyword;
          if(keyword)await this.nm54SearchIcons(keyword);
        }
      }
    };
    NeuroMapApp.prototype.nm54IsModalOpen=function(){return !nm54('nm54-illustration-modal').classList.contains('hidden')};
    NeuroMapApp.prototype.nm54SwitchIllustrate=function(mode){
      const isNode=mode==='node';nm54('nm54-node-panel').classList.toggle('hidden',!isNode);
      nm54('nm54-bulk-panel').classList.toggle('hidden',isNode);
      nm54('nm54-tab-node').setAttribute('aria-selected',String(isNode));
      nm54('nm54-tab-bulk').setAttribute('aria-selected',String(!isNode));
    };
    NeuroMapApp.prototype.nm54CloseIllustrate=function(){
      if(this.nm54Running){this.nm54Stop=true;nm54('nm54-progress').textContent='Interruzione richiesta…';return;}
      nm54('nm54-illustration-modal').classList.add('hidden');
    };
    NeuroMapApp.prototype.nm54SearchIcons=async function(value){
      const target=nm54('nm54-icon-results');const token=this.nm54SearchToken=(this.nm54SearchToken||0)+1;
      target.textContent='Ricerca in corso…';
      try{
        const icons=await nm54FindIcons(value);
        if(token!==this.nm54SearchToken||!this.nm54IsModalOpen())return;
        target.replaceChildren();
        if(!icons.length){target.textContent='Nessuna illustrazione trovata. Prova un altro termine inglese.';return;}
        for(const icon of icons){
          const btn=document.createElement('button');btn.type='button';btn.className='nm54-icon';
          const img=document.createElement('img');img.alt='';img.loading='lazy';
          img.src='https://api.iconify.design/'+icon.prefix+'/'+icon.name+'.svg';
          const caption=document.createElement('span');caption.textContent=icon.name.replace(/-/g,' ');
          btn.append(img,caption);
          btn.addEventListener('click',async()=>{
            btn.disabled=true;caption.textContent='Scaricamento…';
            try{
              const illustration=await nm54DownloadIcon(icon,value);
              if(!this.nm54IsModalOpen()||this.activeTabId!==this.nm54IconTabId)return;
              const node=this.state.findNode(this.nm54IconNodeId);
              if(!node){this.showToast('Il nodo non esiste più','ICONIFY');return;}
              this.state.pushHistory();node.illustration=illustration;this.markChanged();
              caption.textContent='✓ Applicata';this.showToast('Illustrazione inserita (disponibile offline)','ICONIFY');
            }catch(err){caption.textContent='Errore';this.showToast('Icona non applicata: '+err.message,'ICONIFY');}
            finally{btn.disabled=false;}
          });target.append(btn);
        }
      }catch(err){if(token===this.nm54SearchToken)target.textContent='Ricerca non disponibile: '+err.message;}
    };
    NeuroMapApp.prototype.nm54AutoIllustrate=async function(){
      if(this.nm54Running)return;
      const chosen=document.querySelector('input[name="nm54-depth"]:checked')?.value||'1';
      const levels={1:[1],12:[1,2],2:[2],123:[1,2,3]}[chosen]||[1];
      const replaceExisting=nm54('nm54-overwrite').checked;
      const workState=this.state,tabId=this.activeTabId,targets=[];
      const walk=(node,depth)=>{if(levels.includes(depth)&&(!node.illustration||replaceExisting)&&!node.isSummary)targets.push(node);
        for(const child of node.children||[])walk(child,depth+1);};
      walk(workState.root,0);
      const max=100,selected=targets.slice(0,max);
      if(!selected.length){nm54('nm54-progress').textContent='Nessun nodo da illustrare ai livelli scelti.';return;}
      this.nm54Running=true;this.nm54Stop=false;
      const btn=nm54('nm54-bulk-start');btn.textContent='■ Interrompi';btn.classList.remove('primary');
      const indicator=nm54('nm54-progress');let success=0,missed=0,historyTaken=false;
      try{
        for(let i=0;i<selected.length&&!this.nm54Stop;i++){
          if(this.activeTabId!==tabId){this.nm54Stop=true;break;}
          const node=selected[i];indicator.textContent='Nodo '+(i+1)+' / '+selected.length+' · '+success+' illustrazioni inserite';
          try{
            const keyword=await get_iconify_keyword(node.text);
            if(!keyword||['node','other','misc','generic','none','various'].includes(keyword)){missed++;continue;}
            const result=await nm54FindIcons(keyword);
            if(!result.length){missed++;continue;}
            const illustration=await nm54DownloadIcon(result[0],keyword);
            if(this.nm54Stop)break;
            if(!historyTaken){workState.pushHistory();historyTaken=true;}
            node.illustration=illustration;success++;
            // Update the canvas periodically, without a new undo entry each time.
            if(success%6===0)this.recalculateAndRender(true);
          }catch(_){missed++;}
          if(i%3===0)await new Promise(resolve=>setTimeout(resolve,0));
        }
      }finally{
        if(success)this.markChanged();
        indicator.textContent='Completato: '+success+' aggiunte, '+missed+' ignorate'+(this.nm54Stop?' · interrotto':'')+(targets.length>max?' · massimo 100 per volta':'');
        btn.textContent='✨ Avvia';btn.classList.add('primary');this.nm54Running=false;this.nm54Stop=false;
      }
    };
    const nm54OldBind=NeuroMapApp.prototype.bindUI;
    NeuroMapApp.prototype.bindUI=function(...args){
      const output=nm54OldBind.apply(this,args);
      const by=(id,fn)=>nm54(id)?.addEventListener('click',fn);
      by('btn-illustrate',()=>this.nm54OpenIllustrate('node'));
      by('ctx-iconify-search',()=>this.nm54OpenIllustrate('node'));
      by('menu-iconify-single',()=>this.nm54OpenIllustrate('node'));
      by('menu-iconify-bulk',()=>this.nm54OpenIllustrate('bulk'));
      by('nm54-close',()=>this.nm54CloseIllustrate());
      nm54('nm54-illustration-modal').addEventListener('pointerdown',event=>{
        if(event.target.id==='nm54-illustration-modal')this.nm54CloseIllustrate();});
      document.addEventListener('keydown',event=>{
  if(event.target?.closest?.('.nm-creative-shade,#nm-drawing-toolbar,#nm-ai-studio'))return;
        if(event.key==='Escape'&&this.nm54IsModalOpen()){
          event.preventDefault();event.stopImmediatePropagation();this.nm54CloseIllustrate();}
      },true);
      by('nm54-tab-node',()=>this.nm54SwitchIllustrate('node'));
      by('nm54-tab-bulk',()=>this.nm54SwitchIllustrate('bulk'));
      by('nm54-icon-search',()=>this.nm54SearchIcons(nm54('nm54-icon-query').value.trim()));
      nm54('nm54-icon-query').addEventListener('keydown',event=>{
        if(event.key==='Enter'){event.preventDefault();this.nm54SearchIcons(event.target.value.trim());}});
      by('nm54-icon-remove',()=>{
        const node=this.state.findNode(this.nm54IconNodeId);
        if(!node?.illustration||this.activeTabId!==this.nm54IconTabId)return;
        this.state.pushHistory();node.illustration=null;this.markChanged();
        this.showToast('Illustrazione rimossa','ICONIFY');
      });
      by('nm54-bulk-start',()=>{if(this.nm54Running){this.nm54Stop=true;return;}this.nm54AutoIllustrate();});
      // Input previews do not push a history snapshot every mouse movement.
      const nodeWrap=nm54('nm54-wrap-slider'),mapWrap=nm54('nm54-map-wrap-slider');
      nodeWrap.addEventListener('input',e=>nm54('nm54-wrap-label').textContent=e.target.value+' caratteri');
      nodeWrap.addEventListener('change',e=>this.nm54ApplyWrapSelected(e.target.value));
      mapWrap.addEventListener('input',e=>nm54('nm54-map-wrap-label').textContent=e.target.value);
      mapWrap.addEventListener('change',e=>this.nm54ApplyWrapMap(e.target.value));
      for(const button of document.querySelectorAll('#nm54-style-grid [data-style]'))button.addEventListener('click',()=>this.nm54Style(button.dataset.style));
      const originalStatus=this.updateStatus;
      this.updateStatus=function(){originalStatus.call(this);this.nm54SyncSettings();};
      this.nm54SyncSettings();return output;
    };
    // Preserve styles when switching tabs and rebuilding the layout.
    const nm54OldActivate=NeuroMapApp.prototype.activateTab;
    NeuroMapApp.prototype.activateTab=function(...args){const result=nm54OldActivate.apply(this,args);this.nm54SyncSettings?.();return result;};

