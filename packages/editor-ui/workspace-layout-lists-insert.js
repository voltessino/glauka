  function mountInsert(app, dock, book, aiButton) {
    const launcher = document.getElementById("nm-creative-launcher");
    if (!launcher || !dock) return null;
    const panel = document.createElement("section");
    panel.id = "nm-insert-panel";
    panel.hidden = true;
    panel.className = "nm6-skiptranslate";
    const header = document.createElement("header"),
      title = document.createElement("strong"),
      close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    const trigger = document.createElement("button");
    trigger.id = "nm-open-insert";
    trigger.type = "button";
    trigger.setAttribute("aria-controls", panel.id);
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML =
      '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 4h9M4 4v16h16v-9M10 14l1-4 8-8 3 3-8 8-4 1Z"/></svg>';
    if (book && book.parentElement === dock) book.after(trigger);
    else if (aiButton) aiButton.before(trigger);
    else dock.append(trigger);
    const setOpen = (value) => {
      panel.hidden = !value;
      trigger.setAttribute("aria-expanded", String(value));
    };
    trigger.addEventListener("click", () => {
      if (panel.hidden && claim(app, "insert") === false) return;
      setOpen(panel.hidden);
    });
    close.addEventListener("click", () => setOpen(false));
    panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        trigger.focus();
      }
      e.stopPropagation();
    });
    const translate = () => {
      title.textContent = tr("Inserisci e disegna", "Insert and draw");
      trigger.title = title.textContent;
      trigger.setAttribute("aria-label", title.textContent);
      close.setAttribute("aria-label", tr("Chiudi", "Close"));

    };
    translate();
    root.NeuroMapWorkspaceLocale?.watch(translate);
    launcher.open = true;
    launcher.querySelector("summary").hidden = true;
    header.append(title, close);
    const shortcuts=document.createElement("details");
    shortcuts.id="nm-insert-shortcuts";
    shortcuts.className="nm6-skiptranslate";
    shortcuts.hidden=true;
    const shortcutsTitle=document.createElement("summary");
    const shortcutsGrid=document.createElement("div");
    shortcutsGrid.className="nm-insert-shortcut-grid";
    shortcuts.append(shortcutsTitle,shortcutsGrid);
    panel.append(header, launcher);
    const section = (id, it, en) => {
      const box = document.createElement("section");
      box.id = id;
      box.className = "nm-insert-section";
      const heading = document.createElement("h3");
      root.NeuroMapWorkspaceLocale?.bind(heading, it, en);
      const grid = document.createElement("div");
      grid.className = "nm-insert-grid";
      box.append(heading, grid);
      panel.append(box);
      return grid;
    };
    const action = (id, it, en, glyph, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.id = id;
      const icon = document.createElement("span"),
        label = document.createElement("span");
      icon.className = "nm-insert-glyph";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = glyph;
      root.NeuroMapWorkspaceLocale?.bind(label, it, en);
      b.append(icon, label);
      root.NeuroMapWorkspaceLocale?.bind(b,it,en,"aria-label");
      b.addEventListener("click", fn);
      return b;
    };
    // Keep the original command elements and callbacks; only their presentation changes.
    const pictures=section('nm-insert-pictures','Immagini e contenuti','Images and content');
    pictures.className='nm-insert-tool-grid';
    pictures.append(
      insertTool(action('nm-insert-image','Immagine','Image','',()=>document.getElementById('menu-add-image')?.click()),
        'Immagine','Image','M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6M8 8h.01',
        'Inserisci un’immagine da file','Insert an image from a file'),
      insertTool(action('nm-insert-gallery','Libreria creativa','Creative library','',()=>root.NeuroMapCreative?.libraryHub(app)),
        'Libreria creativa','Creative library','M3 3h7v7H3zM17 3l4 7h-8zM10 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0M15 14h6v7h-6z',
        'Simboli, icone, illustrazioni e creazioni personali','Symbols, icons, illustrations and personal items')
    );
    const illustration=document.getElementById('btn-illustrate');
    if(illustration){
      pictures.append(insertTool(illustration,'Cerca online','Search online',
        'M3 4h12v12H3zM3 13l4-4 4 4M19 14a4 4 0 1 0 0 .01M21 21l-3-3',
        'Cerca un’illustrazione online per il ramo selezionato','Find an online illustration for the selected branch'));
      // The legacy online picker is a modal, not a coordinated side panel.
      // Let its existing handler run before hiding the launcher that covers it.
      illustration.addEventListener('click',()=>queueMicrotask(()=>{
        const modal=document.getElementById('nm54-illustration-modal');
        if(modal&&!modal.classList.contains('hidden'))setOpen(false);
      }));
    }
    pictures.append(
      insertTool(action('nm-insert-wordart','WordArt','WordArt','',()=>root.NeuroMapCreativeModules.drawing.wordArtDialog(app)),
        'WordArt','WordArt','M4 19L12 4l8 15M7 14h10M4 22h16','Inserisci un titolo decorativo','Insert decorative text'),
      insertTool(action('nm-insert-chart','Grafico','Chart','',()=>root.NeuroMapCreativeModules.drawing.chartDialog(app)),
        'Grafico','Chart','M3 3v18h18M7 17v-5h3v5M12 17V8h3v9M17 17V4h3v13','Inserisci un grafico con dati','Insert a data chart')
    );
    const formula=launcher.querySelector('#nm-insert-formula');
    if(formula)pictures.append(insertTool(formula,'Formule','Formulas','M19 4H7l7 8-7 8h12','Inserisci una formula matematica','Insert a mathematical formula'));
    // Legacy integrations still reach the same marker command without a duplicate launcher.
    const markers=document.getElementById('nm62-toolbar-assets');
    if(markers){launcher.append(markers);markers.hidden=true;}
    const shapes = section(
      "nm-insert-shapes",
      "Forme",
      "Shapes",
    );
    shapes.classList.add("nm-insert-shape-grid");
    shapes.parentElement.classList.add("nm-insert-shapes-section");
    const shapeGroups=[
      ["Forme", "Shapes",[
        ["rect","Rettangolo","Rectangle"],["roundrect","Arrotondato","Rounded rectangle"],
        ["ellipse","Ellisse","Ellipse"],["circle","Cerchio","Circle"],
        ["diamond","Rombo","Diamond"],["triangle","Triangolo","Triangle"],
        ["hexagon","Esagono","Hexagon"],["parallelogram","Parallelogramma","Parallelogram"],
        ["pill","Capsula","Capsule"],["cloud","Nuvola","Cloud"],
        ["speech","Fumetto","Speech bubble"],["star","Stella","Star"]
      ]],
      ["Linee e collegamenti","Lines and connectors",[
        ["line","Linea","Line"],["arrow","Freccia","Arrow"],
        ["double-arrow","Doppia freccia","Double arrow"],["dashed","Tratteggiata","Dashed line"],
        ["curve","Curva","Curve"],["elbow","Ad angolo","Elbow connector"]
      ]]
    ];
    for(const [sectionIt,sectionEn,items] of shapeGroups){
      const title=document.createElement("h4");
      title.className="nm-insert-shape-category";
      root.NeuroMapWorkspaceLocale?.bind(title,sectionIt,sectionEn);
      shapes.append(title);
      for(const [tool,it,en] of items){
        const isLine=["line","arrow","double-arrow","dashed","curve","elbow"].includes(tool);
        const w=isLine?160:160,h=isLine?76:96;
        const meta=root.NeuroMapCreativeModules.ui.core.graphic({
          kind:"shape",tool,color:"#a5b4fc",stroke:3,width:w,height:h
        });
        const b=action("nm-insert-shape-"+tool,it,en,"",()=>
          root.NeuroMapCreative.addGraphic(
            app,root.NeuroMapCreativeModules.ui.core.shapeSVG(meta),w,h,meta
          )
        );
        b.classList.add("nm-insert-shape-tile");
        b.draggable=true;b.dataset.glShape=tool;
        const art=document.createElement("span");
        art.className="nm-insert-shape-preview";
        art.setAttribute("aria-hidden","true");
        art.innerHTML=root.NeuroMapCreativeModules.ui.core.shapeSVG(meta);
        b.prepend(art);
        root.NeuroMapWorkspaceLocale?.bind(b,it,en,"aria-label");
        shapes.append(b);
      }
    }
    // Word-style compact shape picker: keep all existing real SVG controls,
    // including drag/drop, under one accessible, keyboard-operated disclosure.
    const shapePicker=document.createElement('details');
    shapePicker.id='nm-shapes-picker';
    shapePicker.className='nm-shapes-picker nm6-skiptranslate';
    const shapeSummary=document.createElement('summary');
    root.NeuroMapWorkspaceLocale?.bind(shapeSummary,'Scegli una forma','Choose a shape');
    shapePicker.append(shapeSummary);
    shapes.parentElement.append(shapePicker);
    shapePicker.append(shapes);
    const create=section('nm-insert-create','Disegno','Drawing');
    create.className='nm-insert-drawing';
    const drawingOpen=launcher.querySelector('#nm-drawing-open');
    if(drawingOpen)create.append(insertTool(drawingOpen,'Disegna','Draw','M4 20l3-7L18 2l4 4L11 17Zm3-7 4 4M4 20l7-3','Apri gli strumenti di disegno','Open the drawing tools'));
    panel.append(shortcuts);
    // Compact, UI-only recently used actions and optional favorites. Actions
    // forward to the existing controls; there is no second implementation.
    const recentKey="nm.insert.recent.v1",pinnedKey="nm.insert.pinned.v1";
    const safeList=(key)=>{
      try {
        const value=JSON.parse(localStorage.getItem(key)||"[]");
        return Array.isArray(value)?value.filter(x=>typeof x==="string").slice(0,12):[];
      } catch (_) { return []; }
    };
    let recent=safeList(recentKey),pinned=safeList(pinnedKey);
    const supported=id=>id==="nm-insert-image"||id==="nm-insert-wordart"||
      id==="nm-insert-chart"||id==="btn-illustrate"||
      (id.startsWith("nm-insert-shape-")&&!!document.getElementById(id)?.dataset.glShape);
    const persistList=(key,value)=>{
      try{localStorage.setItem(key,JSON.stringify(value))}catch(_){}
    };
    function renderShortcuts(){
      shortcutsGrid.replaceChildren();
      const ids=[...new Set([...pinned,...recent])].filter(id=>supported(id)&&document.getElementById(id)).slice(0,6);
      shortcuts.hidden=true;
      shortcuts.style.display="none";
      shortcutsTitle.textContent=tr("Preferiti e recenti","Favorites and recent");
      for(const id of ids){
        const target=document.getElementById(id);
        const name=(target.getAttribute("aria-label")||target.textContent||id).trim().slice(0,65);
        const line=document.createElement("div");
        line.className="nm-insert-shortcut";
        const launch=document.createElement("button");launch.type="button";
        launch.className="nm-insert-shortcut-run";
        launch.textContent=name;
        launch.setAttribute("aria-label",tr("Ripeti: ","Repeat: ")+name);
        launch.addEventListener("click",()=>target.click());
        const pin=document.createElement("button");pin.type="button";
        pin.className="nm-insert-shortcut-pin";
        pin.textContent=pinned.includes(id)?"★":"☆";
        pin.setAttribute("aria-pressed",String(pinned.includes(id)));
        pin.setAttribute("aria-label",pinned.includes(id)?
          tr("Rimuovi dai preferiti: ","Unpin favorite: ")+name:
          tr("Aggiungi ai preferiti: ","Pin favorite: ")+name);
        pin.addEventListener("click",()=>{
          pinned=pinned.includes(id)?pinned.filter(x=>x!==id):[id,...pinned].slice(0,6);
          persistList(pinnedKey,pinned);renderShortcuts();
        });
        line.append(launch,pin);shortcutsGrid.append(line);
      }
    }
    panel.addEventListener("click",event=>{
      const button=event.target?.closest?.("button[id]");
      const id=button?.id||"";
      if(!id||!supported(id))return;
      recent=[id,...recent.filter(x=>x!==id)].slice(0,6);
      persistList(recentKey,recent);
      renderShortcuts();
    });
    root.NeuroMapWorkspaceLocale?.watch(renderShortcuts);
    launcher.hidden = true;
    document.body.append(panel);
    renderShortcuts();
    return panel;
  }
