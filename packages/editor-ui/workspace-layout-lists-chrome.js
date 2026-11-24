  function mountTextConnection(app) {
    const modal = document.getElementById("ai-settings-modal"),
      fields = modal?.querySelector(".v4-fields");
    if (!fields) return;
    const preset = document.getElementById("ai-preset"),
      apply = document.getElementById("ai-preset-apply");
    const advanced = document.createElement("details");
    advanced.id = "nm-ai-text-advanced";
    advanced.className = "nm6-skiptranslate";
    const summary = document.createElement("summary"),
      body = document.createElement("div");
    body.className = "v4-fields";
    advanced.append(summary, body);
    for (const id of ["ai-url", "ai-protocol", "ai-system"]) {
      const row = document.getElementById(id)?.closest("label");
      if (row) body.append(row);
    }
    if (apply) {
      apply.parentElement.removeChild(apply);
      body.append(apply);
    }
    fields.after(advanced);
    preset?.closest("label")?.classList.add("v4-span-2");
    const keyRow = document.getElementById("ai-key")?.closest("label"),
      modelRow = document.getElementById("ai-model")?.closest("label");
    if (keyRow && modelRow) modelRow.before(keyRow);
    const helper = modal.querySelector(".v4-modal-head small"),
      caption = modal.querySelector(".v4-caption");
    const rows = [
      ["ai-preset", "Servizio AI", "AI service"],
      ["ai-model", "Modello", "Model"],
      ["ai-key", "Chiave API del servizio", "Service API key"],
      ["ai-url", "Indirizzo del servizio", "Service address"],
      ["ai-protocol", "Protocollo di connessione", "Connection protocol"],
      ["ai-system", "Istruzioni per l’AI", "AI instructions"],
    ];
    const translate = () => {
      summary.textContent = tr("Opzioni avanzate", "Advanced options");
      if (helper)
        helper.textContent = tr(
          "Scegli il servizio, inserisci la chiave e seleziona un modello. Poi verifica la connessione.",
          "Choose your service, enter its key and select a model. Then test the connection.",
        );
      if (caption)
        caption.textContent = tr(
          "Le richieste inviano i contenuti al servizio scelto. Le chiavi non sono incluse nei file delle mappe.",
          "Requests send content to the chosen service. Keys are not included in map files.",
        );
      const heading = modal.querySelector(".v4-modal-head strong");
      if (heading) {
        heading.classList.add("nm6-skiptranslate");
        heading.textContent = tr("Testi e mappe", "Text and maps");
      }
      const names = {
        custom: ["Altro servizio", "Other service"],
        ollama: ["Ollama locale", "Local Ollama"],
        lmstudio: ["LM Studio locale", "Local LM Studio"],
      };
      for (const option of preset?.options || []) {
        const pair = names[option.value];
        if (pair) option.textContent = tr(...pair);
      }
      const protocolNames = {
        auto: ["Rilevamento automatico", "Automatic detection"],
        gemini: ["Gemini nativo", "Native Gemini"],
        anthropic: ["Anthropic nativo", "Native Anthropic"],
        ollama: ["Ollama nativo", "Native Ollama"],
      };
      for (const option of document.getElementById("ai-protocol")?.options ||
        []) {
        const pair = protocolNames[option.value];
        if (pair) option.textContent = tr(...pair);
      }
      if (apply)
        apply.textContent = tr(
          "Ripristina indirizzo del servizio",
          "Reset service address",
        );
      for (const [id, it, en] of rows) {
        const label = document.getElementById(id)?.closest("label"),
          text = [...(label?.childNodes || [])].find(
            (n) => n.nodeType === 3 && n.textContent.trim(),
          );
        if (text) text.textContent = tr(it, en);
        label?.classList.add("nm6-skiptranslate");
      }
    };
    helper?.classList.add("nm6-skiptranslate");
    caption?.classList.add("nm6-skiptranslate");
    apply?.classList.add("nm6-skiptranslate");
    translate();
    root.NeuroMapWorkspaceLocale?.watch(translate);
    preset?.addEventListener("change", () => {
      if (preset.value === "custom") {
        advanced.open = true;
        document.getElementById("ai-url").focus();
      } else {
        advanced.open = false;
        apply?.click();
      }
    });
    const open = app.openAISettings;
    app.openAISettings = function (...args) {
      const result = open.apply(this, args);
      advanced.open = preset.value === "custom";
      return result;
    };
  }
  // Shared workspace sizing: one carefully bounded preference, never applied
  // to the canvas or persisted inside any map/document.
  // Reuse one resize implementation, not one width preference. The left
  // Disposizione panel owns its width; Aspetto and other right tools keep theirs.
  // Both preferences are UI-only and never touch the map/document.
  function mountPanelResizeHandles(panels) {
    const min=340,max=560;
    const clamp=value=>Math.max(min,Math.min(max,Number(value)||400));
    const allowed=()=>Math.max(min,Math.min(max,(root.innerWidth||1200)-180));
    const legacy="nm.workspace.rightPanelWidth.v1";
    const catalog=[
      {id:"inspector-sidebar",key:"nm.workspace.inspectorWidth.v1",css:"--nm-inspector-panel-width",scope:"inspector",side:"right",fallback:360},
      {id:"nm-insert-panel",key:"nm.workspace.insertWidth.v1",css:"--nm-insert-panel-width",scope:"insert",side:"right"},
      {id:"nm614-navigation-flyout",key:"nm.workspace.navWidth.v1",css:"--nm-nav-panel-width",scope:"nav",side:"right"},
      {id:"nm-learn-panel",key:"nm.workspace.learnWidth.v1",css:"--nm-learn-panel-width",scope:"learn",side:"right"},
      {id:"nm-ai-studio",key:"nm.workspace.aiWidth.v1",css:"--nm-ai-panel-width",scope:"ai",side:"right"},
      {id:"nm-knowledge-panel",key:"nm.workspace.knowledgeWidth.v1",css:"--nm-knowledge-panel-width",scope:"knowledge",side:"right"},
      {id:"image-controls",key:"nm.workspace.imageWidth.v1",css:"--nm-image-panel-width",scope:"image",side:"right"},
      {id:"hud-bottom-left",key:"nm.workspace.layoutPanelWidth.v1",css:"--nm-layout-panel-width",scope:"layout",side:"left"}
    ];
    const groups=new Map();
    const readStored=(key,fallback=400)=>{
      try{
        const own=Number(localStorage.getItem(key));
        if(Number.isFinite(own)&&own>=min&&own<=max)return own;
        // First launch after the shared right-width split keeps the user's
        // previous Aspetto size as the starting point for each right tool.
        if(key!==legacy&&key!=="nm.workspace.layoutPanelWidth.v1"){
          const shared=Number(localStorage.getItem(legacy));
          if(Number.isFinite(shared)&&shared>=min&&shared<=max)return shared;
        }
      }catch(_){/* Private windows may disable storage. */}
      return fallback;
    };
    const ensure=spec=>{
      let group=groups.get(spec.key);
      if(!group){group={...spec,width:readStored(spec.key,spec.fallback)};groups.set(spec.key,group);}
      return group;
    };
    const groupFor=panel=>{
      const named=catalog.find(spec=>spec.id===(panel.id||"")||panel.classList?.contains?.(spec.id));
      return ensure(named||{id:"right",key:legacy,css:"--nm-right-panel-width",scope:"right",side:"right"});
    };
    const update=(group,value,viewportOnly=false)=>{
      // Separate the user's preferred desktop width from the current viewport
      // clamp. A temporary small window must not permanently shrink a panel
      // (or silently rewrite that panel's preference on the next resize).
      if(!viewportOnly)group.width=clamp(value);
      const displayedWidth=Math.min(allowed(),group.width);
      document.body.style.setProperty(group.css,displayedWidth+"px");
      for(const handle of document.querySelectorAll(".nm-panel-resize-handle")){
        if(handle.getAttribute?.("data-nm-size-scope")!==group.scope)continue;
        handle.setAttribute("aria-valuenow",String(displayedWidth));
        handle.setAttribute("aria-valuetext",displayedWidth+" px");
      }
    };
    const persist=group=>{try{localStorage.setItem(group.key,String(group.width))}catch(_){}};
    for(const spec of catalog)update(ensure(spec),readStored(spec.key,spec.fallback));
    const attachSide=panel=>{
      if(!panel||panel.querySelector(".nm-panel-resize-handle"))return;
      const group=groupFor(panel);
      const isLeftPanel=group.side==="left";
      if(panel._nmLayoutGrip)return;
      const scope=group.scope;
      // The grip is an accessible button; capture-phase map navigation ignores it.
      const grip=document.createElement("button");
      grip.type="button";
      grip.className="nm-panel-resize-handle nm6-skiptranslate";
      grip.setAttribute("role","separator");
      grip.setAttribute("tabindex","0");
      grip.setAttribute("aria-orientation","vertical");
      grip.setAttribute("aria-valuemin",String(min));
      grip.setAttribute("aria-valuemax",String(max));
      grip.setAttribute("aria-valuenow",String(group.width));
      grip.setAttribute("aria-valuetext",group.width+" px");
      grip.setAttribute("data-nm-size-scope",scope);
      grip.setAttribute("data-nm-grip-side",isLeftPanel?"right":"left");
      const labelGrip=()=>{
        grip.setAttribute("aria-label",tr("Ridimensiona pannello laterale","Resize side panel"));
        grip.title=root.GlaukaMobile?tr("Ridimensiona pannello laterale","Resize side panel"):tr("Trascina o usa le frecce sinistra/destra","Drag or use the left/right arrow keys");
      };
      labelGrip();root.NeuroMapWorkspaceLocale?.watch(labelGrip);
      let drag=null;
      grip.addEventListener("pointerdown",event=>{
        if(event.button!==0||(root.innerWidth||0)<850)return;
        event.preventDefault();event.stopPropagation();
        drag={id:event.pointerId,x:event.clientX,width:group.width};
        grip.setPointerCapture?.(event.pointerId);
      });
      grip.addEventListener("pointermove",event=>{
        if(!drag||drag.id!==event.pointerId)return;
        const delta=isLeftPanel?event.clientX-drag.x:drag.x-event.clientX;
        update(group,drag.width+delta);
      });
      const finish=event=>{
        if(!drag||drag.id!==event.pointerId)return;
        if(event.type==="pointercancel")update(group,drag.width);
        else persist(group);
        drag=null;
        if(grip.hasPointerCapture?.(event.pointerId))
          grip.releasePointerCapture(event.pointerId);
      };
      grip.addEventListener("pointerup",finish);
      grip.addEventListener("pointercancel",finish);
      grip.addEventListener("lostpointercapture",()=>{if(drag){drag=null;persist(group)}});
      grip.addEventListener("keydown",event=>{
        let next=group.width;
        const growKey=isLeftPanel?"ArrowRight":"ArrowLeft";
        const shrinkKey=isLeftPanel?"ArrowLeft":"ArrowRight";
        if(event.key===growKey)next+=20;
        else if(event.key===shrinkKey)next-=20;
        else if(event.key==="Home")next=min;
        else if(event.key==="End")next=allowed();
        else if(event.key==="Escape"){
          if(drag){update(group,drag.width);drag=null;}
          grip.blur();
          return;
        }
        else return;
        event.preventDefault();event.stopPropagation();
        update(group,next);persist(group);
      });
      // The layout grip uses the panel's measured box, but it must not stay
      // inside the panel: a filter on that panel would turn the measured
      // screen position into an offset and drop the grip below the card.
      if(isLeftPanel){
        panel._nmLayoutGrip=grip;
        const host=document.body;
        if(host&&typeof host.append==="function")host.append(grip);
        else panel.prepend(grip);
        pinLayoutGrip(panel,grip);
      }else panel.prepend(grip);
    };
    function pinLayoutGrip(panel,grip){
      const place=()=>{
        if(typeof panel.getBoundingClientRect!=="function")return;
        const box=panel.getBoundingClientRect();
        const gone=box.width<2||box.height<2||panel.hidden||panel.classList?.contains("hidden")||panel.classList?.contains("collapsed")||panel.classList?.contains("nm-panel-compact")||panel.classList?.contains("nm-panel-minimized");
        grip.style.setProperty("display",gone?"none":"block","important");
        if(gone)return;
        const line=2;
        grip.style.setProperty("position","fixed","important");
        grip.style.setProperty("z-index","40","important");
        grip.style.setProperty("top",box.top+"px","important");
        grip.style.setProperty("height",box.height+"px","important");
        grip.style.setProperty("bottom","auto","important");
        grip.style.setProperty("left",(box.right-line)+"px","important");
        grip.style.setProperty("right","auto","important");
        grip.style.setProperty("width",line+"px","important");
        grip.style.setProperty("min-width","0","important");
        grip.style.setProperty("max-width",line+"px","important");
        grip.style.setProperty("margin","0","important");
        grip.style.setProperty("padding","0","important");
        grip.style.setProperty("border","0","important");
        grip.style.setProperty("transform","none","important");
        grip.style.setProperty("box-sizing","border-box","important");
      };
      grip._nmPlaceLayoutGrip=place;
      place();
      if(typeof ResizeObserver==="function")new ResizeObserver(place).observe(panel);
      if(typeof MutationObserver==="function")new MutationObserver(place).observe(panel,{attributes:true,attributeFilter:["class","hidden","style"]});
      panel.addEventListener?.("scroll",place,{passive:true});
      root.addEventListener?.("resize",place);
      root.addEventListener?.("scroll",place,{passive:true,capture:true});
    }
    for(const panel of panels)attachSide(panel);
    mountExtraPanelControls(attachSide,panels);
    for(const group of groups.values())update(group,group.width);
    root.addEventListener("resize",()=>{
      for(const group of groups.values())update(group,group.width,true);
      for(const handle of document.querySelectorAll(".nm-panel-resize-handle")){handle._nmRefreshSize?.();handle._nmPlaceLayoutGrip?.();}
    });
  }
  // Dialogs retain their own opening size. Each side tool stores its own
  // width. Only UI CSS variables are changed by resizing.
  function mountExtraPanelControls(attachSide,staticPanels) {
    if(typeof MutationObserver!=='function')return;
    const sides='#inspector-sidebar,#nm-knowledge-panel,#nm-ai-studio,#nm-learn-panel,.hud-bottom-left,#image-controls,#nm-insert-panel,#nm614-navigation-flyout,.nm-side-panel';
    const dialogs='.nm-creative-dialog';
    const excluded=panel=>panel.matches('#find-panel,#nm-orbit-find,#nm-task-tools,#nm-view-overlay,[role="search"]');
    function collapse(panel){
      if(panel.matches(dialogs)||panel.querySelector('#nm-ai-minimize'))return;
      // Native phone sheets already have their own single close control.
      if(root.GlaukaMobile&&root.innerWidth<850)return;
      const header=panel.querySelector(':scope>header,.inspector-header,.nm-kn-header,.image-controls-header,.nm-view-header,.nm614-fly-title')||panel.querySelector('.hud-title')?.parentElement;
      if(!header)return;
      if(panel.getAttribute('data-nm-side-collapsible')!=='true')panel.setAttribute('data-nm-side-collapsible','true');
      if(!header.classList.contains('nm-side-panel-heading'))header.classList.add('nm-side-panel-heading');
      for(let ancestor=header.parentElement;ancestor&&ancestor!==panel;ancestor=ancestor.parentElement)if(!ancestor.classList.contains('nm-panel-heading-path'))ancestor.classList.add('nm-panel-heading-path');
      root.NeuroMapCreativeModules?.ui.makeCollapsible(panel,panel,header);
    }
    function dialogGrip(panel){
      if(panel.querySelector(':scope>.nm-panel-resize-handle'))return;
      panel.classList.add('nm-panel-sizeable-dialog');
      const grip=document.createElement('button');grip.type='button';grip.className='nm-panel-resize-handle nm6-skiptranslate';
      grip.setAttribute('role','separator');grip.setAttribute('aria-orientation','vertical');grip.setAttribute('data-nm-size-scope','dialog');
      grip.setAttribute('data-glauka-ui-pair','');grip.dataset.itLabel='Ridimensiona pannello laterale';grip.dataset.enLabel='Resize side panel';
      grip.setAttribute('aria-label',tr(grip.dataset.itLabel,grip.dataset.enLabel));
      grip.title=root.GlaukaMobile?tr(grip.dataset.itLabel,grip.dataset.enLabel):tr('Trascina o usa le frecce sinistra/destra','Drag or use the left/right arrow keys');
      const docked=()=>panel.parentElement?.matches('.nm-creative-sidecar:not(.nm-creative-expanded)');
      const target=()=>docked()?panel.parentElement:panel;
      const maximum=()=>Math.max(240,Math.min(1200,root.innerWidth-(docked()?92:32)));
      const minimum=()=>Math.min(340,maximum());
      const current=()=>target().getBoundingClientRect().width||minimum();
      const refresh=()=>{grip.setAttribute('aria-valuemin',String(minimum()));grip.setAttribute('aria-valuemax',String(maximum()));grip.setAttribute('aria-valuenow',String(Math.round(current())));grip.setAttribute('aria-valuetext',Math.round(current())+' px');};
      const resize=value=>{const size=Math.max(minimum(),Math.min(maximum(),value));
        if(docked())panel.parentElement.style.setProperty('--nm-dialog-panel-width',size+'px');
        else{panel.style.setProperty('--nm-dialog-user-width',size+'px');panel.setAttribute('data-nm-user-sized','true');}
        refresh();
      };
      let drag;
      grip.addEventListener('pointerdown',event=>{if(event.button!==0||root.innerWidth<850)return;event.preventDefault();event.stopPropagation();drag={id:event.pointerId,x:event.clientX,width:current(),factor:docked()?1:2};grip.setPointerCapture?.(event.pointerId);});
      grip.addEventListener('pointermove',event=>{if(drag?.id===event.pointerId)resize(drag.width+(drag.x-event.clientX)*drag.factor);});
      const finish=event=>{if(drag?.id!==event.pointerId)return;if(event.type==='pointercancel')resize(drag.width);drag=null;if(grip.hasPointerCapture?.(event.pointerId))grip.releasePointerCapture(event.pointerId);};
      grip.addEventListener('pointerup',finish);grip.addEventListener('pointercancel',finish);grip.addEventListener('lostpointercapture',()=>{drag=null;});
      grip.addEventListener('focus',refresh);
      grip.addEventListener('keydown',event=>{let next=current();if(event.key==='ArrowLeft')next+=20;else if(event.key==='ArrowRight')next-=20;else if(event.key==='Home')next=minimum();else if(event.key==='End')next=maximum();else return;event.preventDefault();event.stopPropagation();resize(next);});
      grip._nmRefreshSize=refresh;panel.prepend(grip);refresh();
    }
    function attach(panel){
      if(excluded(panel))return;
      if(panel.matches(dialogs))dialogGrip(panel);
      else{if(!panel.classList.contains('nm-panel-sizeable'))panel.classList.add('nm-panel-sizeable');attachSide(panel);collapse(panel);}
    }
    function scan(node){
      if(node.nodeType!==1)return;
      // Settings can move an existing header into a sticky wrapper after mount.
      // Keep that ancestor path visible when its tool window is minimized.
      const owner=node.closest(sides);
      if(owner&&!excluded(owner))collapse(owner);
      if(node.matches(sides+','+dialogs))attach(node);
      for(const panel of node.querySelectorAll(sides+','+dialogs))attach(panel);
    }
    for(const panel of document.querySelectorAll(sides+','+dialogs))attach(panel);
    // Child additions only: handle insertion is idempotent and never writes
    // map state or watches the attributes updated by the sizing controls.
    const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)scan(node);});
    observer.observe(document.body,{childList:true});
    // Only permanent tool containers need nested-header monitoring. Tabs,
    // document views and transient dialog contents stay outside this observer.
    for(const panel of staticPanels.filter(Boolean))observer.observe(panel,{childList:true,subtree:true});
  }
