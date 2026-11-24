  function modeIcon(mode) {
    const pill = (cx, cy, w, h, rx, cls, extra = "") =>
        `<rect class="${cls}" x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w}" height="${h}" rx="${rx}"${extra}/>`,
      rootPill = (cx, cy, w = 14, h = 6.5) =>
        pill(cx, cy, w, h, (h / 2).toFixed(2), "nm-mode-root", ' fill="var(--nm-theme-action, #5b3fd0)" stroke="none"'),
      leafPill = (cx, cy, w = 12, h = 4.6) =>
        pill(cx, cy, w, h, (h / 2).toFixed(2), "nm-mode-node", ' fill="currentColor" fill-opacity="0.86" stroke="none"'),
      subPill = (cx, cy, w = 10, h = 3.8) =>
        pill(cx, cy, w, h, (h / 2).toFixed(2), "nm-mode-subnode", ' fill="currentColor" fill-opacity="0.46" stroke="none"'),
      curve = (x1, y1, x2, y2, cls = "nm-mode-branch", op = "0.45") => {
        const mx = ((x1 + x2) / 2).toFixed(1);
        return `<path class="${cls}" d="M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" fill="none" stroke="currentColor" stroke-opacity="${op}" stroke-width="1.35" stroke-linecap="round"/>`;
      };
    let body = "";
    if (mode === "clockwise") {
      const pts = [
        [56.5, 13, 47, 50.5],
        [56.5, 33, 47, 50.5],
        [23.5, 33, 33, 29.5],
        [23.5, 13, 33, 29.5],
      ];
      for (const [x, y, sx, ex] of pts) {
        body += curve(sx, 23, ex, y) + leafPill(x, y, 12, 4.6);
      }
      body += rootPill(40, 23, 14, 6.5);
      body +=
        '<defs><marker id="nm-clockwise-head" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="6" markerHeight="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M1.5 1.5 L6.5 4 L1.5 6.5" fill="none" stroke="var(--nm-clockwise-stroke, #f59e0b)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>' +
        '<circle class="nm-clockwise-dot" cx="46" cy="6.4" r="1.65" fill="var(--nm-clockwise-stroke, #f59e0b)" stroke="none"/>' +
        '<path class="nm-clockwise-arrow" d="M46 6.4 A33 17 0 1 1 11 14" fill="none" stroke="var(--nm-clockwise-stroke, #f59e0b)" stroke-width="1.7" stroke-linecap="round" marker-end="url(#nm-clockwise-head)"/>';
    } else if (mode === "balanced") {
      for (const [sx, ex, cx] of [
        [33, 20, 13.5],
        [47, 60, 66.5],
      ]) {
        for (const y of [9.5, 23, 36.5]) {
          body += curve(sx, 23, ex, y) + leafPill(cx, y, 13, 4.6);
        }
      }
      body += rootPill(40, 23, 14, 6.5);
    } else if (mode === "fluid") {
      body += '<path class="nm-mode-guide" d="M36 4.5 V17.5 M36 28.5 V41.5" fill="none" stroke="currentColor" stroke-opacity="0.22" stroke-width="1.1" stroke-dasharray="2 2"/>';
      body += curve(29, 23, 19.5, 14) + leafPill(13.5, 14, 12, 4.6);
      body += curve(29, 23, 19.5, 32) + leafPill(13.5, 32, 12, 4.6);
      body += curve(43, 23, 49, 15.5) + leafPill(54.5, 15.5, 11, 4.6);
      body += curve(60, 15.5, 65.5, 9.5, "nm-mode-branch", "0.35") + subPill(70.5, 9.5, 10, 3.8);
      body += curve(60, 15.5, 65.5, 21.5, "nm-mode-branch", "0.35") + subPill(70.5, 21.5, 10, 3.8);
      body += curve(43, 23, 50.5, 35) + leafPill(56.5, 35, 12, 4.6);
      body += rootPill(36, 23, 14, 6.5);
    } else if (mode === "columns") {
      body +=
        '<rect class="nm-mode-guide" x="4" y="4.5" width="24" height="37" rx="4" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.24" stroke-width="1"/>' +
        '<rect class="nm-mode-guide" x="52" y="4.5" width="24" height="37" rx="4" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.24" stroke-width="1"/>' +
        '<path class="nm-mode-branch" d="M28 23 H33.5 M46.5 23 H52" fill="none" stroke="currentColor" stroke-opacity="0.45" stroke-width="1.35"/>' +
        '<path class="nm-mode-branch" d="M8.5 10 V36.5 M6.6 34.4 L8.5 36.8 L10.4 34.4 M8.5 11.5 H12 M8.5 23 H12 M8.5 34.5 H12" fill="none" stroke="currentColor" stroke-opacity="0.52" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path class="nm-mode-branch" d="M71.5 10 V36.5 M69.6 34.4 L71.5 36.8 L73.4 34.4 M71.5 11.5 H68 M71.5 23 H68 M71.5 34.5 H68" fill="none" stroke="currentColor" stroke-opacity="0.52" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>';
      for (const y of [11.5, 23, 34.5]) {
        body += leafPill(18.5, y, 13, 4.4) + leafPill(61.5, y, 13, 4.4);
      }
      body += rootPill(40, 23, 13, 6.2);
    } else if (mode === "right") {
      for (const y of [10, 23, 36]) {
        body += curve(21, 23, 32.5, y) + leafPill(38.5, y, 12, 4.6);
      }
      for (const [py, cy] of [
        [10, 6.5],
        [10, 13.5],
        [36, 32.5],
        [36, 39.5],
      ]) {
        body += curve(44.5, py, 59, cy, "nm-mode-branch", "0.35") + subPill(64.5, cy, 11, 3.8);
      }
      body += rootPill(14, 23, 14, 6.5);
    } else if (mode === "left") {
      for (const y of [10, 23, 36]) {
        body += curve(59, 23, 47.5, y) + leafPill(41.5, y, 12, 4.6);
      }
      for (const [py, cy] of [
        [10, 6.5],
        [10, 13.5],
        [36, 32.5],
        [36, 39.5],
      ]) {
        body += curve(35.5, py, 21, cy, "nm-mode-branch", "0.35") + subPill(15.5, cy, 11, 3.8);
      }
      body += rootPill(66, 23, 14, 6.5);
    }
    return `<svg viewBox="0 0 80 46" width="80" height="46" fill="none">${body}</svg>`;
  }
  // Bounded, read-only vector thumbnail of the actual computed layout. Uses
  // round-robin per top-level branch so late branches always show children too.
  function updateMiniPreview(app) {
    const host=document.getElementById("nm-layout-mini-preview");
    const svg=host?.querySelector?.("svg");
    if(!host||!svg||!app?.state?.root||!app.layout?.getLayout)return;
    const MAX_MINI=48,MAX_SCAN=140,sample=[];
    const PALETTE=["#7c3aed","#ec4899","#14b8a6","#f59e0b","#3b82f6","#10b981"];
    let truncated=false;
    const readBox=id=>{try{return app.layout.getLayout(id)}catch(_){return null}};
    if(!app.layout.presentationRoot){
      const rootNode=app.state.root,seen=new Set(),branchQueues=[];
      let scanned=0;
      const rootBox=rootNode?.id?readBox(rootNode.id):null;
      if(rootNode?.id){
        seen.add(rootNode.id);scanned++;
        if(rootBox&&Number.isFinite(rootBox.x)&&Number.isFinite(rootBox.y)){
          sample.push({id:rootNode.id,logicalId:rootNode.id,parent:null,depth:0,x:rootBox.x,y:rootBox.y,w:rootBox.width||130,color:rootNode.color||""});
        }
      }
      const mains=rootNode.children||[];
      if(mains.length>24)truncated=true;
      mains.slice(0,24).forEach((branch,idx)=>{
        if(!branch?.id||seen.has(branch.id)||sample.length>=MAX_MINI||scanned>=MAX_SCAN)return;
        seen.add(branch.id);scanned++;
        const bColor=branch.color||PALETTE[idx%PALETTE.length];
        const box=readBox(branch.id);
        if(box&&Number.isFinite(box.x)&&Number.isFinite(box.y)){
          sample.push({id:branch.id,logicalId:branch.id,parent:rootNode.id,depth:1,x:box.x,y:box.y,w:box.width||100,color:bColor});
        }
        const subQ=(branch.children||[]).map(c=>({node:c,parent:branch.id,depth:2,color:bColor}));
        if(subQ.length)branchQueues.push(subQ);
      });
      // Round-robin across main branches so the last branch receives its children equally.
      let progress=true;
      while(progress&&sample.length<MAX_MINI&&scanned<MAX_SCAN){
        progress=false;
        for(const q of branchQueues){
          while(q.length){
            const {node,parent,depth,color}=q.shift();
            if(!node?.id||seen.has(node.id))continue;
            seen.add(node.id);scanned++;progress=true;
            const box=readBox(node.id);
            const nodeColor=node.color||color;
            if(box&&Number.isFinite(box.x)&&Number.isFinite(box.y)){
              sample.push({id:node.id,logicalId:node.id,parent,depth,x:box.x,y:box.y,w:box.width||84,color:nodeColor});
            }
            for(const child of (node.children||[]).slice(0,12)){
              q.push({node:child,parent:node.id,depth:depth+1,color:nodeColor});
            }
            break;
          }
          if(sample.length>=MAX_MINI||scanned>=MAX_SCAN)break;
        }
      }
      if(branchQueues.some(q=>q.length))truncated=true;
    }else{
      let points;
      try{points=root.NeuroMapNavigationCore?.layoutPoints(app.state.root,app.layout);}
      catch(error){host.hidden=true;console.warn("Layout miniature unavailable",error);return;}
      if(!points)return;
      if(points.length>MAX_MINI)truncated=true;
      // Sample shallow levels symmetrically; repeated logical IDs are distinct views.
      const center=points.find(n=>n.depth===0)?.x||0;
      const levels=new Map();
      for(const point of points){let row=levels.get(point.depth);if(!row)levels.set(point.depth,row=[[],[]]);row[point.x<center?0:1].push(point);}
      for(const depth of [...levels.keys()].sort((a,b)=>a-b)){
        const [left,right]=levels.get(depth);let i=0;
        while((i<left.length||i<right.length)&&sample.length<MAX_MINI){
          if(i<right.length)sample.push({...right[i],parent:right[i].parentId,w:right[i].width||90,color:right[i].color||""});
          if(i<left.length&&sample.length<MAX_MINI)sample.push({...left[i],parent:left[i].parentId,w:left[i].width||90,color:left[i].color||""});
          i++;
        }
        if(sample.length===MAX_MINI)break;
      }
    }
    host.hidden=sample.length<2;
    if(host.hidden)return;
    const xs=sample.map(p=>p.x),ys=sample.map(p=>p.y);
    const minX=Math.min(...xs),maxX=Math.max(...xs),
      minY=Math.min(...ys),maxY=Math.max(...ys);
    const scale=Math.min(264/Math.max(1,maxX-minX),86/Math.max(1,maxY-minY),1.25);
    const offsetX=160-(minX+maxX)*scale/2;
    const offsetY=58-(minY+maxY)*scale/2;
    const widthOf=p=>p.depth===0?Math.max(22,Math.min(38,(p.w||120)*scale)):Math.max(9,Math.min(28,(p.w||88)*scale));
    const coords=p=>[p.x*scale+offsetX,p.y*scale+offsetY];
    const byId=new Map(sample.map(p=>[p.id,p]));
    const ns="http://www.w3.org/2000/svg",draw=[];
    const make=(tag,attrs)=>{
      const e=document.createElementNS(ns,tag);
      for(const [name,value] of Object.entries(attrs))e.setAttribute(name,String(value));
      return e;
    };
    for(const item of sample){
      const parent=byId.get(item.parent);
      if(!parent)continue;
      const [px,py]=coords(parent),[cx,cy]=coords(item);
      const pw=widthOf(parent)/2,cw=widthOf(item)/2;
      const dir=cx>=px?1:-1;
      const x1=Math.abs(cx-px)>pw+cw?px+dir*pw*0.7:px;
      const x2=Math.abs(cx-px)>pw+cw?cx-dir*cw*0.85:cx;
      const mx=(x1+x2)/2;
      draw.push(make("path",{
        d:`M${x1.toFixed(1)} ${py.toFixed(1)} C${mx.toFixed(1)} ${py.toFixed(1)} ${mx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${cy.toFixed(1)}`,
        fill:"none",
        stroke:item.color||parent.color||"currentColor",
        "stroke-width":item.depth===1?1.65:1.25,
        "stroke-linecap":"round",
        opacity:item.depth===1?.78:.56
      }));
    }
    for(const item of sample){
      const [x,y]=coords(item),rootNode=item.depth===0;
      const w=widthOf(item),h=rootNode?10:item.depth===1?6.5:5;
      const attrs={
        x:(x-w/2).toFixed(1),y:(y-h/2).toFixed(1),
        width:w.toFixed(1),height:h.toFixed(1),rx:(h/2).toFixed(2),
        "data-visual-id":item.id,"data-logical-id":item.logicalId,
        class:rootNode?"nm-layout-mini-root":"nm-layout-mini-node"
      };
      if(!rootNode&&item.color){
        attrs.stroke=item.color;
        attrs["stroke-width"]="1.1";
      }
      draw.push(make("rect",attrs));
    }
    svg.replaceChildren(...draw);
    const noteEl=host.querySelector?.("small");
    if(noteEl){
      const itNote=truncated
        ?`Panoramica bilanciata · ${sample.length} nodi principali · sola lettura`
        :`Anteprima reale · ${sample.length} nodi · sola lettura`;
      const enNote=truncated
        ?`Balanced overview · ${sample.length} key nodes · read-only`
        :`Live preview · ${sample.length} nodes · read-only`;
      if(noteEl.dataset){noteEl.dataset.it=itNote;noteEl.dataset.en=enNote;}
      noteEl.textContent=tr(itNote,enNote);
    }
    svg.setAttribute("aria-label",tr("Miniatura della disposizione reale, "+
      sample.length+" nodi","Actual map layout miniature, "+sample.length+" nodes"));
  }
  function chooseMode(app, mode) {
    if (!BUTTONS.some((b) => b[0] === mode)) return;
    app.closeEditor(true);
    const config = app.state.root.layoutDistribution;
    const previous = app.state.root.layoutMode;
    app.state.pushHistory();
    if(mode==='balanced')app.state.root.layoutBalanceMode='geometry';
    if (app.state.branchStyle === "radial") app.state.branchStyle = "xmind8";
    if (mode === "clockwise" && !config?.enabled) {
      if (config?.overflowMode !== "expand" && (previous === "right" || previous === "left")) {
        app.state.balanceBias = app.state.thresholdY = 50;
        app.state.root.layoutMode = "balanced";
        app.recalculateAndRender();
      }
      app.state.root.layoutDistribution = config?.overflowMode === "expand"
        ? {...config, enabled:true} : root.NeuroMapContinuation.initialSettings(app);
      app.layout._preferredViews?.clear();
    } else if (mode !== "clockwise" && config)
      app.state.root.layoutDistribution = { ...config, enabled: false };
    app.state.root.layoutMode = mode;
    app.markChanged();
    root.NeuroMapContinuation?.showGuides(app);
    root.requestAnimationFrame?.(()=>updateMiniPreview(app));
  }
  function sync(app) {
    if (!app.state?.root || !document.getElementById("nm-creative-launcher"))
      return;
    if (app._nmDraw && app._nmDraw.owner !== app.state) stopDrawing(app);
    inspector.sync(app);
    const node = app.state.findNode(app.state.selectedNodeId);
    const image = app.state.findImage(app.state.selectedImageId);
    const mode = app.state.root.layoutDistribution?.enabled
      ? "clockwise"
      : app.state.root.layoutMode || "balanced";
    const stamp = [
      app.state,
      node?.id,
      node?.text,
      node?.linkUrl,
      !!node?.boundary?.enabled,
      image?.id,
      !!image?.graphic,
      mode,
      app.state.branchStyle,
      document.documentElement.lang,
    ];
    if (app._nmCreativeSyncStamp?.every((value, i) => value === stamp[i]))
      return;
    app._nmCreativeSyncStamp = stamp;
    const boundary = document.getElementById("nm-boundary-controls");
    if (boundary)
      boundary.hidden = !app._nmBoundarySelection || !node?.boundary?.enabled;
    const link = document.getElementById("nm-ctx-link-open");
    if (link) link.hidden = !nodeURL(node);
    const title = document.getElementById("nm-ctx-boundary-title");
    if (title) title.hidden = !node?.boundary?.enabled;
    const fenceTools = document.getElementById("nm615-style-tools");
    if (fenceTools) fenceTools.hidden = !node?.boundary?.enabled;
    for (const id of ["nm-graphic-edit", "nm-graphic-library-save"]) {
      const el = document.getElementById(id);
      if (el) el.hidden = !image?.graphic;
    }
    const media = document.getElementById("nm-media-tools");
    if (media) media.hidden = !!image?.graphic;
    const modes = document.getElementById("nm-layout-modes");
    const hints={
      clockwise: ["Ordine di lettura: destra dall'alto, poi sinistra dal basso. Regola la distribuzione in questa modalità.", "Reading order: right top-down, then left bottom-up. Adjust distribution here."],
      balanced: ["Alterna i lati secondo l'ingombro, non secondo l'ordine orario. Distribuzione automatica.", "Balances measured branch sizes, not clockwise order. Automatic distribution."],
      fluid: ["Prime posizioni a destra, poi lato meno occupato. Trascina per riordinare o fissare un lato.", "Starts on the right, then uses the shorter side. Drag to reorder or pin."],
      columns: ["Due colonne: ordine di lettura dall'alto verso il basso su entrambi i lati.", "Two columns: read top to bottom on both sides."],
      right: ["Solo a destra, eccetto i rami che hai fissato a sinistra.", "Right side, except branches you pinned left."],
      left: ["Solo a sinistra, eccetto i rami che hai fissato a destra.", "Left side, except branches you pinned right."]
    };
    const hint=document.getElementById("nm-fluid-mode-hint");
    if(hint)hint.textContent=tr(...(hints[mode]||["Trascina i rami per personalizzare","Drag branches to personalize"]));
    for(const b of document.querySelectorAll("#nm-layout-modes [data-title-it]"))
      b.title=document.documentElement.lang==="en"?b.dataset.titleEn:b.dataset.titleIt;
    if (modes)
      modes.setAttribute(
        "aria-label",
        tr("Modalità di disposizione", "Layout mode"),
      );
    for (const b of document.querySelectorAll("#nm-layout-modes button"))
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    const other = document.getElementById("nm-layout-other");
    // Do not hide the currently selected setting when reopening Disposizione.
    if (other && ['columns','right','left'].includes(mode)) other.open = true;
    const panel = document.getElementById("nm-distribution-controls");
    if (panel) panel.hidden = mode !== "clockwise";
    updateMiniPreview(app);
    // The bias slider has no effect on geometric Balanced or Fluid, so
    // disabling it avoids implying that the control changes those modes.
    const biasEnabled = mode === "clockwise" || mode === "columns";
    for (const id of ["threshold-slider", "menu-threshold-slider"]) {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = !biasEnabled;
        el.title = biasEnabled
          ? tr("Scegli quanto spazio assegnare a destra e sinistra.", "Choose the right/left distribution bias.")
          : tr("Distribuzione automatica: il cursore è disponibile in Orario e Colonne.",
               "Automatic distribution: this slider is available in Clockwise and Columns.");
      }
      if (id === "threshold-slider")
        el?.closest(".slider-row")?.classList.toggle("nm-layout-unused", !biasEnabled);
    }
  }
