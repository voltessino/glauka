    const v6PrevBind=NeuroMapApp.prototype.bindUI;
    NeuroMapApp.prototype.bindUI=function(){
      v6PrevBind.call(this);
      // Preserve the existing UI markup while replacing the browser-native select popup.
      const select=v6El('v5-font-preset'),trigger=v6El('v6-preset-trigger'),menu=v6El('v6-preset-menu');
      const sync=()=>{
        const preset=this.state.typographyPreset||'uniform';
        v6El('v6-preset-label').textContent=V6_PRESET_NAMES[preset]||'Uniforme';
        select.value=preset;
        const saved=v6PreferredPreset();v6El('v6-default-name').textContent='Predefinito: '+V6_PRESET_NAMES[saved];
        const same=saved===preset;v6El('v6-set-default').textContent=same?'★ È il predefinito':'☆ Usa come predefinito';
        menu.querySelectorAll('[data-v6-preset]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.v6Preset===preset)));
      };
      this.v6SyncFonts=sync;sync();
      const toggleMenu=(isOpen)=>{const open=isOpen??menu.classList.contains('hidden');menu.classList.toggle('hidden',!open);trigger.setAttribute('aria-expanded',String(open));};
      trigger.addEventListener('click',()=>toggleMenu());
      menu.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{
        select.value=button.dataset.v6Preset;select.dispatchEvent(new Event('change',{bubbles:true}));toggleMenu(false);sync();
      }));
      document.addEventListener('pointerdown',e=>{if(!v6El('v6-preset-wrap').contains(e.target))toggleMenu(false);});
      document.addEventListener('keydown',e=>{
  if(e.target?.closest?.('.nm-creative-shade,#nm-drawing-toolbar,#nm-ai-studio'))return;if(e.key==='Escape')toggleMenu(false);});
      v6El('v6-set-default').addEventListener('click',()=>{
        const preset=this.state.typographyPreset||'uniform';
        try{localStorage.setItem(V6_PREF_KEY,preset);}catch(e){console.warn('Default font not saved:',e);}
        sync();this.showToast(V6_PRESET_NAMES[preset]+' sarà il profilo delle mappe aperte in futuro','PREDEFINITO');
      });
      // Keep the inspector accurate after a tab switch or keyboard undo.
      const priorStatus=this.updateStatus;
      this.updateStatus=function(){priorStatus.call(this);sync();};
      // All actions below are intercepted in capture phase: original single-node
      // listeners never execute, so there is exactly one Undo step per action.
      const intercept=(ids,callback,eventName='click')=>{
        for(const id of ids){v6El(id)?.addEventListener(eventName,e=>{e.preventDefault();e.stopImmediatePropagation();callback(e);},true);}
      };
      intercept(['menu-invert-branch','quick-icon-invert','ctx-invert-branch'],()=>this.v6InvertSelection());
      intercept(['btn-weight-normal'],()=>this.v6WeightSelection(400));
      intercept(['btn-weight-bold'],()=>this.v6WeightSelection(700));
      intercept(['quick-icon-boundary','ctx-toggle-boundary'],()=>this.v6BoundarySelection());
      intercept(['ctx-toggle-collapse'],()=>this.v6CollapseSelection());
      intercept(['inspector-color-picker'],e=>this.v6ColorSelection(e.target.value),'change');
      // Color swatches are generated in the earlier binder.
      v6El('inspector-swatch-grid')?.addEventListener('click',e=>{
        const swatch=e.target.closest('button.color-swatch');
        if(swatch){e.preventDefault();e.stopImmediatePropagation();this.v6ColorSelection(swatch.dataset.color||swatch.style.backgroundColor);}
      },true);
      // Compact layout telemetry; persist preference per desktop profile.
      const hud=document.querySelector('.hud-bottom-left'),minibtn=v6El('v6-show-layout');
      const setHudVisible=visible=>{
        hud?.classList.toggle('hidden',!visible);
        if(minibtn){
          minibtn.classList.remove('hidden');
          minibtn.classList.toggle('is-active',visible);
          minibtn.setAttribute('aria-expanded',String(visible));
          minibtn.setAttribute('aria-pressed',String(visible));
        }
        try{localStorage.setItem('neuromap.hud.layout.visible.v6',visible?'1':'0');}catch(_){}
      };
      let visible=false;try{visible=localStorage.getItem('neuromap.hud.layout.visible.v6')==='1';}catch(_){}
      setHudVisible(visible);
      v6El('v6-hide-layout')?.addEventListener('click',()=>setHudVisible(false));
      minibtn?.addEventListener('click',()=>setHudVisible(hud?.classList.contains('hidden')??true));
      v6El('v6-toggle-layout')?.addEventListener('click',()=>{setHudVisible(hud.classList.contains('hidden'));this.hideMenus();});
      // Native Open has the original absolute filename, which the browser File
      // picker intentionally does not disclose. Ctrl+O uses these menu controls.
      if(window.neuromapDesktop?.openProject){
        const importNative=async(newTab)=>{
          try{
            if(newTab&&window.neuromapDesktop.openProjects){
              const files=await window.neuromapDesktop.openProjects();
              if(!files.length)return;
              let imported=0;
              for(const file of files){
                try{await this.v6ImportNative(file,true);imported++;}
                catch(e){this.showToast('File '+file.filename+': '+e.message,'ERRORE');}
                await new Promise(resolve=>setTimeout(resolve,0));
              }
              this.showToast(imported+' documenti aperti','FILE');
            }else{const payload=await window.neuromapDesktop.openProject();if(payload&&!payload.cancelled)await this.v6ImportNative(payload,newTab);}
          }catch(error){this.showToast('Apertura fallita: '+error.message,'ERRORE');}
        };
        intercept(['btn-import-files-new-tabs'],()=>importNative(true));
        intercept(['btn-import-file-current'],()=>importNative(false));
        // The original Ctrl+O handler clicks #file-import-input directly.
        // Override via keydown capture before the page's normal handler.
        document.addEventListener('keydown',e=>{
  if(e.target?.closest?.('.nm-creative-shade,#nm-drawing-toolbar,#nm-ai-studio'))return;
          if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='o'){
            e.preventDefault();e.stopImmediatePropagation();importNative(true);
          }
        },true);
      }
      const keylabel=v6El('v6-ai-remember-label');
      if(keylabel && window.neuromapDesktop?.saveAISecret){
        keylabel.textContent='Ricorda la chiave su questo PC (protetta con Windows)';
        v6El('v6-key-status').textContent='La chiave è protetta con le credenziali Windows; non appare nei backup delle mappe.';
      } else if(keylabel){
        keylabel.textContent='Ricorda la chiave soltanto per questa sessione';
      }
      // AI settings use a single source of truth. The desktop secret is stored
      // only after deliberate Save; the preference is restored next launch.
      const aiSave=v6El('ai-settings-save');
      aiSave?.addEventListener('click',()=>{if(!window.neuromapDesktop?.saveAISecret)return;
        const persist=v6El('ai-remember').checked,key=v6El('ai-key').value.trim();
        window.neuromapDesktop.saveAISecret({key,remember:persist})
          .then(()=>{v6El('v6-key-status').textContent=persist&&key?'✓ Chiave protetta e conservata sul PC':'Chiave non conservata sul PC.';})
          .catch(e=>{this.showToast('Chiave AI non salvata: '+e.message,'ERRORE');});
      },true);
      if(this.aiClient && window.neuromapDesktop?.readAISecret){
        window.neuromapDesktop.readAISecret().then(result=>{
          if(result?.remember){this.aiClient.settings.rememberSession=true;this.aiClient.apiKey=result.key||'';
            // Reflect the value if modal is already open, without overwriting typing.
            if(v6El('ai-settings-modal')&&!v6El('ai-settings-modal').classList.contains('hidden')&&!v6El('ai-key').value){
              v6El('ai-key').value=this.aiClient.apiKey;v6El('ai-remember').checked=true;
            }
          }
        }).catch(error=>console.warn('Chiave AI protetta non disponibile:',error));
      }
    };
    const v6OldOpenAI=NeuroMapApp.prototype.openAISettings;
    NeuroMapApp.prototype.openAISettings=function(){v6OldOpenAI.call(this);
      if(window.neuromapDesktop?.readAISecret){window.neuromapDesktop.readAISecret().then(result=>{
        if(!result)return;
        if(result.remember){v6El('ai-remember').checked=true;if(!v6El('ai-key').value){v6El('ai-key').value=result.key||'';this.aiClient.apiKey=result.key||'';}}
      }).catch(()=>{});}
    };
    const v6OldActivate=NeuroMapApp.prototype.activateTab;
    NeuroMapApp.prototype.activateTab=function(...args){const r=v6OldActivate.apply(this,args);this.v6SyncFonts?.();return r;};


    // NeuroMap Desktop 5.4 — native-feeling app dialogs, reliable Ctrl+S/Open,
    // and menus that remain usable on narrow windows.
    const nmOldHideMenus=NeuroMapApp.prototype.hideMenus;
    NeuroMapApp.prototype.hideMenus=function(){
      nmOldHideMenus.call(this);
      document.querySelectorAll('.nm-menu-flip').forEach(menu=>menu.classList.remove('nm-menu-flip'));
    };
    NeuroMapApp.prototype.nmAsk= function({title='Conferma',message='',choices=[{value:'cancel',text:'Annulla'}, {value:'yes',text:'Conferma',primary:true}] }={}){
      return new Promise(resolve=>{
        const overlay=document.getElementById('nm-decision-overlay'),panel=document.getElementById('nm-decision-panel');
        const actions=document.getElementById('nm-decision-actions');
        document.getElementById('nm-decision-title').textContent=title;
        document.getElementById('nm-decision-text').textContent=message;
        actions.replaceChildren();overlay.classList.remove('hidden');
        const before=document.activeElement;
        let done=false;
        const close=value=>{
          if(done)return;done=true;
          overlay.classList.add('hidden');overlay.removeEventListener('keydown',keys);
          overlay.removeEventListener('click',clickBack);
          before?.focus?.();resolve(value);
        };
        const keys=e=>{
          if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close('cancel');}
          if(e.key==='Tab'){
            const focusables=[...actions.querySelectorAll('button')];
            let i=focusables.indexOf(document.activeElement);
            e.preventDefault();focusables[(i+(e.shiftKey?-1:1)+focusables.length)%focusables.length]?.focus();
          }
          // Prevent global keyboard shortcuts like Ctrl+S while dialog is showing.
          if(e.ctrlKey||e.metaKey)e.stopPropagation();
        };
        const clickBack=e=>{if(e.target===overlay)close('cancel');};
        choices.forEach(c=>{
          const b=document.createElement('button');b.type='button';b.textContent=c.text;
          if(c.primary)b.classList.add('nm-decision-primary');
          if(c.danger)b.classList.add('nm-decision-danger');
          b.addEventListener('click',()=>close(c.value));actions.append(b);
        });
        overlay.addEventListener('keydown',keys);overlay.addEventListener('click',clickBack);
        (actions.querySelector('.nm-decision-primary')||actions.querySelector('button'))?.focus();
      });
    };
    const nmOldCloseTab=NeuroMapApp.prototype.closeTab;
    NeuroMapApp.prototype.closeTab=async function(id=this.activeTabId){
      const tab=this.tabs.find(t=>t.id===id);if(!tab)return;
      if(tab.state.isDirty){
        const choice=await this.nmAsk({title:'Chiudere «'+(tab.title||'questa scheda')+'»?',
          message:'Questa scheda contiene modifiche non ancora esportate. Puoi salvarle nel file originale oppure chiuderla senza esportarle. Il backup automatico resta disponibile.',
          choices:[{value:'cancel',text:'Annulla'},{value:'discard',text:'Chiudi senza salvare',danger:true},{value:'save',text:'Salva e chiudi',primary:true}]});
        if(choice==='cancel')return false;
        if(choice==='save'){
          if(id!==this.activeTabId)this.activateTab(id);
          const saved=await this.saveProjectFile(false);
          if(!saved)return false;
        }
        tab.state.isDirty=false; // confirmation handled here; bypass the old native confirm()
      }
      nmOldCloseTab.call(this,id);
      return true;
    };
    const nmOldDeleteCard=NeuroMapApp.prototype.v5DeleteCard;
    NeuroMapApp.prototype.v5DeleteCard=async function(){
      const c=this.v5CurrentCard();if(!c)return;
      const yes=await this.nmAsk({title:'Eliminare la flashcard?',message:'La domanda e la sua cronologia di ripasso verranno eliminate.',
        choices:[{value:'cancel',text:'Annulla'},{value:'yes',text:'Elimina',danger:true}]});
      if(yes==='yes'){this.studyCards=this.studyCards.filter(x=>x.id!==c.id);this.scheduleSave();this.restartFlashcards();}
    };
    NeuroMapApp.prototype.v5AcceptChanged=async function(){
      const card=this.v5CurrentCard(),node=card&&this.v5FindStudyNode(card);if(!card||!node)return;
      const yes=await this.nmAsk({title:'Confermare domanda aggiornata?',
        message:'Confermi che la domanda e la risposta sono ancora corrette rispetto al nodo modificato? Lo storico del ripasso ricomincerà.',
        choices:[{value:'cancel',text:'Annulla'},{value:'yes',text:'Conferma',primary:true}]});
      if(yes!=='yes')return;
      const tab=this.tabs.find(t=>t.id===card.sourceTabId);card.sourceSignature=this.v5Signature(node,tab?.state);card.srStatus=0;
      card.sr={dueAt:0,lastReviewedAt:0,intervalDays:0,reviews:0,lapses:0};
      this.scheduleSave();this.restartFlashcards();
    };
    const nmOldBindUI=NeuroMapApp.prototype.bindUI;
    NeuroMapApp.prototype.bindUI=function(...args){
      const result=nmOldBindUI.apply(this,args);
      const reset=document.getElementById('menu-new-map');
      reset?.addEventListener('click',async e=>{
        e.preventDefault();e.stopImmediatePropagation();this.hideMenus();
        const answer=await this.nmAsk({title:'Pulire questa mappa?',
          message:'Il contenuto della scheda corrente sarà sostituito da una mappa vuota. Esporta prima un backup se vuoi conservare il contenuto attuale.',
          choices:[{value:'cancel',text:'Annulla'},{value:'yes',text:'Pulisci scheda',danger:true}]});
        if(answer==='yes'){
          this.state=this.newState();this.renderer.state=this.state;this.saveActiveTabSnapshot();
          this.markChanged();this.fitToScreen();this.renderTabBar();
        }
      },true);
      // Always use the main shortcut, never Chromium's native Ctrl+O dialog.
      document.addEventListener('keydown',e=>{
  if(e.target?.closest?.('.nm-creative-shade,#nm-drawing-toolbar,#nm-ai-studio'))return;
        // Ctrl+Shift+O is not an alternate open command. Prevent the underlying
        // browser handler from opening a different file picker.
        if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='o'){
          e.preventDefault();e.stopImmediatePropagation();return;
        }
        if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&!e.shiftKey&&!e.altKey){
          if(!document.getElementById('nm-decision-overlay').classList.contains('hidden'))return;
          e.preventDefault();e.stopImmediatePropagation();this.saveToFile(false);
        }
      },true);
      // Menu dropdowns are positioned to remain within the viewport.
      document.addEventListener('click',e=>{
        const trigger=e.target.closest('[data-dropdown-target]');
        if(!trigger)return;
        const panel=document.getElementById(trigger.dataset.dropdownTarget);
        if(!panel)return;
        requestAnimationFrame(()=>{
          if(panel.classList.contains('hidden'))return;
          const right=panel.getBoundingClientRect().right;
          panel.classList.toggle('nm-menu-flip',right>window.innerWidth-8);
        });
      });
      return result;
    };

