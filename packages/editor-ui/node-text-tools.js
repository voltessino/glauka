/* Compact word-processor controls; existing scope/undo/save transactions own edits. */
(function (root) {
  "use strict";
  function install(App) {
    const bind = App.prototype.bindUI;
    App.prototype.bindUI = function (...args) {
      const result = bind.apply(this, args);
      mount(this);
      return result;
    };
  }
  function mount(app) {
    const emphasis = document.getElementById("nm-text-emphasis"),
      slider = document.getElementById("inspector-fontsize-slider");
    if (!emphasis || !slider || document.getElementById("glauka-font-family"))
      return;
    const row = document.createElement("div");
    row.className = "glauka-font-row nm6-skiptranslate";
    const family = document.createElement("select");
    family.id = "glauka-font-family";
    for (const name of root.GlaukaNodeText.FONTS) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      family.append(option);
    }
    const size = document.createElement("input");
    size.id = "glauka-font-size";
    size.type = "number";
    size.min = 9;
    size.max = 48;
    size.step = 0.5;
    size.placeholder = "Auto";
    row.append(family, size);
    emphasis.before(row);
    // Branch labels are unboxed by default. Shape is a real node property,
    // so the user's choice participates in Undo and document persistence.
    const shapeRow=document.createElement("label");
    shapeRow.className="glauka-node-shape-row nm6-skiptranslate";
    const shapeTitle=document.createElement("span");
    const shape=document.createElement("select");
    shape.id="glauka-node-shape";
    for(const [key,it,en] of [
      ["plain","Senza contorno","No border"],
      ["card","Riquadro","Card"],
      ["pill","Pillola","Pill"],
      ["outline","Solo bordo","Outline"],
      ["glass","Vetro","Glass"],
      ["hex","Esagono","Hexagon"],
      ["circuit","Circuito","Circuit"]
    ]){
      const opt=document.createElement("option");opt.value=key;
      opt.dataset.it=it;opt.dataset.en=en;shape.append(opt);
    }
    shapeRow.append(shapeTitle,shape);
    row.after(shapeRow);
    slider.hidden = true;
    document
      .getElementById("inspector-fontsize-val")
      ?.closest(".inspector-control-row")
      ?.setAttribute("hidden", "");
    const color = document.createElement("input");
    color.id = "glauka-font-color";
    color.type = "color";
    const colorLabel = document.createElement("label");
    colorLabel.className = "glauka-text-color";
    colorLabel.append(document.createTextNode("A"), color);
    // Barrato joins the compact G|C|S segment; Auto/Pulisci stay as micro-actions.
    const strike = document.createElement("button");
    strike.id = "glauka-font-strike";
    strike.type = "button";
    strike.className = "glauka-text-strike";
    strike.textContent = "S\u0336";
    const underline = document.getElementById("nm-text-underline");
    if (underline) underline.after(strike);
    else emphasis.append(strike);
    emphasis.append(colorLabel);
    const actions = document.createElement("div");
    actions.className = "glauka-text-actions nm6-skiptranslate";
    actions.id = "glauka-text-actions";
    const resetColor = document.createElement("button"),
      clear = document.createElement("button");
    resetColor.type = clear.type = "button";
    resetColor.className = "glauka-text-action";
    clear.className = "glauka-text-action";
    resetColor.id = "glauka-font-auto-color";
    clear.id = "glauka-font-clear";
    const automaticListLabel=document.createElement('label');
    automaticListLabel.className='glauka-text-auto-lists';
    const automaticListCheck=document.createElement('input'),automaticListText=document.createElement('span');
    automaticListCheck.type='checkbox';automaticListCheck.id='glauka-automatic-lists';
    automaticListCheck.checked=root.NeuroMapCaption.automaticListsEnabled();
    automaticListCheck.addEventListener('change',()=>root.NeuroMapCaption.setAutomaticLists(automaticListCheck.checked));
    automaticListLabel.append(automaticListCheck,automaticListText);
    actions.append(resetColor, clear, automaticListLabel);
    emphasis.after(actions);
    const reset=document.getElementById("v5-font-reset");
    if(reset){
      reset.classList.add("glauka-text-reset");
      actions.after(reset);
    }
    let lists, alignment;
    const selected = () =>
      app.nm70ScopeNodes?.() ||
      [app.state.findNode(app.state.selectedNodeId)].filter(Boolean);
    const apply = (key, value) => {
      if (app.nmSettingsApplyNode) app.nmSettingsApplyNode(key, value);
      else {
        app.state.pushHistory();
        selected().forEach((n) => (n[key] = value));
        app.markChanged();
      }
      refresh();
    };
    family.addEventListener("change", () => apply("fontFamily", family.value));
    shape.addEventListener("change",()=>{
      if(selected().length)apply("nodeShape",shape.value);
    });
    size.addEventListener("change", () => {
      const value = size.value === "" ? null : Number(size.value);
      if (
        value === null ||
        (Number.isFinite(value) && value >= 9 && value <= 48)
      )
        apply("fontSize", value);
      else refresh();
    });
    color.addEventListener("change", () => apply("fontColor", color.value));
    strike.addEventListener("click", () => {
      apply("fontStrike", !selected().every((n) => n.fontStrike));
    });
    resetColor.addEventListener("click", () => {
      apply("fontColor", null);
    });
    clear.addEventListener("click", () => {
      const wipe = (n) => {
        for (const key of [
          "fontFamily",
          "fontSize",
          "fontColor",
          "fontWeight",
          "fontItalic",
          "fontUnderline",
          "fontStrike",
        ])
          delete n[key];
      };
      if (app.nm70BatchStyle) app.nm70BatchStyle("font-style", wipe);
      else {
        app.state.pushHistory();
        selected().forEach(wipe);
        app.markChanged();
      }
      refresh();
    });
    if (root.GlaukaMobile) {
      const section = emphasis.closest(".inspector-section");
      const header = section.firstElementChild;
      header.after(row, emphasis, actions);
      if(reset)actions.after(reset);
      slider.parentElement === section && (slider.hidden = true);
      // The emphasis controls are created before this toolbar by creative-settings.
      for (const el of section.querySelectorAll(".inspector-control-row"))
        if (el.textContent.trim() === "Stile del carattere") el.hidden = true;
      const paragraph = document.createElement("div");
      paragraph.className = "glauka-paragraph-row";
      lists = document.createElement("select"); lists.id = "glauka-list-style";
      for (const [value,label] of [["none","Senza elenco"],["disc","• Punti"],["circle","○ Cerchi"],["square","▪ Quadrati"],["dash","– Trattini"],["number","1. Numeri"],["letter","a. Lettere"],["roman","i. Romani"]]) {
        const option = document.createElement("option");option.value=value;option.textContent=label;lists.append(option);
      }
      lists.setAttribute("aria-label", "Tipo di elenco");
      lists.addEventListener("change", () => {
        const kind=lists.value;
        app.nm70BatchStyle("font-style", n => {
          n.text = root.NeuroMapCaption.list({text:String(n.text||""),spans:[]},kind).text;
        });
        refresh();
      });
      alignment = document.createElement("select");alignment.id="glauka-text-align";
      for (const [value,label] of [["left","Allinea a sinistra"],["center","Centra il testo"],["right","Allinea a destra"]]) {
        const option = document.createElement("option");option.value=value;option.textContent=label;alignment.append(option);
      }
      alignment.setAttribute("aria-label", "Allineamento del testo");
      alignment.addEventListener("change",()=>apply("labelAlign",alignment.value));
      paragraph.append(lists,alignment);actions.after(paragraph);paragraph.after(shapeRow);
      const sizes = document.createElement("datalist");sizes.id="glauka-font-sizes";
      for (const n of [9,10,11,12,14,16,18,20,24,28,32,40,48]) {
        const option=document.createElement("option");option.value=n;sizes.append(option);
      }
      row.append(sizes);size.setAttribute("list",sizes.id);
      const wrap=document.getElementById("nm54-wrap-properties");
      if(wrap){const fold=document.createElement("details");fold.className="glauka-text-wrapping";
        const title=document.createElement("summary");title.textContent="Testo su più righe";
        wrap.before(fold);fold.append(title,wrap);}
    }
    const translate = () => {
      const en = document.documentElement.lang === "en";
      automaticListText.textContent=globalThis.GlaukaI18n?.pair("Continua gli elenchi con Invio","Continue lists with Enter")||(en?"Continue lists with Enter":"Continua gli elenchi con Invio");
      family.setAttribute("aria-label", en ? "Font family" : "Carattere");
      shapeTitle.textContent=globalThis.GlaukaI18n?.pair("Contorno del testo","Text outline") || (en?"Text outline":"Contorno del testo");
      shape.setAttribute("aria-label",globalThis.GlaukaI18n?.pair("Forma del testo sul ramo","Branch label shape") || (en?"Branch label shape":"Forma del testo sul ramo"));
      for(const opt of shape.options)opt.textContent=globalThis.GlaukaI18n?.pair(opt.dataset.it,opt.dataset.en) || (en?opt.dataset.en:opt.dataset.it);
      size.setAttribute(
        "aria-label",
        (globalThis.GlaukaI18n?.pair("Dimensione del testo","Font size")??(en ? "Font size" : "Dimensione del testo")),
      );
      color.setAttribute("aria-label", (globalThis.GlaukaI18n?.pair("Colore del testo","Text color")??(en ? "Text color" : "Colore del testo")));
      colorLabel.title = (globalThis.GlaukaI18n?.pair("Colore del testo","Text color")??(en ? "Text color" : "Colore del testo"));
      strike.textContent = "S\u0336";
      strike.title = (globalThis.GlaukaI18n?.pair("Barrato","Strikethrough")??(en ? "Strikethrough" : "Barrato"));
      strike.setAttribute("aria-label", strike.title);
      const actionLabel = (button, svg, text) => {
        button.textContent = "";
        const icon = document.createElement("span");
        icon.className = "glauka-text-action-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = svg;
        const label = document.createElement("span");
        label.textContent = text;
        button.append(icon, label);
      };
      const svgAttrs = 'viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
      actionLabel(resetColor, '<svg ' + svgAttrs + '><path d="M4 20 10 5l6 15M6.6 14h6.8"/><path d="M19 9a4 4 0 1 0 1 4M20 5v4h-4"/></svg>',
        globalThis.GlaukaI18n?.pair("Colore auto","Auto color")??(en ? "Auto color" : "Colore auto"));
      resetColor.title = (globalThis.GlaukaI18n?.pair("Colore automatico","Automatic color")??(en ? "Automatic color" : "Colore automatico"));
      resetColor.setAttribute("aria-label", resetColor.title);
      actionLabel(clear, '<svg ' + svgAttrs + '><path d="M4 7V5h12v2M10 5v11M8 16h4"/><path d="m15 14 5 5m0-5-5 5"/></svg>',
        globalThis.GlaukaI18n?.pair("Pulisci","Clear")??(en ? "Clear" : "Pulisci"));
      clear.title = (globalThis.GlaukaI18n?.pair("Cancella formattazione","Clear formatting")??(en ? "Clear formatting" : "Cancella formattazione"));
      clear.setAttribute("aria-label", clear.title);
    };
    function refresh() {
      const nodes = selected(),
        n = nodes[0];
      if (!n) return;
      if (lists) lists.value = root.NeuroMapCaption.listKind(n.text) === "mixed" ? "none" : root.NeuroMapCaption.listKind(n.text);
      if (alignment) alignment.value = n.labelAlign || "center";
      family.value = root.GlaukaNodeText.family(n);
      shape.value=["card","pill","outline","glass","hex","circuit"].includes(n.nodeShape)?
        n.nodeShape:"plain";
      size.value = n.fontSize ?? "";
      color.value = root.GlaukaNodeText.color(n) || "#6441df";
      colorLabel.style.setProperty(
        "--glauka-text-color",
        root.GlaukaNodeText.color(n) || "var(--nm-theme-focus)",
      );
      strike.setAttribute(
        "aria-pressed",
        String(nodes.every((n) => n.fontStrike)),
      );
      automaticListCheck.checked=root.NeuroMapCaption.automaticListsEnabled();
    }
    const previous = app.nmFormatRefresh;
    app.nmFormatRefresh = function (...args) {
      previous?.apply(this, args);
      refresh();
    };
    new MutationObserver(translate).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    translate();
    refresh();
  }
  root.GlaukaTextTools = { install };
})(globalThis);
