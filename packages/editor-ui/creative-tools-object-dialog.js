  function objectDialog(app, hostDialog = null){
    const d=hostDialog||dialog(app,'nm-object-art-dialog','Illustrazioni','Illustrations');
    const selectedNode=()=>app.state.findNode(app.state.selectedNodeId)||app.state.root;
    const node=selectedNode();
    const target=document.createElement('select');target.id='nm-object-art-target';
    function refreshTargetOptions(preferred=target.value){
      const current=selectedNode();
      target.replaceChildren();
      const rootOption=document.createElement('option');rootOption.value='root';
      rootOption.textContent=tr('Nucleo centrale','Central topic');target.append(rootOption);
      if(current.id!==app.state.root.id){
        const option=document.createElement('option');option.value='node';
        option.textContent=tr('Ramo selezionato','Selected branch')+' · '+String(current.text||'').slice(0,48);
        target.append(option);
      }
      target.value=(preferred==='node'&&current.id!==app.state.root.id)?'node':'root';
    }
    refreshTargetOptions(node.id===app.state.root.id?'root':'node');
    target.setAttribute('aria-label',tr('Dove applicare l’oggetto','Object location'));
    const chooser=document.createElement('label');
    chooser.className='nm-object-art-field';
    const choosertitle=document.createElement('strong');
    choosertitle.textContent=tr('Destinazione','Destination');
    chooser.append(choosertitle,target);
    const grid=document.createElement('div');grid.id='nm-object-art-grid';
    grid.setAttribute('role','group');
    grid.setAttribute('aria-label',tr('Catalogo vettoriale','Vector catalogue'));
    const filters=document.createElement('div');
    filters.id='nm-object-art-filters';
    filters.setAttribute('role','group');
    filters.setAttribute('aria-label',tr('Filtra gli oggetti','Filter objects'));
    let category='all',visibleLimit=24;
    const search=document.createElement('input');
    search.id='nm-object-art-search';search.type='search';search.maxLength=80;
    search.placeholder=tr('Cerca tra gli oggetti…','Search objects…');
    search.setAttribute('aria-label',tr('Cerca oggetti illustrati','Search illustrated objects'));
    const normalize=s=>String(s||'').toLocaleLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'').trim();
    function matching(){
      const term=normalize(search.value);
      return core.OBJECTS.filter(asset=>{
        if(category==='new'?!(asset.id.startsWith('gl-')||asset.id.startsWith('lc-')):(category!=='all'&&asset.category!==category))return false;
        return !term||normalize([asset.it,asset.en,asset.id,asset.keywords||''].join(' ')).includes(term);
      });
    }
    function setCategory(value){
      category=value;visibleLimit=24;
      for(const b of filters.querySelectorAll('button'))
        b.setAttribute('aria-pressed',String(b.dataset.category===value));
      renderGrid();
    }
    for(const [value,it,en] of [
      ['all','Tutti','All'],['new','Nuovi SVG ✦','New SVG ✦'],['heritage','Decorativi','Decorative'],
      ['anatomy','Anatomia','Anatomy'],['medical','Medicina','Medical'],
      ['objects','Oggetti','Objects'],['food','Alimentazione','Food'],
      ['movement','Movimento','Movement'],['ideas','Scienza e idee','Science & ideas'],
      ['places','Luoghi','Places'],['work','Studio e lavoro','Study and work'],['technology','Tecnologia','Technology']
    ]){
      const filter=document.createElement('button');filter.type='button';
      filter.dataset.category=value;filter.textContent=tr(it,en);
      filter.addEventListener('click',()=>setCategory(value));
      filters.append(filter);
    }
    const preview=document.createElement('div');preview.id='nm-object-art-preview';
    const heading=document.createElement('strong');
    const source=document.createElement('small');source.className='nm-object-art-source';
    preview.append(heading,source);
    let chosen=node.objectArt?.id||'scroll',chosenExplicit=false;
    const current=(id)=>core.OBJECTS.find(item=>item.id===id);
    const sizeLabel=document.createElement('label');
    sizeLabel.className='nm-object-art-field';
    const sizeTitle=document.createElement('strong');
    sizeTitle.textContent=tr('Dimensione dell’oggetto','Object size');
    const size=document.createElement('input');size.type='range';
    size.id='nm-object-art-size';size.min='64';size.max='220';size.step='2';
    const sizeValue=document.createElement('output');
    sizeLabel.append(sizeTitle,size,sizeValue);
    function activeNode(){
      return target.value==='root'?app.state.root:selectedNode();
    }
    function syncTarget(){
      refreshTargetOptions(target.value||'node');
      const existing=core.objectArt(activeNode()?.objectArt);
      const defaultSize=target.value==='root'?180:100;
      size.value=String(existing?.size||defaultSize);
      update();
    }
    function update(){
      const appliedId=activeNode()?.objectArt?.id;
      const entry=current(appliedId);
      // The catalogue already shows each illustration. Only describe the real
      // applied object here; browsing must never preview an unrelated default.
      preview.hidden=!entry;
      sizeLabel.hidden=!entry;
      size.disabled=!entry;
      if(entry){
        heading.textContent=tr('Aggiunto alla mappa','Added to map')+' · '+tr(entry.it,entry.en);
        source.textContent=entry.source?.startsWith('flat/')
          ? tr('Illustrazione a colori · Icons8 · MIT · Offline.','Color illustration · Icons8 · MIT · Offline.')
          : entry.source?.startsWith('lucide/')
          ? tr('Icona Lucide · ISC/MIT · Disponibile offline.',
               'Lucide icon · ISC/MIT · Available offline.')
          : entry.source?.startsWith('glauka/')
          ? tr('Disegno SVG originale Glauka · Disponibile offline.',
               'Original Glauka SVG artwork · Available offline.')
          : entry.source?.startsWith('symbols/')||entry.category==='anatomy'
          ? tr('Icona vettoriale schematica · Health Icons CC0 · Disponibile offline.',
               'Schematic vector icon · Health Icons CC0 · Available offline.')
          : tr('Disegno vettoriale · Disponibile offline.',
               'Vector artwork · Available offline.');
      }
      sizeValue.textContent=size.value+' px';
      for(const b of grid.querySelectorAll('button')){
        const applied=b.dataset.asset===appliedId;
        b.setAttribute('aria-pressed',String(applied));
        b.dataset.preview=String(b.dataset.asset===chosen);
        appliedBadge(b,applied);
      }
    }
    const feedback=document.createElement('p');feedback.className='nm-creative-library-feedback';feedback.setAttribute('role','status');
    const count=document.createElement('small');count.id='nm-object-art-count';
    const more=button('nm-object-art-more','Mostra altri','Show more',()=>{
      visibleLimit+=24;renderGrid();
    });
    function renderGrid(){
      const matches=matching();
      if(matches.length&&!matches.some(a=>a.id===chosen)){chosen=matches[0].id;chosenExplicit=false;}
      if(!matches.length){chosen='';chosenExplicit=false;}
      const wanted=matches.slice(0,visibleLimit);
      const existing=[...grid.querySelectorAll(':scope>.nm-object-art-card')];
      const samePrefix=existing.length<=wanted.length&&existing.every((card,i)=>card.dataset.asset===wanted[i].id);
      if(!samePrefix){grid.replaceChildren();existing.length=0;}
      for(const asset of wanted.slice(existing.length)){
        const b=document.createElement('button');b.type='button';
        b.className='nm-object-art-card';b.dataset.asset=asset.id;
        const img=document.createElement('img');img.alt='';img.loading='lazy';
        img.decoding='async';img.src=core.objectURL(asset.id);
        const label=document.createElement('span');label.textContent=tr(asset.it,asset.en);
        b.append(img,label);
        b.addEventListener('click',()=>{chosen=asset.id;chosenExplicit=true;update();if(applySelection())update();});
        grid.append(b);
      }
      if(!matches.length){
        const empty=document.createElement('p');empty.className='nm-object-art-empty';
        empty.textContent=tr('Nessun oggetto trovato. Prova un termine diverso.',
          'No objects found. Try another search.');
        grid.append(empty);
      }
      count.textContent=tr('Visualizzati ','Showing ')+Math.min(matches.length,visibleLimit)+
        ' / '+matches.length;
      more.hidden=matches.length<=visibleLimit;
      more.textContent=tr('Mostra altri','Show more')+
        ' ('+Math.min(24,Math.max(0,matches.length-visibleLimit))+')';
      update();
    }
    search.addEventListener('input',()=>{visibleLimit=24;renderGrid()});
    setCategory(node.objectArt ? (core.OBJECTS.find(x=>x.id===chosen)?.category||'all') : 'all');
    target.addEventListener('change',()=>{chosenExplicit=false;syncTarget();});
    size.addEventListener('input',()=>{update();});
    size.addEventListener('change',()=>{if((chosenExplicit||activeNode()?.objectArt?.id===chosen)&&applySelection())update();});
    let changeOwner=null,undoTop=null,lastDestination=null,lastApplied=null;
    function applySelection(){
      if(!d.valid())return false;
      const destination=activeNode();if(!destination)return false;
      const next=core.objectArt({id:chosen,size:Number(size.value)});
      if(!next)return false;
      if(JSON.stringify(core.objectArt(destination.objectArt))!==JSON.stringify(next)){
        const sameChange=changeOwner===app.state && lastDestination===destination &&
          undoTop===app.state.undoStack.at(-1) && JSON.stringify(core.objectArt(destination.objectArt))===lastApplied;
        if(!sameChange)app.state.pushHistory();
        changeOwner=app.state;undoTop=app.state.undoStack.at(-1);lastDestination=destination;
        destination.objectArt=next;lastApplied=JSON.stringify(next);app.markChanged();
        app.selectNode(destination.id);
      }
      feedback.textContent=tr('Aggiunto alla mappa','Added to map')+' · '+tr(current(chosen).it,current(chosen).en);
      return true;
    }
    const controls=document.createElement('div');controls.className='nm-object-art-actions';
    const apply=button('nm-object-art-apply','Fatto','Done',()=>{
      if(chosenExplicit||activeNode()?.objectArt?.id===chosen){if(applySelection())d.close();}
      else d.close();
    });
    const remove=button('nm-object-art-remove','Ripristina nodo classico','Restore classic topic',()=>{
      if(!d.valid())return;
      const destination=activeNode();if(!destination?.objectArt)return;
      app.state.pushHistory();destination.objectArt=null;app.markChanged();
      app.selectNode(destination.id);d.close();
    });
    controls.append(remove,apply);
    const hint=document.createElement('p');hint.className='nm-creative-library-hint';
    hint.textContent=tr('Tocca un oggetto per applicarlo. Riduci il pannello per vedere la mappa.', 'Tap an object to apply it. Minimize the panel to see the map.');
    d.panel.append(chooser,hint,feedback,filters,search,count,grid,more,preview,sizeLabel,controls);
    (d.panel.closest('[role=dialog]')||d.panel)._nmOnExpand=()=>{if(d.valid())update();};
    syncTarget();
    if(!hostDialog){
      const restoreSelection=watchSelection(app,()=>{if(d.valid())syncTarget();});
      const closeDialog=d.close;
      d.close=()=>{restoreSelection();closeDialog();};
    }
    return syncTarget;
  }
  // One modal for node markers, emoji illustrations, vector objects and
  // personal graphics. All legacy project formats and editor actions remain.
