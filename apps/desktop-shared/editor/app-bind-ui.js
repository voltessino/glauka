      bindUI() {
        const $=id=>document.getElementById(id);
        const on=(id,fn)=>$(id)?.addEventListener('click',e=>{this.hideMenus();fn(e);});
        $('find-query').addEventListener('input',()=>this.updateFindResults());
        $('find-query').addEventListener('keydown',e=>{if(e.isComposing||e.keyCode===229)return;if(e.key==='Escape'){e.preventDefault();this.closeFind();}else if(e.key==='Enter'){$('find-results').querySelector('button')?.click();}});
        $('find-close').addEventListener('click',()=>this.closeFind());
        on('btn-new-tab',()=>this.createNewTab());
        on('menu-new-tab',()=>this.createNewTab());
        on('btn-duplicate-tab',()=>this.duplicateTab());
        on('menu-close-tab',()=>this.closeTab());
        on('btn-fullscreen',()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.());
        const help=$('shortcuts-panel');
        on('btn-shortcuts',()=>help.classList.toggle('hidden'));
        on('shortcuts-close',()=>help.classList.add('hidden'));
        on('btn-toggle-inspector',()=>$('inspector-sidebar').classList.toggle('collapsed'));
        on('btn-close-inspector',()=>$('inspector-sidebar').classList.add('collapsed'));
        on('menu-new-map',async()=>{if((await this.nmAsk({title:(globalThis.GlaukaI18n?.pair("Sostituire questa mappa?","Replace this map?")??(document.documentElement.lang==='en'?'Replace this map?':'Sostituire questa mappa?')),message:(globalThis.GlaukaI18n?.pair("La mappa corrente verrà sostituita con una mappa vuota.","The current map will be replaced with an empty one.")??(document.documentElement.lang==='en'?'The current map will be replaced with an empty one.':'La mappa corrente verrà sostituita con una mappa vuota.')),choices:[{value:'cancel',text:(globalThis.GlaukaI18n?.pair("Annulla","Cancel")??(document.documentElement.lang==='en'?'Cancel':'Annulla'))},{value:'replace',text:(globalThis.GlaukaI18n?.pair("Sostituisci","Replace")??(document.documentElement.lang==='en'?'Replace':'Sostituisci')),primary:true}]}))==='replace'){this.state=this.newState();this.renderer.state=this.state;this.saveActiveTabSnapshot();this.markChanged();this.fitToScreen();this.renderTabBar();}});
        on('menu-save-file',()=>this.saveToFile());
        on('menu-save-file-as',()=>this.saveToFile(true));
        on('menu-undo',()=>this.undo());on('menu-redo',()=>this.redo());
        for(const id of ['menu-cut','quick-cut','ctx-cut','ctx-img-cut'])on(id,()=>this.cutSelection());
        for(const id of ['menu-copy','quick-copy','ctx-copy','ctx-img-copy'])on(id,()=>this.copySelection());
        for(const id of ['menu-paste','quick-paste','ctx-paste','ctx-img-paste'])on(id,()=>this.pasteSelection());
        on('menu-select-all',()=>this.selectAllBranches());
        for(const id of ['menu-duplicate-selection','quick-duplicate'])on(id,()=>this.duplicateSelection());
        on('img-close',()=>this.clearSelection());
        on('img-toggle-attach',()=>this.toggleImageMode());
        on('img-toggle-layer',()=>{if(this.state.toggleImageZLayer(this.state.selectedImageId))this.markChanged();});
        on('img-reset-size',()=>{if(this.state.resetImageAspectRatio(this.state.selectedImageId))this.markChanged();});
        on('img-delete',()=>this.deleteSelected());
        const imageSlider=$('img-width-slider');
        let widthChangeStart=null;
        imageSlider.addEventListener('pointerdown',()=>{const img=this.state.findImage(this.state.selectedImageId);
          if(img&&!widthChangeStart){widthChangeStart=img.id;this.state.pushHistory();}});
        imageSlider.addEventListener('input',e=>{
          const img=this.state.findImage(this.state.selectedImageId);if(!img)return;
          if(!widthChangeStart){widthChangeStart=img.id;this.state.pushHistory();}
          const width=Number(e.target.value),ratio=img.width/Math.max(1,img.height);
          img.width=width;img.height=Math.max(25,Math.round(width/ratio));
          this.updateImageControls();this.requestRender();
        });
        imageSlider.addEventListener('change',()=>{widthChangeStart=null;this.markChanged();});

        on('menu-edit-node',()=>this.editSelected());on('menu-delete-node',()=>this.deleteSelected());
        on('menu-add-child',()=>this.addChild());on('quick-icon-child',()=>this.addChild());
        on('menu-add-sibling-cw',()=>this.addSibling());on('quick-icon-sibling',()=>this.addSibling());
        on('menu-add-sibling-ccw',()=>this.addSibling(true));
        on('menu-invert-branch',()=>{if(this.state.invertBranchAndSubbranches(this.state.selectedNodeId))this.markChanged();});
        on('quick-icon-invert',()=>{if(this.state.invertBranchAndSubbranches(this.state.selectedNodeId))this.markChanged();});
        on('menu-center-map',()=>this.fitWholeMap());on('quick-icon-center',()=>this.fitWholeMap());
        on('menu-reset-zoom',()=>this.zoomAt(1/this.renderer.camera.zoom));
        on('btn-zoom-in',()=>this.zoomAt(1.16));on('btn-zoom-out',()=>this.zoomAt(1/1.16));
        on('zoom-percentage',()=>this.zoomAt(1/this.renderer.camera.zoom));
        on('quick-icon-relationship',()=>{this.relationshipSourceId=this.state.selectedNodeId;this.showToast('Clicca sul nodo di destinazione per creare una relazione (Esc annulla)','RELAZIONE');});
        on('quick-icon-boundary',()=>this.toggleBoundary());
        on('quick-icon-summary',()=>this.addSummary());
        on('ctx-add-child',()=>this.addChild());on('ctx-add-sibling',()=>this.addSibling());
        on('ctx-edit-text',()=>this.editSelected());on('ctx-delete-node',()=>this.deleteSelected());
        on('ctx-invert-branch',()=>{if(this.state.invertBranchAndSubbranches(this.state.selectedNodeId))this.markChanged();});
        on('ctx-toggle-boundary',()=>this.toggleBoundary());on('ctx-add-summary',()=>this.addSummary());
        on('ctx-toggle-collapse',()=>{if(this.state.toggleCollapse(this.state.selectedNodeId))this.markChanged();});
        on('ctx-img-delete',()=>this.deleteSelected());
        on('ctx-img-toggle-mode',()=>this.toggleImageMode());
        on('ctx-img-toggle-zlayer',()=>{if(this.state.toggleImageZLayer(this.state.selectedImageId))this.markChanged();});
        on('ctx-img-reset-aspect',()=>{if(this.state.resetImageAspectRatio(this.state.selectedImageId))this.markChanged();});
        const imageInput=$('node-image-input');
        // WebKit on macOS ignores a file button hidden with display:none.
        const revealFileInput=(el)=>{
          if(!el)return;
          el.classList.remove('hidden');
          el.style.setProperty('display','block','important');
          el.style.position='fixed';
          el.style.left='8px';
          el.style.bottom='8px';
          el.style.width='8px';
          el.style.height='8px';
          el.style.opacity='0.02';
          el.style.zIndex='4000';
          el.click();
        };
        const hideFileInput=(el)=>{
          if(!el)return;
          el.classList.add('hidden');
          el.style.display='';
        };
        on('menu-add-image',()=>revealFileInput(imageInput));on('ctx-add-image',()=>revealFileInput(imageInput));
        imageInput?.addEventListener('change',e=>{for(const file of e.target.files){if(file.type.startsWith('image/'))this.io.attachImageFileToNode(file,this.state.selectedNodeId);}imageInput.value='';hideFileInput(imageInput);});
        imageInput?.addEventListener('cancel',()=>hideFileInput(imageInput));
        const threshold=$('threshold-slider'),thresholdMenu=$('menu-threshold-slider'),compact=$('nm67-compact-slider');
        const recordStart=(slider)=>{
          const snapshot=()=>this.state.pushHistory();
          slider.addEventListener('pointerdown',snapshot);
          slider.addEventListener('keydown',e=>{if(['ArrowRight','ArrowLeft','PageUp','PageDown','Home','End'].includes(e.key))snapshot();});
        };
        const setBias=v=>{
          this.state.balanceBias=Math.max(0,Math.min(100,Number(v)||0));
          threshold.value=String(this.state.balanceBias);thresholdMenu.value=String(this.state.balanceBias);
          this.markChanged();
        };
        for(const el of [threshold,thresholdMenu]){recordStart(el);el.addEventListener('input',e=>setBias(e.target.value));}
        recordStart(compact);
        compact.addEventListener('input',e=>{
          this.state.compactness=Math.max(55,Math.min(145,Number(e.target.value)||100));this.markChanged();
        });
        document.querySelectorAll('[data-export]').forEach(b=>b.addEventListener('click',()=>{
          this.hideMenus();
          try {const types={pdf:'exportPDF',png:'exportPNG',svg:'exportSVG',md:'exportMarkdown',opml:'exportOPML',json:'exportJSON','batch-workspace-json':'exportBatchWorkspaceJSON','batch-md':'exportBatchMarkdown'};
            const method=types[b.dataset.export];if(method&&this.io[method])Promise.resolve(this.io[method]()).catch(error=>{console.error(error);this.showToast('Esportazione fallita: '+error.message,'ERRORE');});}
          catch(e){console.error(e);this.showToast(e.message||'Esportazione non riuscita','ERRORE');}
        }));
        document.querySelectorAll('[data-theme-id]').forEach(b=>b.addEventListener('click',()=>{
          if(this.state.applyGlobalTheme(b.dataset.themeId))this.markChanged();
          document.querySelectorAll('[data-theme-id]').forEach(x=>x.classList.toggle('active',x===b));
        }));
        document.querySelectorAll('[data-stroke-scale]').forEach(b=>b.addEventListener('click',()=>{if(this.state.setStrokeScale(Number(b.dataset.strokeScale)))this.markChanged();}));
        $('inspector-fontsize-slider')?.addEventListener('input',e=>{const n=this.state.findNode(this.state.selectedNodeId);if(n){this.state.updateNodeFontSize(n.id,Number(e.target.value));this.markChanged();}});
        on('btn-weight-normal',()=>this.setWeight(400));on('btn-weight-bold',()=>this.setWeight(700));
        const swatches=$('inspector-swatch-grid');
        HARMONIC_PALETTE.forEach(color=>{const b=document.createElement('button');b.className='color-swatch';b.title=color;b.style.background=color;b.dataset.color=color;
          b.onclick=()=>{if(this.state.updateNodeColorWithPropagation(this.state.selectedNodeId,color))this.markChanged();};swatches?.appendChild(b);});
        $('inspector-color-picker')?.addEventListener('change',e=>{if(this.state.updateNodeColorWithPropagation(this.state.selectedNodeId,e.target.value))this.markChanged();});
        const input=$('file-import-input');
        on('btn-import-files-new-tabs',()=>{this.importMode='new';revealFileInput(input);});
        on('btn-import-file-current',()=>{this.importMode='current';revealFileInput(input);});
        input.addEventListener('change',async e=>{
          const files=[...e.target.files];e.target.value='';
          hideFileInput(input);
          await this.importFiles(files,this.importMode==='new');
        });
        input.addEventListener('cancel',()=>hideFileInput(input));
        const pasteModal=$('paste-modal');
        const dismissPaste=()=>pasteModal.classList.add('hidden');
        on('btn-import-paste',()=>{pasteModal.classList.remove('hidden');$('paste-modal-textarea').focus();});
        on('btn-close-paste-modal',dismissPaste);on('btn-cancel-paste',dismissPaste);
        const pasteText=newTab=>{
          try {const {root}=this.parseTextHierarchy($('paste-modal-textarea').value,'md');
            const count=this.importHierarchy(root,{newTab});dismissPaste();this.showToast(count+' nodi creati','INCOLLATO');}
          catch(e){this.showToast(e.message,'ERRORE');}
        };
        on('btn-confirm-paste-current',()=>pasteText(false));on('btn-confirm-paste-newtab',()=>pasteText(true));
        $('inline-editor-input').addEventListener('keydown',e=>{
          e.stopPropagation();
          if(e.isComposing||e.keyCode===229)return;
          if(e.key==='Enter' && !e.shiftKey){e.preventDefault();this.closeEditor(true);}
          else if(e.key==='Escape'){e.preventDefault();this.closeEditor(false);}
          else if(e.key==='Tab'){e.preventDefault();this.closeEditor(true);this.addChild();}
        });
        // Coalesce full tree relayout so fast typing in WKWebView/WebView2 never stutters.
        $('inline-editor-input').addEventListener('input',()=>{
          if(!this.editorNodeId)return;
          this.layout.editingLabel={id:this.editorNodeId,text:$('inline-editor-input').value};
          if(typeof this.scheduleInlineRelayout==='function')this.scheduleInlineRelayout();
          else this.recalculateAndRender();
        });
        $('inline-editor-input').addEventListener('blur',()=>this.closeEditor(true));
        this.canvas.addEventListener('contextmenu',e=>{e.preventDefault();this.closeEditor(true);this.showContextMenu(e.clientX,e.clientY,this.findHit(e.clientX,e.clientY));});
        this.canvas.addEventListener('dblclick',e=>{
          const h=this.findHit(e.clientX,e.clientY);
          if(h?.type==='node'){this.selectNode(h.item.id);this.editSelected();return;}
          if(!h && !e.ctrlKey && !e.altKey && !e.shiftKey){
            const where=this.renderer.screenToWorld(e.clientX,e.clientY);
            this.createFloatingTopicAt(where.x,where.y);
          }
        });
        this.canvas.addEventListener('pointerdown',e=>{
          if(e.button!==0&&e.button!==1)return;
          this.canvas.focus({preventScroll:true});
          this.hideMenus();this.closeEditor(true);
          const hit=this.findHit(e.clientX,e.clientY);
          if(hit?.type==='node'&&e.button===0&&!e.altKey){
            if(this.relationshipSourceId){
              if(this.relationshipSourceId!==hit.item.id){this.state.addRelationship(this.relationshipSourceId,hit.item.id);
                this.markChanged();this.showToast('Relazione creata','RELAZIONE');}
              this.relationshipSourceId=null;return;
            }
            // Pressing a selected node begins a group drag without collapsing it.
            if(e.shiftKey||e.ctrlKey||e.metaKey||!this.state.selectedNodeIds.includes(hit.item.id))
              this.selectNode(hit.item.id,e.shiftKey?'range':(e.ctrlKey||e.metaKey)?'toggle':'single');return;
          }
          if((hit?.type==='image'||hit?.type==='image-handle')&&e.button===0&&!e.altKey){
            this.beginImageDrag(hit,e);return;
          }
          if(!hit&&e.button===0&&!e.altKey&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey)this.clearSelection();
          this.drag={kind:'pan',pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,
            cx:this.renderer.camera.x,cy:this.renderer.camera.y,moved:false};
          this.canvas.setPointerCapture(e.pointerId);
          this.canvas.style.cursor='grabbing';
        });
        this.canvas.addEventListener('pointermove',e=>{
          if(this.drag){
            if(this.drag.pointerId!==e.pointerId)return;
            if(this.drag.kind.startsWith('image-')){this.updateImageDrag(e);return;}
            const dx=e.clientX-this.drag.startX,dy=e.clientY-this.drag.startY;
            this.drag.moved=this.drag.moved||Math.abs(dx)+Math.abs(dy)>3;
            this.renderer.camera.x=this.drag.cx+dx;this.renderer.camera.y=this.drag.cy+dy;
            this.requestRender();this.positionEditor();return;
          }
          const hit=this.findHit(e.clientX,e.clientY);
          const hovered=hit?.type==='node'?hit.item.id:null;
          const hoverImg=hit?.type==='image'||hit?.type==='image-handle'?hit.item.id:null;
          if(this.state.hoveredNodeId!==hovered||this.state.hoveredImageId!==hoverImg){
            this.state.hoveredNodeId=hovered;this.state.hoveredImageId=hoverImg;this.requestRender();}
          this.canvas.style.cursor=hit?.type==='image-handle'?hit.cursor:hit?.type==='image'?'move':hit?'pointer':'grab';
        });
        const endPointer=e=>{
          if(!this.drag||this.drag.pointerId!==e.pointerId)return;
          const d=this.drag;
          if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);
          this.drag=null;
          this.canvas.style.cursor='grab';
          if(d.historyTaken){this.markChanged();this.updateImageControls();}
        };
        this.canvas.addEventListener('pointerup',endPointer);
        this.canvas.addEventListener('pointercancel',endPointer);
        this.canvas.addEventListener('wheel',e=>{
          e.preventDefault();
          if(e.ctrlKey||e.metaKey){
            const prefs=globalThis.NeuroMapAppSettings;
            const trackpad=e.deltaMode===0&&Math.abs(e.deltaY)<40;
            const zoom=prefs?.zoom?.()||{cursor:true};
            const anchor=zoom.cursor?{x:e.clientX,y:e.clientY}:{x:innerWidth/2,y:innerHeight/2};
            // Mouse notches ease toward a stacked target. A trackpad already
            // sends many small steps, so those stay immediate.
            if(this._nmCameraDynamics?.onWheel){
              this._nmCameraDynamics.onWheel({kind:'zoom',deltaY:e.deltaY,trackpad},anchor);
              return;
            }
            const gain=prefs?prefs.wheelGain(trackpad?'trackpad':'mouse'):0.0013;
            this.zoomAt(Math.exp(-Math.max(-240,Math.min(240,e.deltaY))*gain),anchor.x,anchor.y);
            return;
          }
          // Ordinary wheel explores the map, without shrinking its labels.
          const unit=e.deltaMode===1?22:e.deltaMode===2?innerHeight*.75:1;
          const dx=e.shiftKey&&Math.abs(e.deltaX)<1 ? e.deltaY : e.deltaX;
          const dy=e.shiftKey&&Math.abs(e.deltaX)<1 ? 0 : e.deltaY;
          this.stopTeleport?.();this.renderer.camera.x-=Math.max(-160,Math.min(160,dx*unit));
          this.renderer.camera.y-=Math.max(-160,Math.min(160,dy*unit));
          this.requestRender();this.positionEditor();
        },{passive:false});
        this.canvas.addEventListener('click',e=>{
          // pointerdown already selects. Clicking empty space closes context menu.
          if(!this.findHit(e.clientX,e.clientY))this.hideMenus();
        });
        document.addEventListener('click',e=>{
          const trigger=e.target.closest('[data-dropdown-target]');
          if(trigger){
            const panel=$(trigger.dataset.dropdownTarget),open=panel.classList.contains('hidden');
            this.hideMenus();if(open)panel.classList.remove('hidden');
          } else if (!e.target.closest('.dropdown-panel')&&!e.target.closest('#context-menu'))this.hideMenus();
        });
        // Capture Shift+Up/Down before canvas navigation consumes the arrow.
        // Never steal native text selection or keyboard shortcuts in other controls.
        document.addEventListener('keydown', e => {
          if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey ||
              !['ArrowUp', 'ArrowDown'].includes(e.key) ||
              e.isComposing || e.target !== this.canvas || this.editorNodeId || this.drag || this._v5Candidate) return;
          if (!this.selectSiblingRange(e.key === 'ArrowDown' ? 1 : -1)) return;
          e.preventDefault();
          e.stopImmediatePropagation();
        }, true);
        document.addEventListener('keydown',e=>{
  if(e.isComposing||e.keyCode===229)return;
  if(e.defaultPrevented||e.target?.closest?.('[role=dialog],.nm-creative-shade,#nm-drawing-toolbar,#nm-ai-studio,#nm-knowledge-panel'))return;
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.target?.closest?.('#nm616-navigation,#nm616-context,#nm616-minimap-shell'))return;
          const inputFocused=!!e.target.closest('textarea, [contenteditable="true"], input:not([type="range"]):not([type="checkbox"]):not([type="color"]):not([type="file"])');
          const mod=e.ctrlKey||e.metaKey;
          // Buttons and selectors keep their native keyboard activation. Modified
          // Save/Open shortcuts remain available while a toolbar button has focus.
          if(!mod&&!e.altKey&&e.target.closest('button,select,summary,input')&&['Enter',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
          // Preserve native editing and native clipboard behavior inside text fields.
          if(inputFocused){if(e.key==='Escape'&&e.target.id!=='inline-editor-input'){this.closeFind();}return;}
          if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();this.saveToFile(e.shiftKey);return;}
          if(mod&&e.key.toLowerCase()==='o'){e.preventDefault();this.importMode='new';revealFileInput($('file-import-input'));return;}
          if(mod&&e.key.toLowerCase()==='t'){e.preventDefault();this.createNewTab();return;}
          if(mod&&e.key.toLowerCase()==='w'){e.preventDefault();this.closeTab();return;}
          if(mod&&e.key.toLowerCase()==='k'){e.preventDefault();this.openFind();return;}
          if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?this.redo():this.undo();return;}
          if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();this.redo();return;}
          if(e.key==='Escape'){this.relationshipSourceId=null;this.closeFind();this.hideMenus();dismissPaste();help.classList.add('hidden');return;}
          if(!mod&&e.key==='?'&&!e.altKey){e.preventDefault();help.classList.toggle('hidden');return;}
          if(!pasteModal.classList.contains('hidden')||!$('find-overlay').classList.contains('hidden'))return;
          if(mod&&e.key.toLowerCase()==='a'){e.preventDefault();this.selectAllBranches();return;}
          if(mod&&e.key.toLowerCase()==='c'){e.preventDefault();this.copySelection();return;}
          if(mod&&e.key.toLowerCase()==='x'){e.preventDefault();this.cutSelection();return;}
          if(mod&&e.key.toLowerCase()==='v'){
            // Let a native paste event handle images and external text, then fall back to internal nodes.
            // Clipboard event follows keydown in Chromium; don't suppress it.
            return;
          }
          if(mod&&e.shiftKey&&e.key.toLowerCase()==='d'){e.preventDefault();this.duplicateSelection();return;}
          if(mod&&e.key.toLowerCase()==='d'){e.preventDefault();this.duplicateTab();return;}
          if(mod)return;
          // Preserve the established XMind-like Enter=next sibling and
          // Tab=child behavior. Insert and Shift+F10 match linked views.
          if((e.key==='F10'&&e.shiftKey)||e.key==='ContextMenu'){
            e.preventDefault();
            const node=this.state.findNode(this.state.selectedNodeId);
            const metrics=node?this.layout.getLayout(node.id):null;
            const point=metrics?this.renderer.worldToScreen(metrics.x,metrics.y):null;
            const bounds=this.canvas.getBoundingClientRect();
            this.showContextMenu(point?.x??bounds.left+bounds.width/2,
              point?.y??bounds.top+bounds.height/2,node?{type:'node',item:node}:null);
            return;
          }
          if(e.key==='Insert'||e.key==='NumpadInsert'){e.preventDefault();this.addChild();return;}
          if(e.key==='Tab'){e.preventDefault();this.addChild();return;}
          if(e.key==='Enter'){e.preventDefault();this.addSibling(e.shiftKey);return;}
          if(e.key==='F2'||e.key===' '){e.preventDefault();this.editSelected();return;}
          if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();this.deleteSelected();return;}
          if(e.key==='+'||e.key==='='){this.zoomAt(1.14);return;}
          if(e.key==='-'){this.zoomAt(1/1.14);return;}
          if(e.key==='f'&&e.altKey){this.fitToScreen();return;}
          if(!e.altKey&&e.key.length===1&&e.key.trim()){
            e.preventDefault();this.editSelected(e.key);return;
          }
        });
        document.addEventListener('paste',e=>{
          if(e.target.closest('[role=dialog],textarea,[contenteditable="true"], input:not([type="range"]):not([type="checkbox"]):not([type="color"]):not([type="file"])'))return;
          const file=[...(e.clipboardData?.items||[])].find(x=>x.kind==='file'&&x.type.startsWith('image/'))?.getAsFile();
          if(file){e.preventDefault();this.io.attachImageFileToNode(file,
            this.state.selectedImageId?null:this.state.selectedNodeId);return;}
          const pastedText=e.clipboardData?.getData('text/plain');
          if(this.internalClipboard && (!pastedText || pastedText===this._clipboardPlain)){
            e.preventDefault();this.pasteSelection();return;
          }
          if(pastedText){
            e.preventDefault();
            try {this.nm66PasteOutline(pastedText,e.clipboardData?.getData('text/html')||'');}
            catch(error){this.showToast('Testo non importabile: '+error.message,'INCOLLA');}
          }

        });
        const overlay=$('dropzone-overlay');
        document.addEventListener('dragover',e=>{if([...e.dataTransfer?.types||[]].includes('Files')){e.preventDefault();overlay.classList.remove('hidden');}});
        document.addEventListener('dragleave',e=>{if(!e.relatedTarget)overlay.classList.add('hidden');});
        document.addEventListener('drop',async e=>{
          e.preventDefault();overlay.classList.add('hidden');
          const files=[...(e.dataTransfer?.files||[])];
          const isImage=f=>/^image\//i.test(String(f.type||'')) ||
            (!f.type && /\.(?:png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(String(f.name||'')));
          const maps=files.filter(f=>!isImage(f));
          const images=files.filter(isImage);
          // A mixed drop is ambiguous: map imports may switch tabs before the
          // images are attached, making them appear in the wrong document.
          // Reject it atomically instead of silently relocating attachments.
          if(maps.length && images.length){
            this.showToast('Trascina prima i documenti e poi le immagini, separatamente', 'IMPORTAZIONE');
            return;
          }
          if(maps.length)await this.importFiles(maps,true);
          const hit=this.findHit(e.clientX,e.clientY);
          const pos=this.renderer.screenToWorld(e.clientX,e.clientY);
          for(const file of images)this.io.attachImageFileToNode(file,hit?.type==='node'?hit.item.id:null,pos);
        });
      }
