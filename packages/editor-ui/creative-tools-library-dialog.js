  function creativeLibraryDialog(app, initial = 'symbols') {
    const insertPanel=document.getElementById('nm-insert-panel');
    const reopenInsert=!!insertPanel&&!insertPanel.hidden;
    if(root.NeuroMapWorkspaceLayout?.claim?.(app,'markers')===false)return null;
    // Prevent an old-version picker or contextual shortcut from stacking
    // over the new four-tab library.
    const legacy=document.getElementById('nm62-assets');
    if(legacy&&!legacy.classList.contains('hidden'))app.nm62CloseAssets?.();
    const d = dialog(app, 'nm-creative-library-hub', 'Libreria creativa', 'Creative library',{
      dock:true,
      onClose:()=>{
        const insert=document.getElementById('nm-insert-panel');
        if(reopenInsert&&insert&&!document.getElementById('nm-creative-library-hub')){
          insert.hidden=false;
          document.getElementById('nm-open-insert')?.setAttribute('aria-expanded','true');
        }
      }
    });
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const makeSvgIcon = (paths, size = 15) => {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', String(size));
      svg.setAttribute('height', String(size));
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.9');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      for (const [tag, attrs] of paths) {
        const el = document.createElementNS(SVG_NS, tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        svg.append(el);
      }
      return svg;
    };
    const TAB_ICONS = {
      symbols: [['circle', { cx: '12', cy: '12', r: '8' }], ['path', { d: 'm9.5 12 2 2 3.5-4' }]],
      shapes: [['rect', { x: '3', y: '3', width: '8', height: '8', rx: '2' }], ['circle', { cx: '16.5', cy: '16.5', r: '4.5' }], ['path', { d: 'm14 5 6 3-3 6' }]],
      icons: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M8 14s1.5 2 4 2 4-2 4-2' }], ['line', { x1: '9', y1: '9', x2: '9.01', y2: '9' }], ['line', { x1: '15', y1: '9', x2: '15.01', y2: '9' }]],
      svg: [['rect', { x: '3', y: '4', width: '18', height: '16', rx: '2' }], ['circle', { cx: '8.5', cy: '9.5', r: '1.5' }], ['path', { d: 'm21 15-4.5-4.5L7 20' }]],
      personal: [['path', { d: 'm19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' }]],
    };
    const ai = document.createElement('button');
    ai.type = 'button';
    ai.id = 'gl-library-ai';
    ai.className = 'gl-library-ai-banner';
    const aiIconWrap = document.createElement('span');
    aiIconWrap.className = 'gl-library-ai-icon';
    aiIconWrap.setAttribute('aria-hidden', 'true');
    aiIconWrap.append(makeSvgIcon([['path', { d: 'm12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z' }], ['path', { d: 'M19 16v4m2-2h-4' }]], 16));
    const aiCopy = document.createElement('span');
    aiCopy.className = 'gl-library-ai-copy';
    const aiTitle = document.createElement('strong');
    aiTitle.dataset.glaukaUiPair = '';
    aiTitle.dataset.it = 'Illustra con AI';
    aiTitle.dataset.en = 'Illustrate with AI';
    aiTitle.textContent = tr('Illustra con AI', 'Illustrate with AI');
    const aiSub = document.createElement('small');
    aiSub.textContent = tr('Icone su misura per i rami', 'Tailored icons for branches');
    aiCopy.append(aiTitle, aiSub);
    const aiPill = document.createElement('span');
    aiPill.className = 'gl-library-ai-pill';
    aiPill.textContent = 'PRO';
    ai.append(aiIconWrap, aiCopy, aiPill);
    const libraryBody = d.panel.querySelector(':scope > .nm-panel-body') || d.panel;
    ai.addEventListener('click', () => { d.close(); root.GlaukaIllustrations.open(app); });
    libraryBody.append(ai);
    const tabs = document.createElement('div');
    tabs.id = 'nm-creative-library-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', tr('Tipi di elementi','Asset types'));
    const content = document.createElement('div');
    content.id = 'nm-creative-library-content';
    content.setAttribute('role','tabpanel');
    let tab = 'symbols';
    let refreshSelection = () => {};
    const restoreSelection = watchSelection(app, () => refreshSelection());
    const closeDialog = d.close;
    d.close = () => {
      restoreSelection();
      closeDialog();
    };
    // Explicit user intent: Unicode in editable text vs marker metadata.
    // The existing node.markers representation remains compatible with older maps.
    let symbolPlacement = 'text';
    const choices = [
      ['symbols','Simboli','Symbols'],
      ['shapes','Forme','Shapes'],
      ['icons','Icone','Icons'],
      ['svg','Illustrazioni','Illustrations'],
      ['personal','I miei','My items'],
    ];
    function selectedNode(){
      return app.state.findNode(app.state.selectedNodeId) || app.state.root;
    }
    function toggleInlineMarkerText(text, symbol) {
      const current=String(text||'');
      const prefix=symbol+' ';
      if(current===symbol)return '';
      if(current.startsWith(prefix))return current.slice(prefix.length);
      return symbol+(current?' '+current:'');
    }
    function catalogueTab(kind) {
      const n = selectedNode();
      const prompt = document.createElement('p');
      prompt.className = 'nm-creative-library-hint';
      prompt.textContent = kind === 'symbols'
        ? tr('Scegli dove inserire il simbolo: nella scritta oppure come distintivo esterno al ramo.',
             'Choose where to insert the symbol: in the topic text or as an external branch badge.')
        : tr('Icone illustrative applicate al nodo senza cambiarne il testo.',
             'Illustrative icons on the topic without changing its text.');
      if(kind==='symbols'){
        prompt.dataset.glaukaUiPair='';
        prompt.dataset.it='Scegli dove inserire il simbolo: nella scritta oppure come distintivo esterno al ramo.';
        prompt.dataset.en='Choose where to insert the symbol: in the topic text or as an external branch badge.';
      }
      const search = document.createElement('input');
      search.type = 'search';
      search.maxLength = 80;
      search.placeholder = tr('Cerca un elemento…','Search items…');
      search.setAttribute('aria-label',tr('Cerca nella libreria','Search the library'));
      const placement=document.createElement('div');
      placement.className='nm-creative-symbol-placement';
      placement.setAttribute('role','group');
      placement.dataset.glaukaUiPair='';
      placement.dataset.itLabel='Posizione del simbolo';
      placement.dataset.enLabel='Symbol placement';
      placement.setAttribute('aria-label',tr(placement.dataset.itLabel,placement.dataset.enLabel));
      if(kind==='symbols'){
        for(const [mode,it,en] of [
          ['text','Nel testo','In text'],
          ['badge','Sul ramo','On branch']
        ]){
          const option=document.createElement('button');
          option.type='button';
          option.dataset.placement=mode;
          option.dataset.glaukaUiPair='';
          option.dataset.it=it;option.dataset.en=en;
          option.textContent=tr(it,en);
          option.addEventListener('click',()=>{
            symbolPlacement=mode;
            for(const b of placement.querySelectorAll('button'))
              b.setAttribute('aria-pressed',String(b.dataset.placement===symbolPlacement));
            render();
          });
          option.setAttribute('aria-pressed',String(symbolPlacement===mode));
          placement.append(option);
        }
      }
      const status = document.createElement('small');
      status.className = 'nm-creative-library-status';
      const feedback=document.createElement('p');feedback.className='nm-creative-library-feedback';feedback.setAttribute('role','status');
      const grid = document.createElement('div');
      grid.className = 'nm-creative-library-glyphs';
      let entries = [];
      if (kind === 'symbols') {
        entries = (root.NeuroMapMarkers?.entries || []).map(entry=>({
          id:entry.id,symbol:entry.symbol,it:entry.it,en:entry.en
        }));
        // Keep the older Greek/mathematical-symbol picker available here too:
        // those characters edit node text rather than counting as markers.
        for(const symbol of "α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω Α Β Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω ± × ÷ ≠ ≈ ≤ ≥ ∞ √ ∑ ∫ ∂ ∇ ° → ↔ ∈ ∉ ∪ ∩ ∅ ℝ ℕ".split(" ")){
          entries.push({id:'char-'+symbol.codePointAt(0),symbol,it:symbol,en:symbol,textSymbol:true});
        }
      } else {
        for (const [group,items] of Object.entries(root.GlaukaLegacyGallery?.gallery || {}))
          for (const [id,symbol] of items){
            const label=core.OBJECTS.find(asset=>asset.id===id);
            entries.push({id,symbol,it:label?.it||id,en:label?.en||id,group});
          }
      }
      function render(){
        const query = search.value.trim().toLocaleLowerCase();
        grid.replaceChildren();
        const node = selectedNode();
        const iconLabel=entries.find(entry=>entry.id===node.illustration?.name);
        status.textContent = kind === 'symbols'
          ? symbolPlacement==='text'
            ? tr('Il simbolo comparirà nella scritta del nodo (es. ❷ Ciao).',
                 'The symbol will appear in the topic text (e.g. ❷ Hello).')
            : tr('Distintivi esterni selezionati: ','External badges selected: ')+(node.markers?.length||0)+'/3'
          : tr('Icona del nodo: ','Topic icon: ')+(iconLabel?tr(iconLabel.it,iconLabel.en):node.illustration?.name||tr('Nessuna','None'));
        if(kind==='symbols'){
          status.dataset.glaukaUiPair='';
          const count=(node.markers?.length||0)+'/3';
          status.dataset.it=symbolPlacement==='text'?'Il simbolo comparirà nella scritta del nodo (es. ❷ Ciao).':'Distintivi esterni selezionati: '+count;
          status.dataset.en=symbolPlacement==='text'?'The symbol will appear in the topic text (e.g. ❷ Hello).':'External badges selected: '+count;
        }
        const matched = entries.filter(e=>[e.id,e.it,e.en,e.group||'']
          .join(' ').toLocaleLowerCase().includes(query));
        let symbolGroup;
        for(const entry of matched){
          if(kind==='symbols'&&symbolGroup!==!!entry.textSymbol){
            symbolGroup=!!entry.textSymbol;
            const heading=document.createElement('h3');
            heading.className='nm-creative-symbols-heading';
            heading.setAttribute('data-glauka-ui-pair','');heading.dataset.it=symbolGroup?'Testo':'Marcatori';heading.dataset.en=symbolGroup?'Text':'Markers';
            heading.textContent=symbolGroup?tr('Testo','Text'):tr('Marcatori','Markers');
            grid.append(heading);
          }
          const item = document.createElement('button');
          item.type='button';
          item.className='nm-creative-library-glyph';
          if(kind==='symbols'&&!entry.textSymbol&&symbolPlacement==='badge')item.dataset.marker=entry.id;
          const isActive=kind==='symbols'
            ? (entry.textSymbol
              ? String(node.text||'').includes(entry.symbol)
              : symbolPlacement==='text'
                ? (String(node.text||'')===entry.symbol||String(node.text||'').startsWith(entry.symbol+' '))
                : node.markers?.includes(entry.id))
            : node.illustration?.name===entry.id;
          item.setAttribute('aria-pressed',String(!!isActive));
          item.setAttribute('data-glauka-ui-pair','');
          item.dataset.itLabel=entry.it;item.dataset.enLabel=entry.en;
          item.setAttribute('aria-label',tr(entry.it,entry.en));
          const glyph=document.createElement('span');glyph.className='nm-creative-library-glyph-icon';
          glyph.textContent=entry.symbol;
          const label=document.createElement('small');label.setAttribute('data-glauka-ui-pair','');
          label.dataset.it=entry.it;label.dataset.en=entry.en;
          label.textContent=tr(entry.it,entry.en);
          item.append(glyph,label);
          appliedBadge(item,isActive);
          item.addEventListener('click',()=>{
            if(!d.valid())return;
            const current=selectedNode();
            if(kind==='symbols'){
              if(entry.textSymbol){
                app.state.pushHistory();
                current.text=String(current.text||'')+entry.symbol;
              } else if(symbolPlacement==='text'){
                // Inline glyphs are real characters, editable/exportable with the topic.
                // Moving an already attached marker to text does not duplicate the badge.
                app.state.pushHistory();
                current.text=toggleInlineMarkerText(current.text,entry.symbol);
                current.markers=(current.markers||[]).filter(id=>id!==entry.id);
              } else {
                const markers=[...(current.markers||[])];
                const i=markers.indexOf(entry.id);
                if(i>=0)markers.splice(i,1);
                else if(markers.length<3)markers.push(entry.id);
                else{
                  app.showToast?.(tr('Massimo tre simboli di stato per nodo','Three status symbols per topic maximum'),'SIMBOLI');
                  return;
                }
                app.state.pushHistory();current.markers=markers;
              }
            } else {
              const vector=root.GlaukaLegacyGallery?.vector?.(entry.id,entry.symbol);
              if(!vector)return;
              app.state.pushHistory();
              current.illustration=vector;
            }
            const present=kind==='symbols'
              ? entry.textSymbol
                ? true
                : symbolPlacement==='text'
                  ? (String(current.text||'')===entry.symbol||String(current.text||'').startsWith(entry.symbol+' '))
                  : current.markers?.includes(entry.id)
              : true;
            feedback.textContent=(present?tr('Aggiunto alla mappa','Added to map'):tr('Rimosso dal nodo','Removed from topic'))+' · '+tr(entry.it,entry.en);
            app.markChanged();render();
            const next=[...grid.children].find(b=>b.getAttribute('aria-label')===tr(entry.it,entry.en));
            next?.focus({preventScroll:true});
          });
          grid.append(item);
        }
        if(!matched.length){
          const empty=document.createElement('p');
          empty.textContent=tr('Nessun elemento trovato.','No matching items.');
          grid.append(empty);
        }
      }
      search.addEventListener('input',render);
      const controlsBar=document.createElement('div');
      controlsBar.className='nm-creative-library-controls';
      if(kind==='symbols')controlsBar.append(placement,search);
      else controlsBar.append(search);
      const metaBar=document.createElement('div');
      metaBar.className='nm-creative-library-meta';
      metaBar.append(prompt,status);
      content.append(controlsBar,metaBar,feedback,grid);
      d.panel._nmOnExpand=()=>{if(d.valid())render();};
      refreshSelection=()=>{if(d.valid())render();};
      render();
      if (root.GlaukaMobile || root.matchMedia?.('(max-width: 720px)').matches) {
        document.getElementById('nm-creative-library-hub-close')?.focus({preventScroll:true});
      } else search.focus({preventScroll:true});
    }
    function shapesTab(){
      refreshSelection=()=>{};
      const intro=document.createElement('p');intro.className='nm-creative-library-hint';
      intro.textContent=tr('Forme vettoriali modificabili direttamente nella mappa.',
        'Editable vector shapes placed directly in your map.');
      const grid=document.createElement('div');grid.className='nm-creative-library-shapes';
      const categories=[
        ['Forme','Shapes',[
          ['rect','Rettangolo','Rectangle'],['roundrect','Arrotondato','Rounded'],
          ['ellipse','Ellisse','Ellipse'],['circle','Cerchio','Circle'],
          ['diamond','Rombo','Diamond'],['triangle','Triangolo','Triangle'],
          ['hexagon','Esagono','Hexagon'],['parallelogram','Parallelogramma','Parallelogram'],
          ['pill','Capsula','Capsule'],['cloud','Nuvola','Cloud'],
          ['speech','Fumetto','Speech bubble'],['star','Stella','Star']]],
        ['Linee e collegamenti','Lines and connectors',[
          ['line','Linea','Line'],['arrow','Freccia','Arrow'],
          ['double-arrow','Doppia freccia','Double arrow'],['dashed','Tratteggiata','Dashed'],
          ['curve','Curva','Curve'],['elbow','Ad angolo','Elbow']]]
      ];
      for(const [it,en,items] of categories){
        const title=document.createElement('h3');title.className='nm-creative-shapes-heading';
        title.textContent=tr(it,en);grid.append(title);
        for(const [tool,itLabel,enLabel] of items){
          const meta=core.graphic({kind:'shape',tool,color:'#a5b4fc',stroke:3,
            width:160,height:['line','arrow','dashed'].includes(tool)?76:96});
          const tile=document.createElement('button');tile.type='button';
          tile.className='nm-creative-shape-tile';tile.title=tr(itLabel,enLabel);
          tile.draggable=true;tile.dataset.glShape=tool;
          tile.setAttribute('aria-label',tr(itLabel,enLabel));
          const art=document.createElement('span');art.className='nm-creative-shape-svg';
          art.setAttribute('aria-hidden','true');art.innerHTML=core.shapeSVG(meta);
          const caption=document.createElement('small');caption.textContent=tr(itLabel,enLabel);
          tile.append(art,caption);
          tile.addEventListener('click',()=>{
            if(!d.valid())return;
            addGraphic(app,core.shapeSVG(meta),meta.width,meta.height,meta);
            tile.focus({preventScroll:true});
          });
          grid.append(tile);
        }
      }
      content.append(intro,grid);
    }
    function select(which){
      tab=choices.some(item=>item[0]===which)?which:'symbols';
      content.replaceChildren();
      for(const b of tabs.querySelectorAll('button'))
        b.setAttribute('aria-selected',String(b.dataset.tab===tab));
      content.setAttribute('aria-labelledby','nm-creative-tab-'+tab);
      const host={panel:content,close:d.close,valid:d.valid};
      if(tab==='svg'){
        const refresh=objectDialog(app,host);
        refreshSelection=()=>{if(d.valid())refresh?.();};
      }
      else if(tab==='personal'){
        refreshSelection=()=>{};
        libraryDialog(app,host);
      }
      else if(tab==='shapes')shapesTab();
      else catalogueTab(tab);
    }
    for(const [value,it,en] of choices){
      const b=document.createElement('button');
      b.type='button';
      b.id='nm-creative-tab-'+value;
      b.dataset.tab=value;
      b.setAttribute('role','tab');
      b.setAttribute('aria-controls',content.id);
      const iconWrap=document.createElement('span');
      iconWrap.className='nm-creative-tab-icon';
      iconWrap.setAttribute('aria-hidden','true');
      iconWrap.append(makeSvgIcon(TAB_ICONS[value]||TAB_ICONS.symbols,14));
      const lbl=document.createElement('span');
      lbl.className='nm-creative-tab-label';
      lbl.dataset.glaukaUiPair='';
      lbl.dataset.it=it;lbl.dataset.en=en;
      lbl.textContent=tr(it,en);
      b.append(iconWrap,lbl);
      b.addEventListener('click',()=>select(value));
      tabs.append(b);
    }
    libraryBody.append(tabs,content);
    select(initial);
    return d;
  }
  // A single validated drag channel shared by the Insert sheet and docked
  // library. SVGs are generated locally from a finite allowlist, never read
  // from untrusted drag payloads.
  const SHAPES=new Set([
    'rect','roundrect','ellipse','circle','diamond','triangle','hexagon',
    'parallelogram','pill','cloud','speech','star','line','arrow',
    'double-arrow','dashed','curve','elbow'
  ]);
