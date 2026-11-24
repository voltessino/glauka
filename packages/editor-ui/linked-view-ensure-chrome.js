    if(!document.getElementById('nm-view-styles')){
      const style=document.createElement('style');style.id='nm-view-styles';style.textContent=CSS;document.head.append(style);
    }
    // Android shell hides .topbar; park the switch in #glauka-app-header when ready.
    const placeMobileViewSwitch=row=>{
      if(!row||!root.GlaukaMobile)return;
      const host=document.getElementById('glauka-app-header');
      if(!host||host.contains(row))return;
      const before=document.getElementById('glauka-ai-open')||document.getElementById('glauka-undo');
      if(before)before.before(row);else host.append(row);
    };
    if(document.getElementById('nm-view-picker')){
      placeMobileViewSwitch(document.getElementById('nm-view-switch'));
      return;
    }
    // Mobile: Glauka header (visible) → body fallback. Desktop: HUD / layout modes.
    const parent=root.GlaukaMobile
      ?(document.getElementById('glauka-app-header')||document.body)
      :(document.getElementById('nm-layout-modes')?.parentElement||document.querySelector('.hud-bottom-left')||document.querySelector('.topbar'));
    if(!parent)return;
    const row=document.createElement('div');row.id='nm-view-switch';row.className='nm6-skiptranslate';row.setAttribute('role','group');
    const label=document.createElement('label');label.htmlFor='nm-view-picker';label.textContent=tr('Visualizza come','View as');
    const picker=document.createElement('select');picker.id='nm-view-picker';picker.setAttribute('aria-label',tr('Visualizza come','View as'));
    for(const [id,it,en]of TYPE){const opt=document.createElement('option');opt.value=id;opt.textContent=tr(it,en);picker.append(opt)}
    const split=document.createElement('button');split.id='nm-view-split';split.type='button';
    split.setAttribute('aria-label',tr('Affianca una seconda vista','Show a second view'));
    split.title=split.getAttribute('aria-label');
    split.addEventListener('click',()=>{
      // Phones keep one exclusive presentation; split would collide with dock/sheets.
      if(root.GlaukaMobile)return;
      document.querySelector('#nm-view-stage .nm-view-edit')?.blur();
      const primary=core.mode(app.state?.root?.viewMode);
      setSideMode(app,sideMode.has(app.state)?null:primary==='mindmap'?'orgchart':primary==='kanban'?'timeline':'kanban');
    });
    if(root.GlaukaMobile){split.hidden=true;split.disabled=true;}
    const focus=document.createElement('button');focus.type='button';focus.id='nm-view-focus';
    focus.setAttribute('aria-label',tr('Mostra solo il ramo selezionato nelle viste alternative',
      'Show only the selected branch in alternate views'));
    focus.addEventListener('click',()=>{
      const state=app.state;
      if(!state?.root)return;
      if(focusedIds.has(state))setFocus(app,null);
      else setFocus(app,state.selectedNodeId||state.root.id);
    });
    const workspaces=document.createElement('div');workspaces.className='nm-layout-workspace nm6-skiptranslate';
    workspaces.id='nm-workspace-controls';
    const caption=document.createElement('label');caption.id='nm-workspace-caption';caption.htmlFor='nm-workspace-layouts';
    const layouts=document.createElement('select');layouts.id='nm-workspace-layouts';
    layouts.setAttribute('aria-label',tr('Layout dello spazio di lavoro','Workspace layout'));
    layouts.addEventListener('change',()=>{
      const value=layouts.value,pref=workspacePref(app);
      if(!value||value==='current')return;
      if(value.startsWith('builtin:')){
        const selected=value.slice(8);
        const chosen={none:['mindmap',null],orgchart:['mindmap','orgchart'],
          kanban:['mindmap','kanban'],timeline:['mindmap','timeline'],
          'kanban-timeline':['kanban','timeline'],
          'network-orgchart':['concept-network','orgchart'],
          'tree-flow':['concept-tree','flowchart']};
        if(Object.prototype.hasOwnProperty.call(chosen,selected))
          workspaceView(app,chosen[selected][1],50,false,chosen[selected][0]);
      }else if(value.startsWith('user:')){
        const index=Number(value.slice(5)),item=pref.layouts[index];
        if(item)workspaceView(app,item.sideMode,item.width,item.name,item.primaryMode);
      }
    });
    const name=document.createElement('input');name.type='text';name.id='nm-workspace-layout-name';name.maxLength=50;
    name.setAttribute('aria-label',tr('Nome del layout da salvare','Name for saved layout'));
    const save=document.createElement('button');save.type='button';save.id='nm-workspace-save';
    save.addEventListener('click',()=>{if(saveWorkspaceLayout(app,name.value))name.value=''});
    const remove=document.createElement('button');remove.type='button';remove.id='nm-workspace-remove';
    remove.addEventListener('click',()=>removeWorkspaceLayout(app));
    const widthGroup=document.createElement('label');widthGroup.id='nm-workspace-width-group';
    const widthCaption=document.createElement('span');widthCaption.textContent=tr('Larghezza','Width');
    const width=document.createElement('input');width.type='range';width.id='nm-workspace-width';
    width.min='30';width.max='65';width.step='1';width.value='50';
    width.setAttribute('aria-label',tr('Larghezza pannello affiancato','Split view panel width'));
    const widthValue=document.createElement('span');widthValue.id='nm-workspace-width-value';
    width.addEventListener('input',()=>{
      const pref=workspacePref(app);pref.width=workspaceWidth(width.value);pref.activeName=null;
      app.scheduleSave?.();queue(app);
    });
    widthValue.setAttribute('role','status');
    widthGroup.append(widthCaption,width,widthValue);
    workspaces.append(caption,layouts,widthGroup,name,save,remove);
    const options=document.createElement('details');options.id='nm-project-view-options';const summary=document.createElement('summary');summary.textContent=tr('Spazio di lavoro','Workspace');summary.setAttribute('aria-label',tr('Viste affiancate e layout salvati','Split views and saved layouts'));summary.title=summary.getAttribute('aria-label');options.append(summary,workspaces);
    if(root.GlaukaMobile)options.hidden=true;
    row.append(label,picker,split,focus,options);
    const legacy=document.getElementById('nm-layout-modes');
    if(root.GlaukaMobile){
      placeMobileViewSwitch(row);
      if(!row.parentElement)parent.prepend(row);
    }else if(legacy)legacy.before(row);else parent.prepend(row);
    const overlay=document.createElement('section');overlay.id='nm-view-overlay';overlay.className='nm6-skiptranslate';overlay.hidden=true;overlay.setAttribute('aria-label',tr('Vista collegata','Linked view'));
    // Native controls keep their keyboard defaults; canvas shortcuts must not
    // interpret Tab/Enter/Space here as add-node or rename commands.
    // Key focus can remain on the main toolbar after a view switch.
    // Capture native page-zoom keys for the active linked view everywhere except editors.
    document.addEventListener('keydown',event=>{
      if(overlay.hidden||!(event.ctrlKey||event.metaKey)||event.altKey||
         !['+','=','-','_','0'].includes(event.key))return;
      const editingOrModal=event.target.closest?.('input,textarea,select,[contenteditable="true"],.nm6-shade:not(.hidden),.nm-creative-shade,#nm-decision-overlay:not(.hidden)');
      // Keep native WebView page zoom disabled without stealing Ctrl/Cmd
      // shortcuts from other tool panels or zooming the wrong canvas.
      event.preventDefault();
      if(editingOrModal||!overlay.contains(event.target))return;
      event.stopImmediatePropagation();
      const targetDual=!dualPane.hidden&&dualPane.contains(event.target);
      const scale=event.key==='0'?0:((event.key==='-'||event.key==='_')?1/1.2:1.2);
      if(targetDual){
        const cam=getCamera(app,sideMode.get(app.state),true);
        zoomDual(app,scale===0?1/cam.zoom:scale);
      }else zoomView(app,scale===0?1:activeCamera(app).zoom*scale);
    },true);
    overlay.addEventListener('keydown',event=>{
      // Ctrl/Cmd zoom is owned by the scoped document capture handler above.
      // A second bubble handler would double-zoom (or hijack modal shortcuts).
      if(!event.ctrlKey&&!event.metaKey&&!event.altKey)event.stopPropagation();
      if(event.key==='Escape'&&!event.defaultPrevented&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey){event.preventDefault();if(look.open){look.open=false;return}if(exportMenu.open){exportMenu.open=false;return}if(options.open){options.open=false;return}if(closeNodeMenu())return;if(linking.has(app.state)){linking.delete(app.state);queue(app)}else if(flowPreview.has(app.state)){flowPreview.delete(app.state);queue(app)}else if(sideMode.has(app.state)){setSideMode(app,null)}else setMode(app,'mindmap')}
    });
    const contextMenu=document.createElement('div');contextMenu.id='nm-view-context';contextMenu.hidden=true;
    contextMenu.setAttribute('role','menu');
    contextMenu.setAttribute('aria-label',tr('Azioni sul nodo','Node actions'));
    overlay.append(contextMenu);
    document.addEventListener('pointerdown',event=>{
      if(!contextMenu.hidden&&!contextMenu.contains(event.target))closeNodeMenu(false);
    },true);
    const header=document.createElement('div');header.className='nm-view-header';
    const title=document.createElement('strong');title.id='nm-view-heading';
    const viewPicker=document.createElement('select');viewPicker.id='nm-view-overlay-picker';viewPicker.setAttribute('aria-label',tr('Cambia vista','Change view'));
    viewPicker.style.cssText='padding:7px;border-radius:9px;max-width:180px';
    for(const [id,it,en]of TYPE){const option=document.createElement('option');option.value=id;option.textContent=tr(it,en);viewPicker.append(option)}
    viewPicker.addEventListener('change',()=>{
      const selected=core.mode(viewPicker.value);
      const primary=core.mode(app.state?.root?.viewMode);
      const secondary=sideMode.get(app.state);
      if(primary==='mindmap'&&secondary){
        // Mind map + linked view: the overlay is the secondary canvas.
        document.querySelector('#nm-view-stage .nm-view-edit')?.blur();
        if(setSideMode(app,selected)===false)queue(app);
      }else if(secondary){
        // Two alternate views: the overlay is the PRIMARY canvas. Changing
        // its picker must not silently change the second view instead.
        if(selected===primary){queue(app);return}
        if(setMode(app,selected)===false){queue(app);return}
        // The same mode cannot occupy both panes; otherwise preserve the
        // previous secondary view and its separate camera/layout settings.
        if(selected!==secondary&&setSideMode(app,secondary)===false)queue(app);
      }else if(setMode(app,selected)===false)queue(app);
    });
    const hint=document.createElement('span');hint.className='nm-view-hint';
    // A purely local, non-destructive search: matching cards remain in place
    // and non-matching cards are dimmed, not deleted from the diagram.
    const orgSearch=document.createElement('input');
    orgSearch.id='nm-orgchart-search';orgSearch.type='search';orgSearch.hidden=true;
    orgSearch.maxLength=100;
    orgSearch.placeholder=tr('Cerca nell’organigramma…','Search org chart…');
    orgSearch.setAttribute('aria-label',tr('Cerca nodi nell’organigramma',
      'Search organization chart nodes'));
    orgSearch.addEventListener('input',()=>{
      for(const id of ['nm-view-stage','nm-dual-stage'])
        applyOrgSearch(document.getElementById(id),orgSearch.value);
    });
    const actionStatus=document.createElement('span');actionStatus.id='nm-view-action-status';
    actionStatus.setAttribute('role','status');actionStatus.setAttribute('aria-live','polite');
    const look=document.createElement('details');look.id='nm-view-appearance';
    const lookTitle=document.createElement('summary');lookTitle.textContent=tr('Aspetto','Appearance');lookTitle.setAttribute('aria-label',tr('Aspetto della vista','View appearance'));lookTitle.title=lookTitle.getAttribute('aria-label');
    const fields=document.createElement('div');fields.className='nm-appearance-fields';
    const scopeHelpNote=document.createElement('p');scopeHelpNote.id='nm-view-appearance-help';
    scopeHelpNote.className='nm-appearance-help';scopeHelpNote.setAttribute('aria-live','polite');
    fields.append(scopeHelpNote);
    const setting=(id,it,en,type,options=null)=>{
      const label=document.createElement('label');label.textContent=tr(it,en);
      const input=document.createElement(type==='select'?'select':'input');
      input.id='nm-view-appearance-'+id;
      if(type!=='select')input.type=type;
      if(options)for(const [value,itLabel,enLabel]of options){
        const option=document.createElement('option');option.value=String(value);option.textContent=tr(itLabel,enLabel);input.append(option);
      }
      label.append(input);fields.append(label);return input;
    };
    const theme=setting('theme','Tema','Theme','select',[
      ['studio','Studio','Studio'],['aurora','Aurora','Aurora'],['paper','Carta','Paper'],['graphite','Grafite','Graphite']]);
    const previews=document.createElement('div');previews.id='nm-view-appearance-presets';
    previews.className='nm-appearance-presets';previews.setAttribute('role','group');
    previews.setAttribute('aria-label',tr('Anteprime dei temi','Theme previews'));fields.append(previews);
    const accent=setting('accent','Accento','Accent','color');
    const surface=setting('surface','Schede','Cards','color');
    const textColor=setting('text','Testo','Text','color');
    const edgeColor=setting('edge','Collegamenti','Connections','color');
    const radius=setting('radius','Angoli','Corners','select',[
      [4,'4 px','4 px'],[8,'8 px','8 px'],[12,'12 px','12 px'],
      [18,'18 px','18 px'],[24,'24 px','24 px']]);
    const fontSize=setting('fontSize','Dimensione testo','Text size','select',[
      [10,'10 px','10 px'],[12,'12 px','12 px'],[13,'13 px','13 px'],
      [14,'14 px','14 px'],[16,'16 px','16 px'],[18,'18 px','18 px']]);
    const background=setting('background','Sfondo','Background','color');
    const density=setting('density','Spaziatura','Spacing','select',[
      [.85,'Compatta','Compact'],[1,'Normale','Normal'],[1.08,'Ampia','Comfortable'],[1.4,'Molto ampia','Wide']]);
    const orientation=setting('orientation','Direzione','Direction','select',[
      ['vertical','Verticale','Vertical'],['horizontal','Orizzontale','Horizontal']]);
    const nodeLabel=document.createElement('label');nodeLabel.className='nm-appearance-scope';
    const nodeOnly=document.createElement('input');nodeOnly.id='nm-view-appearance-node';nodeOnly.type='checkbox';
    nodeOnly.setAttribute('aria-describedby','nm-view-appearance-help');
    const nodeText=document.createElement('span');nodeText.textContent=tr('Solo nodo selezionato','Selected node only');
    nodeLabel.append(nodeOnly,nodeText);
    fields.append(nodeLabel);
    const resetProp=setting('reset-property','Proprietà modificata','Modified property','select');
    const resetSingle=document.createElement('button');
    resetSingle.id='nm-view-appearance-reset-single';resetSingle.type='button';
    resetSingle.className='nm-appearance-reset nm-appearance-property-reset';
    resetSingle.textContent=tr('Ripristina proprietà','Reset property');
    fields.append(resetSingle);
    const reset=document.createElement('button');
    reset.id='nm-view-appearance-reset';reset.type='button';reset.className='nm-appearance-reset';
    reset.textContent=tr('Ripristina vista','Reset view style');fields.append(reset);
    const currentMode=()=>displayMode(app.state);
    const scopeId=()=>nodeOnly.checked?app.state?.selectedNodeId:null;
    const scopeIsValid=()=>!nodeOnly.checked||
      !!(app.state?.selectedNodeId&&app.state?.findNode?.(app.state.selectedNodeId));
    theme.addEventListener('change',()=>changeAppearance(app,currentMode(),{preset:theme.value}));
    accent.addEventListener('change',()=>{
      if(scopeIsValid())changeAppearance(app,currentMode(),{accent:accent.value},scopeId());
    });
    surface.addEventListener('change',()=>{
      if(scopeIsValid())changeAppearance(app,currentMode(),{surface:surface.value},scopeId());
    });
    textColor.addEventListener('change',()=>{
      if(scopeIsValid())changeAppearance(app,currentMode(),{text:textColor.value},scopeId());
    });
    edgeColor.addEventListener('change',()=>changeAppearance(app,currentMode(),{edge:edgeColor.value}));
    radius.addEventListener('change',()=>changeAppearance(app,currentMode(),{radius:Number(radius.value)}));
    fontSize.addEventListener('change',()=>changeAppearance(app,currentMode(),{fontSize:Number(fontSize.value)}));
    background.addEventListener('change',()=>changeAppearance(app,currentMode(),{background:background.value}));
    density.addEventListener('change',()=>changeAppearance(app,currentMode(),{density:Number(density.value)}));
    orientation.addEventListener('change',()=>changeAppearance(app,currentMode(),{orientation:orientation.value}));
    nodeOnly.addEventListener('change',()=>syncAppearancePanel(app,currentMode()));
    resetSingle.addEventListener('click',()=>{
      if(scopeIsValid()&&resetProp.value)resetAppearanceProperty(app,currentMode(),resetProp.value,scopeId());
    });
    reset.addEventListener('click',()=>{
      if(scopeIsValid())resetAppearance(app,currentMode(),scopeId());
    });
    // Native disclosure sections keep the extensive controls manageable.
    // Moving existing labels preserves IDs, event handlers and Undo semantics.
    const section=(key,controls,open=false)=>{
      const group=document.createElement('details');group.className='nm-appearance-group';
      group.dataset.group=key;group.open=open;
      const heading=document.createElement('summary');
      heading.textContent=tr(...appearanceGroupLabels[key]);
      const content=document.createElement('div');content.className='nm-appearance-group-content';
      for(const control of controls)content.append(control);
      group.append(heading,content);fields.append(group);
      return group;
    };
    section('theme',[theme.parentElement,previews],true);
    section('colors',[accent.parentElement,surface.parentElement,textColor.parentElement,background.parentElement]);
    section('nodes',[radius.parentElement,fontSize.parentElement]);
    section('links',[edgeColor.parentElement]);
    section('spacing',[density.parentElement,orientation.parentElement]);
    section('selected',[nodeLabel,resetProp.parentElement,resetSingle,reset]);
    look.append(lookTitle,fields);
    const exportSvg=document.createElement('button');exportSvg.type='button';exportSvg.id='nm-view-export-svg';
    exportSvg.addEventListener('click',()=>exportView(app));
    const exportPng1=document.createElement('button');exportPng1.type='button';exportPng1.id='nm-view-export-png1';
    exportPng1.textContent='PNG 1×';
    exportPng1.setAttribute('aria-label',tr('Esporta vista PNG a scala 1×','Export view PNG at 1× scale'));
    exportPng1.title=exportPng1.getAttribute('aria-label');
    exportPng1.addEventListener('click',()=>exportView(app,'png',1));
    const exportPng2=document.createElement('button');exportPng2.type='button';exportPng2.id='nm-view-export-png2';
    exportPng2.textContent='PNG 2×';
    exportPng2.setAttribute('aria-label',tr('Esporta vista PNG a scala 2×','Export view PNG at 2× scale'));
    exportPng2.title=exportPng2.getAttribute('aria-label');
    exportPng2.addEventListener('click',()=>exportView(app,'png',2));
    const exportPdf=document.createElement('button');exportPdf.type='button';exportPdf.id='nm-view-export-pdf';
    exportPdf.textContent='PDF';
    exportPdf.setAttribute('aria-label',tr('Esporta vista PDF','Export view PDF'));
    exportPdf.title=exportPdf.getAttribute('aria-label');
    exportPdf.addEventListener('click',()=>exportView(app,'pdf',2));
    const back=document.createElement('button');back.type='button';back.id='nm-view-back';
    back.addEventListener('click',()=>{
      if(sideMode.has(app.state))setSideMode(app,null)
      else setMode(app,'mindmap');
    });
    const headerFocus=document.createElement('button');headerFocus.id='nm-view-overlay-focus';
    headerFocus.type='button';
    headerFocus.addEventListener('click',()=>{
      const state=app.state;
      if(!state?.root)return;
      if(focusedIds.has(state))setFocus(app,null);
      else setFocus(app,state.selectedNodeId||state.root.id);
    });
