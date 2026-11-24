    NeuroMapApp.prototype.bindV4=function(){
      this.aiClient=new UniversalAIClient();this._spotlightIndex=null;this._spotlightResults=[];this._flashRequeued=new Set();
      const on=(id,fn)=>{const el=$v4(id);if(el)el.addEventListener('click',fn);};
      on('btn-spotlight',()=>this.openFind());on('btn-flashcards',()=>this.openFlashcards());on('btn-ai-settings',()=>this.openAISettings());
      on('btn-ai-expand',()=>this.aiExpandBranch());on('btn-ai-explain',()=>this.aiExplainNode());on('btn-ai-audit',()=>this.aiAuditBranch());
      on('flash-close',()=>this.closeFlashcards());on('flash-reveal',()=>this.revealFlashcard());on('flash-flip-card',()=>this.revealFlashcard());
      on('flash-restart',()=>{this._flashRequeued=new Set();this.restartFlashcards();});
      $v4('flash-filter').addEventListener('change',()=>{this._flashRequeued=new Set();this.restartFlashcards();});
      for(const score of [1,2,3])on('flash-rate-'+score,()=>this.rateFlashcard(score));
      on('flash-teleport',()=>{const node=this.flashcardNode();if(node){this.closeFlashcards();this.teleportToNode(node.id);}});
      on('ai-settings-close',()=>hideV4('ai-settings-modal'));
      on('ai-settings-save',()=>{this.saveAISettings();hideV4('ai-settings-modal');this.showToast('Impostazioni AI salvate (chiave non inclusa nei progetti)','AI');});
      on('ai-preset-apply',()=>{const preset=AI_PRESETS_V4[$v4('ai-preset').value];if(!preset)return;
        $v4('ai-url').value=preset.url;$v4('ai-protocol').value=preset.protocol;$v4('ai-connection-status').textContent='Preset applicato. Puoi modificare liberamente URL e protocollo.';});
      on('ai-model-detect',()=>{this.saveAISettings();this.runAI(async()=>{
        this.setAIStatus('Interrogazione catalogo modelli…');const models=await this.aiClient.listModels();
        const list=$v4('ai-model-list');list.replaceChildren();
        for(const m of models){const opt=document.createElement('option');opt.value=m;list.appendChild(opt);}
        this.setAIStatus(models.length?`${models.length} modelli rilevati. Scegline uno dalla lista o digitane un altro.`:'Nessun modello rilevato; puoi inserirlo a mano.');
      });});
      on('ai-connection-test',()=>{this.saveAISettings();this.runAI(async()=>{
        this.setAIStatus('Test connessione in corso…');const text=await this.aiClient.chat('Rispondi brevemente in italiano.','Rispondi soltanto OK.',{maxTokens:32,timeout:18000});
        this.setAIStatus('✓ Connessione riuscita: '+text.slice(0,100));
      });});
      on('ai-cancel-request',()=>this.aiClient.cancel());
      on('ai-explain-close',()=>hideV4('ai-explain-panel'));
      on('ai-explain-save',()=>{const node=this.state.findNode(this._aiExplanationNode);if(!node||!this._aiExplanation)return;
        this.state.pushHistory();node.notes=this._aiExplanation;this.markChanged();this.showToast('Spiegazione salvata nelle note del nodo','AI NOTE');});
      on('ai-preview-close',()=>hideV4('ai-preview-modal'));
      on('ai-preview-apply',()=>{try{this.applyAIPreview();}catch(e){this.showToast(e.message,'AI ERRORE');}});
      on('ai-from-paste',()=>this.aiFromNotes());
      // Capture-phase keydown overrides the legacy find/keyboard handler without invasive changes.
      document.addEventListener('keydown',e=>{
  if(e.target?.closest?.('.nm-creative-shade,#nm-drawing-toolbar,#nm-ai-studio'))return;
        const mod=e.ctrlKey||e.metaKey;
        if(mod&&['f','k'].includes(e.key.toLowerCase())){
          if(!$v4('ai-settings-modal').classList.contains('hidden')||!$v4('ai-preview-modal').classList.contains('hidden'))return;
          e.preventDefault();e.stopImmediatePropagation();this.openFind();return;
        }
        if(!$v4('flash-modal').classList.contains('hidden')){
          if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.closeFlashcards();return;}
          if([' ','Spacebar','1','2','3','ArrowRight'].includes(e.key)&&!e.target.matches('select,input,textarea')){
            e.preventDefault();e.stopImmediatePropagation();
            if(e.key===' '||e.key==='Spacebar')this.revealFlashcard();
            else if(e.key==='ArrowRight'){this._v5CardIndex=Math.min((this._v5Deck?.length||1)-1,(this._v5CardIndex||0)+1);this._flashShowAnswer=false;this.renderFlashcard();}
            else this.rateFlashcard(Number(e.key));return;
          }
          if(e.key==='Tab')return;
        }
        if(!$v4('find-overlay').classList.contains('hidden') && e.target.id==='find-query'){
          if(['ArrowDown','ArrowUp','Enter'].includes(e.key)){
            e.preventDefault();e.stopImmediatePropagation();
            if(e.key==='ArrowDown')this.setSpotlightActive((this._spotlightActive||0)+1);
            else if(e.key==='ArrowUp')this.setSpotlightActive((this._spotlightActive||0)-1);
            else this.chooseSpotlight(this._spotlightActive||0);
          }
        }
        if(e.key==='Escape'){
          for(const id of ['flash-modal','ai-preview-modal','ai-settings-modal','ai-explain-panel'])hideV4(id);
        }
      },true);
      for(const id of ['flash-modal','ai-preview-modal','ai-settings-modal']){
        $v4(id)?.addEventListener('pointerdown',e=>{if(e.target===$v4(id))hideV4(id);});
      }
      // The native key listener must not turn shortcuts into node labels when a modal is open.
      document.addEventListener('keydown',e=>{
  if(e.target?.closest?.('.nm-creative-shade,#nm-drawing-toolbar,#nm-ai-studio'))return;
        const modal=['flash-modal','ai-settings-modal','ai-preview-modal'].some(id=>!$v4(id).classList.contains('hidden'));
        if(modal && !['Escape'].includes(e.key))e.stopImmediatePropagation();
      },true);
    };
    const v4OldBind=NeuroMapApp.prototype.bindUI;
    NeuroMapApp.prototype.bindUI=function(){v4OldBind.call(this);this.bindV4();};
    const v4OldMark=NeuroMapApp.prototype.markChanged;
    NeuroMapApp.prototype.markChanged=function(...args){this._spotlightIndex=null;return v4OldMark.apply(this,args);};
    const v4OldTab=NeuroMapApp.prototype.activateTab;
    NeuroMapApp.prototype.activateTab=function(id,fit=false){
      if(this._teleportFrame){this._teleportNonce=(this._teleportNonce||0)+1;this.stopTeleport();}
      const result=v4OldTab.call(this,id,fit);this._spotlightIndex=null;
      if(this.renderer)this.renderer.pulse=null;
      return result;
    };
    const v4OldClose=NeuroMapApp.prototype.closeTab;
    NeuroMapApp.prototype.closeTab=function(id){const result=v4OldClose.call(this,id);this._spotlightIndex=null;return result;};
    const v4OldPointer=NeuroMapApp.prototype.zoomAt;
    NeuroMapApp.prototype.zoomAt=function(...args){this._teleportNonce=(this._teleportNonce||0)+1;this.stopTeleport();return v4OldPointer.apply(this,args);};
    // User gestures take priority over a running camera animation.
    const v4OldBindGesture=NeuroMapApp.prototype.bindV4;
    NeuroMapApp.prototype.bindV4=function(){
      v4OldBindGesture.call(this);
      this.canvas.addEventListener('pointerdown',()=>{
        if(this._teleportFrame){this._teleportNonce=(this._teleportNonce||0)+1;this.stopTeleport();}
      },true);
    };
    // Existing knowledge ratings are scheduled for review again when their questions change.
    NeuroMapApp.prototype.invalidateSR=function(id){
      const node=this.state.findNode(id);
      if(node && node.srStatus>0){node.srStatus=2;
        node.sr={...(node.sr||{}),dueAt:Date.now()};this.scheduleSave();this.requestRender();}
    };
    const v4OldChild=NeuroMapApp.prototype.addChild;
    NeuroMapApp.prototype.addChild=function(){const id=this.state.selectedNodeId;v4OldChild.call(this);this.invalidateSR(id);};
    const v4OldSibling=NeuroMapApp.prototype.addSibling;
    NeuroMapApp.prototype.addSibling=function(...args){const parent=this.state.findNode(this.state.selectedNodeId)?.parentId;
      v4OldSibling.apply(this,args);if(parent)this.invalidateSR(parent);};
    const v4OldDelete=NeuroMapApp.prototype.deleteSelected;
    NeuroMapApp.prototype.deleteSelected=function(){const parent=this.state.findNode(this.state.selectedNodeId)?.parentId;
      v4OldDelete.call(this);if(parent)this.invalidateSR(parent);};
    const v4OldPaste=NeuroMapApp.prototype.pasteSelection;
    NeuroMapApp.prototype.pasteSelection=function(...args){const node=this.state.findNode(this.state.selectedNodeId);
      const parent=node?.parentId||this.state.root.id;
      v4OldPaste.apply(this,args);this.invalidateSR(parent);};

