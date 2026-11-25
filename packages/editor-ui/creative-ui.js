/* Shared creative controls and document operations. */
(function (root) {
  "use strict";
  const core = root.NeuroMapCreativeCore,
    tr = (it, en) => (globalThis.GlaukaI18n?.pair(it,en) ?? ((document.documentElement.lang === "en" ? en : it)));
  const data = (svg) =>
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const BUTTONS = [
    ["clockwise", "⟳", "In senso orario", "Clockwise"],
    ["balanced", "◀ ● ▶", "Bilanciata", "Balanced"],
    ["fluid", "↝", "Fluida", "Fluid"],
    ["columns", "☷ ● ☷", "A colonne", "Columns"],
    ["right", "● →", "Verso destra", "To the right"],
    ["left", "← ●", "Verso sinistra", "To the left"],
  ];
  function button(id, it, en, fn) {
    const b = document.createElement("button");
    b.type = "button";
    b.id = id;
    b.dataset.it = it;
    b.dataset.en = en;
    b.textContent = tr(it, en);
    b.onclick = fn;
    return b;
  }
  function field(id, it, en, type = "text") {
    const label = document.createElement("label");
    const span = document.createElement("span");
    span.dataset.it = it;
    span.dataset.en = en;
    span.textContent = tr(it, en);
    const input = document.createElement(
      type === "textarea" ? "textarea" : "input",
    );
    if (type !== "textarea") input.type = type;
    input.id = id;
    input.setAttribute("aria-label", tr(it, en));
    label.append(span, input);
    return { label, input };
  }
  function locale(container) {
    for (const el of container.querySelectorAll("[data-it]")) {
      el.textContent = tr(el.dataset.it, el.dataset.en);
      if (el.hasAttribute("data-tool-label"))
        el.setAttribute("aria-label", el.textContent);
    }
    for (const label of container.querySelectorAll("label")) {
      const el = label.querySelector("input,textarea,select"),
        span = label.querySelector("[data-it]");
      if (el && span) el.setAttribute("aria-label", span.textContent);
    }
  }
  function openURL(raw) {
    const url = core.url(raw);
    if (!url) return;
    if (root.NMAndroid?.openExternalURL) {
      root.NMAndroid.openExternalURL(url);
      return;
    }
    if (root.webkit?.messageHandlers?.neuromapOpenURL) {
      root.webkit.messageHandlers.neuromapOpenURL.postMessage(url);
      return;
    }
    root.open(url, "_blank", "noopener,noreferrer");
  }
  const linkCache = new WeakMap();
  function nodeURL(node) {
    if (!node || typeof node !== "object") return "";
    const cached = linkCache.get(node);
    if (cached && cached.text === node.text && cached.link === node.linkUrl)
      return cached.url;
    const url = core.url(node.text) || core.url(node.linkUrl);
    linkCache.set(node, { text: node.text, link: node.linkUrl, url });
    return url;
  }
  function appliedBadge(host,active){
    let badge=host.querySelector(':scope > .nm-library-applied');
    if(!badge){
      badge=document.createElement('span');badge.className='nm-library-applied';
      badge.setAttribute('aria-hidden','true');badge.textContent='✓';host.append(badge);
    }
    badge.hidden=!active;
  }
  // Shared heading structure: every panel keeps its original controls/handlers.
  const HEADER_ICONS={
   'hud-header':['M4 12h4','M16 7h4','M16 17h4','M8 12l4-5h4','M8 12l4 5h4','M2 10h2v4H2z'],
   'nm-ai-studio':['m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z'],
   'nm-draw-header':['m4 20 4-1 11-11a2 2 0 0 0-3-3L5 16l-1 4Z','m13.5 6.5 3 3']
  };
  function ensureHeadingIcon(header){
   const title=header.querySelector(':scope>strong,:scope>h2,:scope>.hud-title,:scope>.inspector-title,:scope>span:first-child');
   if(!title||header.querySelector(':scope>svg,:scope>.hud-title>svg,:scope>.inspector-title>svg'))return;
   const key=header.classList.contains('hud-header')?'hud-header':header.parentElement?.id==='nm-ai-studio'?'nm-ai-studio':header.classList.contains('nm-draw-header')?'nm-draw-header':null;
   if(!key)return;
   const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
   svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','18');svg.setAttribute('height','18');
   svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.85');
   svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');
   svg.classList.add('nm-workspace-icon');
   for(const d of HEADER_ICONS[key]){const p=document.createElementNS(ns,'path');p.setAttribute('d',d);svg.append(p);}
   header.prepend(svg);
  }
  function panelHeader(header,close,toggle) {
    header.classList.add('nm-side-panel-heading');
    ensureHeadingIcon(header);
    let actions=header.querySelector(':scope > .nm-panel-header-actions');
    if(!actions){actions=document.createElement('div');actions.className='nm-panel-header-actions';header.append(actions);}
    const helpBtn=header.querySelector(':scope > .nm-kn-help-toggle');
    if(helpBtn){helpBtn.classList.add('nm-panel-header-button');actions.before(helpBtn);}
    if(toggle){toggle.classList.add('nm-panel-header-button');actions.append(toggle);}
    if(close){
      if(!close.classList.contains('nm-panel-header-button')){
        delete close.dataset.it;delete close.dataset.en;
        close.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
        close.setAttribute('data-glauka-ui-pair','');
        close.dataset.itLabel='Chiudi';close.dataset.enLabel='Close';
        close.setAttribute('aria-label',tr('Chiudi','Close'));
        close.title=tr('Chiudi','Close');
      }
      close.classList.add('nm-panel-header-button');actions.append(close);
    }
    return actions;
  }
  const FRAMED_SIDE_PANELS=new Set(['nm-insert-panel','nm-learn-panel','nm614-navigation-flyout','inspector-sidebar','nm-knowledge-panel','image-controls','nm-drawing-toolbar']);
  function framePanel(panel,header){
    // Desktop tool windows and framed sub-dialogs keep their heading strictly outside the scroll body.
    // Native mobile sheets already provide that frame themselves.
    if(root.GlaukaMobile||!panel||panel.classList.contains('nm-panel-frame'))return;
    const isSidePanel=FRAMED_SIDE_PANELS.has(panel.id)||panel.classList.contains('hud-bottom-left');
    const isSubDialog=panel.classList.contains('nm-creative-dialog')&&!panel.querySelector(':scope>.nm-chart-studio,:scope>.nm-formula-studio,:scope>.nm-wordart-studio');
    if(!isSidePanel&&!isSubDialog)return;
    const body=document.createElement('div');body.className='nm-panel-body';
    const isChrome=el=>el===header||el===body||el.classList?.contains('nm-panel-resize-handle')||el.classList?.contains('nm-panel-fixed')||el.classList?.contains('nm-settings-toolbar')||el.classList?.contains('nm-ai-transport')||el.classList?.contains('nm-ai-body');
    for(const child of [...panel.children])if(!isChrome(child))body.append(child);
    panel.append(body);panel.classList.add('nm-panel-frame');
    if(!panel._nmFrameObserver&&typeof root.MutationObserver==='function'){
      panel._nmFrameObserver=new root.MutationObserver(()=>{
        if(panel._nmFraming)return;panel._nmFraming=true;
        try{
          for(const child of [...panel.children]){
            if(!isChrome(child))body.append(child);
          }
        }finally{panel._nmFraming=false;}
      });
      panel._nmFrameObserver.observe(panel,{childList:true});
    }
  }
  const compactParts=new WeakMap();
  // Shared Panel Shell: open keeps a fixed header + scroll body; collapsed keeps
  // that same header slot; closed relies cleanly on CSS rules and never leaves a
  // sticky inline pointer-events:none locking newly opened panels.
  function panelShellState(panel){
    if(!panel)return 'closed';
    if(panel.hidden||panel.classList.contains('hidden')||panel.classList.contains('collapsed'))return 'closed';
    if(panel.classList.contains('nm-panel-compact')||panel.classList.contains('nm-panel-minimized')||panel.classList.contains('minimized'))return 'collapsed';
    return 'open';
  }
  const observedShells=new WeakSet();
  function syncPanelShell(panel){
    if(!panel)return;
    const state=panelShellState(panel);
    panel.dataset.nmPanelState=state;
    panel.classList.toggle('nm-panel-shell',true);
    // Always clear any inline pointer-events so standard open/close toggles keep panels clickable & scrollable.
    if(panel.style.getPropertyValue('pointer-events'))panel.style.removeProperty('pointer-events');
    if(!observedShells.has(panel)&&typeof root.MutationObserver==='function'){
      observedShells.add(panel);
      new root.MutationObserver(()=>{
        const next=panelShellState(panel);
        if(panel.dataset.nmPanelState!==next)panel.dataset.nmPanelState=next;
        if(panel.style.getPropertyValue('pointer-events'))panel.style.removeProperty('pointer-events');
      }).observe(panel,{attributes:true,attributeFilter:['class','hidden']});
    }
  }
  function setPanelCompact(panel,header,compact) {
    panel.classList.toggle('nm-panel-compact',compact);
    // Hide actual sibling subtrees rather than clipping a full-height panel.
    // Restore only display; values, handlers, hidden flags and draft DOM survive.
    let saved=compactParts.get(panel);
    if(!saved)compactParts.set(panel,saved=new Map());
    if(compact){
      for(let current=header;current&&current!==panel;current=current.parentElement){
        if(current!==header)current.classList.add('nm-panel-heading-path');
        for(const sibling of current.parentElement.children){
          if(sibling===current||saved.has(sibling))continue;
          saved.set(sibling,[sibling.style.getPropertyValue('display'),sibling.style.getPropertyPriority('display')]);
          sibling.style.setProperty('display','none','important');
        }
      }
      // AI has secondary service controls within its heading; keep icons and titles visible.
      const actions=header.querySelector(':scope>.nm-panel-header-actions');
      const title=header.querySelector(':scope>strong,:scope>h2,:scope>.hud-title,:scope>.inspector-title')||header.querySelector(':scope>span:first-of-type');
      const icon=header.querySelector(':scope>svg.nm-workspace-icon,:scope>.nm-kn-header-icon');
      for(const child of header.children)if(child!==actions&&child!==title&&child!==icon&&!saved.has(child)){
        saved.set(child,[child.style.getPropertyValue('display'),child.style.getPropertyPriority('display')]);
        child.style.setProperty('display','none','important');
      }
    }else{
      for(const [element,[display,priority]] of saved){
        if(display)element.style.setProperty('display',display,priority);else element.style.removeProperty('display');
      }
      saved.clear();
    }
    syncPanelShell(panel);
  }
  function makeCollapsible(shade,panel,header) {
    if(!shade||!panel||!header||panel.dataset.nmCollapsible)return;
    panel.dataset.nmCollapsible='true';
    framePanel(panel,header);
    let scrollPositions=[];
    const close=[...header.querySelectorAll('button:not(.nm-panel-preview-toggle)')].at(-1);
    panelHeader(header,close);
    // Mobile panels should close, not turn into mostly empty floating pills.
    // Their corresponding toolbar actions can open them again.
    const onPhone=()=>root.GlaukaMobile||document.body?.classList.contains('glauka-mobile-app');
    const mobileInspector=()=>onPhone()&&shade===panel&&panel.id==='inspector-sidebar';
    const mobileDialog=()=>onPhone()&&
      (shade.id==='glauka-app-sheet'||shade.id==='gl-android-style-overlay');
    // Touch sheets close or dismiss directly rather than collapsing into floating bars.
    if(onPhone())return;
    const toggle=document.createElement('button');toggle.type='button';
    toggle.className='nm-panel-preview-toggle';
    function sync(){
      const compact=shade.classList.contains('nm-panel-minimized');
      const label=mobileInspector()||mobileDialog()?tr('Chiudi','Close'):(compact?tr('Espandi','Expand'):tr('Riduci','Minimize'));
      toggle.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(compact?'m6 15 6-6 6 6':'m6 9 6 6 6-6')+'"/></svg>';
      toggle.setAttribute('aria-expanded',String(!compact));
      toggle.setAttribute('aria-label',label);
      toggle.title=label;
      const it=mobileInspector()||mobileDialog()?'Chiudi':compact?'Espandi':'Riduci';
      const en=mobileInspector()||mobileDialog()?'Close':compact?'Expand':'Minimize';
      // Explicit DOM-owned copy avoids retaining a closed dialog in bindings.
      toggle.setAttribute('data-glauka-ui-pair','');
      toggle.dataset.itLabel=it;toggle.dataset.enLabel=en;
      setPanelCompact(panel,header,compact);
      syncPanelShell(panel);
      if(panel.getAttribute('role')==='dialog')panel.setAttribute('aria-modal',String(!compact));
    }
    toggle.addEventListener('click',()=>{
      if(mobileInspector()){
        shade.classList.remove('nm-panel-minimized','nm-panel-compact');
        shade.classList.add('collapsed');
        sync();
        document.getElementById('glauka-style-open')?.focus({preventScroll:true});
        return;
      }
      if(mobileDialog()){
        if(shade.id==='glauka-app-sheet')document.getElementById('glauka-sheet-close')?.click();
        else root.GlaukaAndroidStylePanel?.close();
        return;
      }
      const active=document.activeElement;
      if(panel.contains(active)&&active.matches('input,textarea'))active.blur();
      if(!shade.classList.contains('nm-panel-minimized')){
        scrollPositions=[panel,...panel.querySelectorAll('*')].filter(e=>e.scrollTop||e.scrollLeft).map(e=>[e,e.scrollTop,e.scrollLeft]);
      }
      shade.classList.toggle('nm-panel-minimized');sync();
      if(!shade.classList.contains('nm-panel-minimized'))restoreScroll();
    });
    panelHeader(header,close,toggle);sync();
    function restoreScroll(){
      panel._nmOnExpand?.();
      const saved=scrollPositions;scrollPositions=[];
      requestAnimationFrame(()=>saved.forEach(([e,top,left])=>{if(e.isConnected){e.scrollTop=top;e.scrollLeft=left;}}));
    }
    shade._nmExpandPanel=()=>{shade.classList.remove('nm-panel-minimized');sync();restoreScroll();};
    return toggle;
  }
  function dialog(app, id, it, en, options={}) {
    document.getElementById(id)?.remove();
    app.closeEditor(true);
    const previous = document.activeElement,
      owner = app.state;
    const shade = document.createElement("div");
    shade.id = id;
    shade.className = "nm-creative-shade nm6-skiptranslate";
    const dock=!!options.dock&&!root.GlaukaMobile&&root.innerWidth>=720;
    if(dock)shade.classList.add("nm-creative-sidecar");
    const panel = document.createElement("section");
    panel.className = "nm-creative-dialog";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", String(!dock));
    panel.setAttribute("aria-labelledby", id + "-title");
    panel.tabIndex = -1;
    const header = document.createElement("header"),
      title = document.createElement("h2");
    title.id = id + "-title";
    title.dataset.it = it;
    title.dataset.en = en;
    title.textContent = tr(it, en);
    const close = button(id + "-close", "Chiudi", "Close", () => finish());
    header.append(title, close);
    panel.append(header);
    shade.append(panel);
    const finish = () => {
      shade.remove();
      options.onClose?.();
      previous?.focus?.();
    };
    shade.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      }
      if (e.key === "Tab" && (!dock || shade.classList.contains("nm-creative-expanded"))) {
        const list = [
          ...panel.querySelectorAll("button,input,textarea,select"),
        ].filter((el) => !el.disabled && el.getClientRects().length > 0);
        const first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    });
    shade.addEventListener("paste", (e) => e.stopPropagation());
    let setDockExpanded;
    shade.onclick = (e) => {
      if (e.target === shade){
        if(dock&&shade.classList.contains("nm-creative-expanded")){
          setDockExpanded(false);
        }else if(!dock)finish();
      }
    };
    if(dock){
      let dockScroll=0,expandedScroll=null;
      const expand=button(id+"-expand","Espandi","Expand",()=>
        setDockExpanded(!shade.classList.contains("nm-creative-expanded")));
      setDockExpanded=(expanded)=>{
        const scroll=panel.scrollTop,focused=document.activeElement;
        // A taller expanded viewport can clamp scrollTop near the bottom.
        // Restore the dock position unless the user actually scrolled there.
        const target=!expanded&&expandedScroll!==null&&Math.abs(scroll-expandedScroll)<2
          ?dockScroll:scroll;
        if(expanded)dockScroll=scroll;
        shade.classList.toggle("nm-creative-expanded",expanded);
        panel.setAttribute("aria-modal",String(expanded));
        expand.setAttribute("aria-expanded",String(expanded));
        expand.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="'+(expanded?'m6 9 6 6 6-6':'m6 15 6-6 6 6')+'"/></svg>';
        expand.title=expanded?tr("Riduci","Dock"):tr("Espandi","Expand");
        expand.setAttribute("aria-label",expand.title);
        panel._nmOnExpand?.();
        requestAnimationFrame(()=>{
          if(!panel.isConnected)return;
          panel.scrollTop=target;
          expandedScroll=expanded?panel.scrollTop:null;
          if(focused?.isConnected&&panel.contains(focused))focused.focus({preventScroll:true});
        });
      };
      delete expand.dataset.it;delete expand.dataset.en;
      expand.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>';
      expand.className="nm-creative-expand nm-panel-preview-toggle";
      expand.setAttribute("aria-expanded","false");
      expand.setAttribute("aria-label",tr("Espandi la libreria","Expand library"));
      header.insertBefore(expand,close);
    }else makeCollapsible(shade,panel,header);
    panelHeader(header,close,header.querySelector('.nm-creative-expand'));
    document.body.append(shade);
    if(typeof queueMicrotask==='function')queueMicrotask(()=>{if(panel.isConnected)framePanel(panel,header)});
    panel.focus();
    return { panel, shade, close: finish, valid: () => owner === app.state };
  }
  function addGraphic(app, svg, w, h, meta, position = null) {
    const center =
      position || app.renderer.screenToWorld(innerWidth / 2, innerHeight / 2);
    const image = app.state.addImageItem({
      src: data(svg),
      width: w,
      height: h,
      naturalWidth: w,
      naturalHeight: h,
      mode: "free",
      worldPos: center,
      graphic: meta,
      frame: "none",
      borderRadius: 0,
    });
    app.selectImage(image.id);
    app.markChanged();
    return image;
  }
  root.NeuroMapCreativeModules = {
    ui: {
      core,
      tr,
      data,
      BUTTONS,
      button,
      field,
      locale,
      openURL,
      nodeURL,
      dialog,
      makeCollapsible,
      panelHeader,
      setPanelCompact,
      panelShellState,
      syncPanelShell,
      appliedBadge,
      addGraphic,
    },
  };
})(globalThis);
