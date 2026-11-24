  function mountTextLayout(app) {
    // bindUI can be called again after a tab/shell refresh: never duplicate
    // alignment, multiline controls, or move their buttons a second time.
    if (document.getElementById("nm-text-alignment")) return;
    const emphasis = document.getElementById("nm-text-emphasis"),
      font = document
        .getElementById("inspector-fontsize-slider")
        ?.closest(".inspector-section"),
      typesetting = document.getElementById("nm68-typesetting");
    const alignmentButtons = typesetting?.querySelector(".nm68-align-buttons");
    if (!emphasis || !font || !typesetting || !alignmentButtons) return;
    const caption = emphasis.previousElementSibling;
    if (caption?.classList.contains("inspector-control-row")) caption.remove();
    emphasis.classList.add("nm-text-toolbar");
    emphasis.setAttribute("role", "toolbar");
    emphasis.append(document.getElementById("nm-list-picker"));
    font.prepend(emphasis);
    // The Insert toolbox forwards to the existing canvas drawing system.
    // Text highlighter controls below remain in the inspector.
    if(!document.getElementById('nm-text-ink-tools')){
      const surface=document.createElement('section');surface.id='nm-text-ink-tools';
      surface.className='nm-text-block nm-text-ink-tools nm6-skiptranslate';
      const header=document.createElement('strong');
      root.NeuroMapWorkspaceLocale?.bind(header,'Evidenziatore','Highlighter');
      const tools=document.createElement('div');tools.className='nm-text-ink-row';
      const ink=[
        ['select','Seleziona','Select','M5 3v16l4-5 5 7 3-2-5-7 7-1Z'],
        ['pen','Penna','Pen','M4 20l3-7L18 2l4 4L11 17Zm3-7 4 4M4 20l7-3'],
        ['pencil','Matita','Pencil','M4 20l1-6L17 2l5 5L10 19Zm11-16 5 5M5 14l5 5'],
        ['lasso','Lazo','Lasso','M7 18C-1 15 2 4 11 4s14 10 5 14c-7 3-13-1-10-4 2-2 6 1 3 7'],
        ['eraser','Gomma','Eraser','m3 14 9-10 10 9-7 8H9Zm4-4 10 9M14 21h8'],
        ['highlight','Evidenziatore','Highlighter','m4 15 8-11 8 6-8 11H7Zm1-1 8 6M3 23h11']
      ];
      for(const [id,it,en,glyph] of ink){
        const b=document.createElement('button');b.id='nm-text-tool-'+id;b.type='button';
        insertTool(b,it,en,glyph);b.setAttribute('aria-pressed','false');
        b.addEventListener('click',()=>root.NeuroMapCreativeModules?.drawing?.drawingToolbar(app,id));
        tools.append(b);
      }
      surface.append(header);
      tools.id="nm-insert-ink-tools";
      tools.hidden=true;
      let inkPark=document.getElementById("nm-ink-park");
      if(!inkPark){
        inkPark=document.createElement("div");
        inkPark.id="nm-ink-park";
        inkPark.hidden=true;
        document.body.append(inkPark);
      }
      inkPark.append(tools);
      const lassoButton=tools.querySelector("#nm-text-tool-lasso svg");
      if(lassoButton)lassoButton.outerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="9.5" rx="7.5" ry="5.5" stroke-dasharray="3.2 2.4"/><circle cx="9.5" cy="15.2" r="2"/><path d="M8.1 16.7c-1.4 1.2-2.5 2.5-3.1 3.8"/></svg>';
      const strokeStyle=document.createElement('div');
      strokeStyle.id='nm-ink-style';
      strokeStyle.className='nm-ink-style nm6-skiptranslate';
      strokeStyle.hidden=true;
      const strokeTitle=document.createElement('strong');
      strokeTitle.id='nm-ink-style-title';
      const widths=document.createElement('div');
      widths.className='nm-ink-widths';
      widths.setAttribute('role','group');
      const applyWidth=(px)=>{
        const input=document.getElementById('nm-draw-stroke');
        if(input){input.value=String(px);input.dispatchEvent(new Event('input',{bubbles:true}));}
        if(app._nmDraw)app._nmDraw.eraserSize=px*3;
        widths.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.width)===px)));
      };
      for(const [px,it,en] of [[2,'Fine','Fine'],[4,'Medio','Medium'],[8,'Spesso','Thick'],[12,'Tratto','Bold']]){
        const choice=document.createElement('button');
        choice.type='button';choice.className='nm-ink-width';choice.dataset.width=String(px);
        choice.style.setProperty('--ink-dot',Math.max(4,px)+'px');
        root.NeuroMapWorkspaceLocale?.bind(choice,it+' · '+px+' px',en+' · '+px+' px','aria-label');
        choice.addEventListener('click',()=>applyWidth(px));
        widths.append(choice);
      }
      const colors=document.createElement('div');
      colors.className='nm-ink-colors';
      colors.setAttribute('role','group');
      for(const [color,it,en] of [['#1b1b27','Inchiostro','Ink'],['#6441df','Viola','Violet'],['#0f766e','Verde','Green'],['#b45309','Ambra','Amber'],['#be123c','Rosso','Red'],['#0369a1','Blu','Blue']]){
        const swatch=document.createElement('button');
        swatch.type='button';swatch.className='nm-ink-color';swatch.dataset.color=color;
        swatch.style.setProperty('--ink-color',color);
        root.NeuroMapWorkspaceLocale?.bind(swatch,it,en,'aria-label');
        swatch.addEventListener('click',()=>{
          const input=document.getElementById('nm-draw-color');
          if(input){input.value=color;input.dispatchEvent(new Event('input',{bubbles:true}));}
          colors.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button===swatch)));
        });
        colors.append(swatch);
      }
      strokeStyle.append(strokeTitle,widths,colors);
      tools.after(strokeStyle);
      const shades=document.createElement('div');shades.className='nm-text-highlight-row';
      const caption=document.createElement('small');
      root.NeuroMapWorkspaceLocale?.bind(caption,'Colore di evidenziazione','Text highlight color');
      const note=document.createElement('small');note.className='nm-text-highlight-help';
      root.NeuroMapWorkspaceLocale?.bind(note,'Colora le parole del nodo selezionato.','Color the words in the selected branch.');
      const picker=document.createElement('details');picker.className='nm-text-highlight-picker';
      picker.id='nm-text-highlight-picker';
      const summary=document.createElement('summary');summary.id='nm-text-highlight-trigger';
      const activeSample=document.createElement('span');activeSample.className='nm-highlighter-sample nm-highlighter-current';activeSample.textContent='Aa';
      const activeName=document.createElement('span');activeName.className='nm-text-highlight-active';
      root.NeuroMapWorkspaceLocale?.bind(activeName,'Scegli un colore','Choose a color');
      summary.append(activeSample,activeName);
      picker.append(summary);
      const choices=document.createElement('div');choices.className='nm-text-highlight-choices';
      const swatches=[
        ['#facc15','Giallo','Yellow'],['#86efac','Verde','Green'],
        ['#7dd3fc','Azzurro','Light blue'],['#fda4af','Rosa','Pink'],
        ['#c4b5fd','Viola','Violet']
      ];
      const update=color=>{
        const ids=app.state.selectedNodeIds?.length?app.state.selectedNodeIds:[app.state.selectedNodeId];
        const nodes=[...new Set(ids)].map(id=>app.state.findNode(id)).filter(Boolean);
        if(!nodes.length){
          app.showToast?.(document.documentElement.lang === 'en'
            ?'Select a branch first.':'Seleziona prima un ramo.','TESTO');
          return;
        }
        if(!nodes.every(n=>(n.fontHighlight||null)===(color||null))){
          app.state.pushHistory();
          nodes.forEach(n=>{if(color)n.fontHighlight=color;else delete n.fontHighlight});
          app.markChanged();app.requestRender?.();
        }
        activeSample.style.setProperty('--nm-highlighter-color',color||'#f1f5f9');
        activeName.textContent=color?(swatches.find(s=>s[0]===color)?.[document.documentElement.lang==='en'?2:1]||color)
          :(document.documentElement.lang==='en'?'No highlight':'Nessuna evidenziazione');
        choices.querySelectorAll('button[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===color)));
        picker.open=false;
      };
      for(const [color,it,en] of swatches){
        const b=document.createElement('button');b.type='button';b.className='nm-text-highlight-swatch';
        b.dataset.color=color;b.setAttribute('aria-pressed','false');
        root.NeuroMapWorkspaceLocale?.bind(b,'Evidenzia '+it,'Highlight '+en,'aria-label');
        const sample=document.createElement('span');sample.className='nm-highlighter-sample';sample.textContent='Aa';
        sample.style.setProperty('--nm-highlighter-color',color);
        const label=document.createElement('span');root.NeuroMapWorkspaceLocale?.bind(label,it,en);
        b.append(sample,label);
        b.addEventListener('click',()=>update(color));choices.append(b);
      }
      const clear=document.createElement('button');clear.type='button';clear.className='nm-text-highlight-clear';
      root.NeuroMapWorkspaceLocale?.bind(clear,'Nessun colore','No color');
      clear.addEventListener('click',()=>update(null));
      choices.append(clear);
      picker.append(choices);
      picker.addEventListener('toggle',()=>{
        if(!picker.open)return;
        const ids=app.state.selectedNodeIds?.length?app.state.selectedNodeIds:[app.state.selectedNodeId];
        const nodes=[...new Set(ids)].map(id=>app.state.findNode(id)).filter(Boolean);
        const current=nodes.length&&nodes.every(n=>n.fontHighlight===nodes[0].fontHighlight)
          ?nodes[0].fontHighlight:null;
        const entry=swatches.find(row=>row[0]===current);
        activeSample.style.setProperty('--nm-highlighter-color',current||'#f1f5f9');
        activeName.textContent=entry?entry[document.documentElement.lang==='en'?2:1]:
          (document.documentElement.lang==='en'?'Choose a color':'Scegli un colore');
        choices.querySelectorAll('button[data-color]').forEach(b=>
          b.setAttribute('aria-pressed',String(b.dataset.color===current)));
      });
      shades.append(caption,note,picker);surface.append(shades);font.append(surface);
    }
    const alignment = document.createElement("section");
    alignment.id = "nm-text-alignment";
    alignment.className = "nm-text-block nm6-skiptranslate";
    const title = document.createElement("strong"),
      buttons = alignmentButtons;
    buttons.setAttribute("role","group");
    root.NeuroMapWorkspaceLocale?.bind(buttons,
      "Allineamento del testo","Text alignment","aria-label");
    alignment.append(title, buttons);
    font.append(alignment);
    const multiline = document.createElement("details");
    multiline.id = "nm-text-multiline";
    multiline.className = "nm-text-block nm6-skiptranslate";
    const summary = document.createElement("summary");
    multiline.append(summary);
    const wrap = document.getElementById("nm54-wrap-properties");
    if (wrap) multiline.append(wrap);
    const indent = document.getElementById("nm68-text-indent"),
      row = indent?.closest(".nm-setting-control");
    if (row) multiline.append(row);
    const hint = document.createElement("small");
    hint.id = "nm-indent-help";
    multiline.append(hint);
    font.append(multiline);
    typesetting.hidden = true;
    const bind = (el, it, en, attr) => {
      if (el) root.NeuroMapWorkspaceLocale?.bind(el, it, en, attr);
    };
    bind(title, "Allineamento", "Alignment");
    bind(summary, "Testo su più righe", "Multiline text");
    bind(
      hint,
      "Il rientro sposta solo le righe dopo la prima, dentro il nodo. Non sposta i rami.",
      "Indent moves only the lines after the first, inside the node. It does not move branches.",
    );
    bind(
      row?.querySelector("label span"),
      "Rientro dopo la prima riga",
      "Indent after the first line",
    );
    bind(
      indent,
      "Rientro dopo la prima riga",
      "Indent after the first line",
      "aria-label",
    );
    const alignSvgs = {
      left: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg>',
      center: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg>',
      right: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M10 10h10M4 14h16M10 18h10"/></svg>',
    };
    for (const b of buttons.querySelectorAll("button")) {
      const alignType = b.dataset.nm68Align;
      if (alignSvgs[alignType] && !b.querySelector("svg")) {
        const span = b.querySelector("span");
        b.innerHTML = alignSvgs[alignType] + (span ? span.outerHTML : "");
      }
      const pair = {
        left: ["Allinea a sinistra", "Align left"],
        center: ["Centra il testo", "Center text"],
        right: ["Allinea a destra", "Align right"],
      }[alignType];
      if (pair) {
        root.NeuroMapWorkspaceLocale?.bind(b, ...pair, "aria-label");
        const setTip = () => { b.title = tr(pair[0], pair[1]); };
        setTip();
        root.NeuroMapWorkspaceLocale?.watch(setTip);
      }
    }
    const label = font
      .closest(".nm70-inspector-accordion")
      ?.querySelector("summary [data-it]");
    bind(label, "Testo dei nodi", "Node text");
  }
