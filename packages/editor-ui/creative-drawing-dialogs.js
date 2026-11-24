  function chartDialog(app,image=null){
    const prior=image?.graphic?.kind==='chart'?core.graphic(image.graphic):null;
    const d=dialog(app,'nm-chart-dialog','Inserisci grafico · Dati','Insert chart · Data');
    d.panel.classList.add('nm-chart-editor');
    const make=(tag,cls='',value='')=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value)e.textContent=value;return e;};
    const h=(it,en)=>tr(it,en);
    let model=prior||core.graphic({kind:'chart',type:'column',title:h('Risultati','Results'),
      categories:['Gen','Feb','Mar','Apr'],series:[
      {name:h('Serie 1','Series 1'),values:[5,8,3,7]},{name:h('Serie 2','Series 2'),values:[4,2,6,5]}]});
    let activeType=model.type;
    // Editing an existing attachment must never silently retarget it to
    // the last-selected map node, which can be the root.
    const selectedNodeId=image?.mode==='attached'&&image.attachedNodeId
      ?image.attachedNodeId:app.state.selectedNodeId;
    const title=make('label','nm-chart-field'),titleInput=make('input');
    title.append(make('strong','',h('Titolo del grafico','Chart title')),titleInput);
    titleInput.id='nm-chart-title';titleInput.maxLength=120;titleInput.value=model.title;
    const subtitle=make('p','nm-chart-help',h('Sono dati di esempio. Scrivi nella tabella o incolla da Excel. I colori delle serie si cambiano accanto al nome.', 'These are example values. Edit the table or paste from Excel. Change series colors next to their names.'));
    const gallery=make('div','nm-chart-gallery');gallery.setAttribute('role','group');gallery.setAttribute('aria-label',h('Tipi di grafico','Chart types'));
    const kinds=[
      ['column','Colonne raggruppate','Clustered columns'],['column-stacked','Colonne in pila','Stacked columns'],
      ['bar','Barre raggruppate','Clustered bars'],['bar-stacked','Barre in pila','Stacked bars'],
      ['line','Linea','Line'],['area','Area','Area'],['pie','Torta','Pie'],['donut','Anello','Donut'],
      ['scatter','Dispersione','Scatter'],['bubble','Bolle','Bubble'],['radar','Radar','Radar'],
      ['combo','Combinato','Combo']
    ];
    const explanations={
      column:['Confronta più valori affiancati.','Compare values side by side.'],
      'column-stacked':['Mostra come più parti formano un totale.','Show how series form a total.'],
      bar:['Confronta categorie con barre orizzontali.','Compare categories using horizontal bars.'],
      'bar-stacked':['Confronta totali e componenti su barre orizzontali.','Compare totals and parts with horizontal bars.'],
      line:['Mostra come cambiano i dati nel tempo.','Show how values change over time.'],
      area:['Mostra un andamento evidenziando la superficie.','Show a trend with its area filled.'],
      pie:['Mostra le parti di un totale, con valori positivi.','Show positive parts of one total.'],
      donut:['Come la torta, ma con un vuoto centrale.','Like a pie chart, with a center hole.'],
      scatter:['Confronta valori su due assi. Usa numeri nelle categorie per l’asse X.','Compare X and Y. Enter numeric category values for X.'],
      bubble:['Come la dispersione: aggiungi anche la dimensione di ogni bolla.','Like a scatter plot, with a separate value for bubble size.'],
      radar:['Confronta più caratteristiche sullo stesso schema.','Compare several features on one diagram.'],
      combo:['Unisce colonne e linee per confrontare due serie.','Combine columns and lines across two series.']
    };
    const typeHelp=make('p','nm-chart-help');typeHelp.id='nm-chart-type-help';
    typeHelp.setAttribute('aria-live','polite');
    const paletteRow=make('div','nm-chart-palettes');
    const paletteCaption=make('strong','',h('Colori del grafico','Chart colors'));
    paletteRow.append(paletteCaption);
    const palettes=[
      ['classic','Classici','Classic',['#6366f1','#06b6d4','#f97316','#22c55e','#ec4899','#eab308','#a78bfa','#14b8a6']],
      ['accessible','Alta leggibilità','High contrast',['#56B4E9','#E69F00','#009E73','#F0E442','#CC79A7','#D55E00','#0072B2','#999999']],
      ['soft','Delicati','Soft',['#93c5fd','#c4b5fd','#fda4af','#86efac','#fdba74','#f9a8d4','#a5f3fc','#fde68a']],
      ['earth','Naturali','Earth',['#a3e635','#b45309','#eab308','#0d9488','#ca8a04','#ef4444','#6b7280','#a3a3a3']]
    ];
    for(const [id,it,en,colors] of palettes){
      const b=button('nm-chart-palette-'+id,it,en,()=>{
        model.series.forEach((series,i)=>{series.color=colors[i%colors.length]});
        renderTable();refresh();
      });
      b.className='nm-chart-palette-button';b.type='button';
      b.title=h('Applica questi colori alle serie del grafico','Apply these colors to the chart series');
      const dots=make('span','nm-chart-palette-dots');dots.setAttribute('aria-hidden','true');
      for(const color of colors.slice(0,4)){const dot=make('i');dot.style.backgroundColor=color;dots.append(dot)}
      b.prepend(dots);paletteRow.append(b);
    }
    const preview=make('div','nm-chart-preview');preview.id='nm-chart-preview';
    const tableWrap=make('div','nm-chart-table-scroll'),table=make('table','nm-chart-table');table.id='nm-chart-table';tableWrap.append(table);
    const notice=make('p','nm-chart-help');notice.id='nm-chart-feedback';notice.setAttribute('role','status');
    const addRow=button('nm-chart-add-row','+ Riga','+ Row',()=>{if(model.categories.length>=60)return;model.categories.push(String(model.categories.length+1));model.series.forEach(s=>{s.values.push(0);s.sizes?.push(0)});renderTable();refresh()});
    const delRow=button('nm-chart-remove-row','− Riga','− Row',()=>{if(model.categories.length<=1)return;model.categories.pop();model.series.forEach(s=>{s.values.pop();s.sizes?.pop()});renderTable();refresh()});
    const addSeries=button('nm-chart-add-series','+ Serie','+ Series',()=>{if(model.series.length>=8)return;model.series.push({name:'Serie '+(model.series.length+1),color:['#6366f1','#06b6d4','#f97316','#22c55e','#ec4899','#eab308','#a78bfa','#14b8a6'][model.series.length],values:model.categories.map(()=>0),sizes:model.categories.map(()=>0)});renderTable();refresh()});
    const delSeries=button('nm-chart-remove-series','− Serie','− Series',()=>{if(model.series.length<=1)return;model.series.pop();renderTable();refresh()});
    const actions=make('div','nm-chart-actions');actions.append(addRow,delRow,addSeries,delSeries);
    const pasteToggle=button('nm-chart-toggle-paste',h('Incolla tabella…','Paste table…'),h('Incolla tabella…','Paste table…'),()=>{paste.hidden=!paste.hidden});
    const paste=make('div','nm-chart-paste');paste.hidden=true;
    const pasteText=make('textarea');pasteText.id='nm-chart-paste-text';pasteText.rows=4;
    pasteText.placeholder=h('Categoria\tSerie 1\tSerie 2\nGen\t10\t20','Category\tSeries 1\tSeries 2\nJan\t10\t20');
    paste.append(pasteText,button('nm-chart-import-data',h('Carica dati','Load data'),h('Carica dati','Load data'),()=>{
      const parsed=core.parseChartTable(pasteText.value);
      if(!parsed.ok){
        notice.textContent=parsed.reason==='number'
          ?h('Valore non valido alla riga '+parsed.row+', colonna '+parsed.column+'. Correggi il numero: nessun dato è stato modificato.','Invalid number at row '+parsed.row+', column '+parsed.column+'. No data was changed.')
          :h('Tabella non valida. Inserisci intestazioni e righe separate da virgole, punto e virgola o Tab.','Invalid table. Use headers and rows separated by commas, semicolons or Tabs.');
        return;
      }
      const colors=model.series.map(s=>s.color);
      model.categories=parsed.categories;
      model.series=parsed.series.map((item,i)=>({...item,color:colors[i]||item.color}));
      model=core.graphic(model);renderTable();refresh();
      notice.textContent=parsed.truncated
        ?h('Importate solo le prime 60 righe e 8 serie.','Imported only the first 60 rows and 8 series.')
        :h('Dati caricati: controlla l’anteprima e premi Inserisci.','Data loaded: check the preview and choose Insert.');
      paste.hidden=true;
    }));
    const invalidCells=new Set();
    function renderTable(){
      invalidCells.clear();table.replaceChildren();
      const head=make('thead'),row=make('tr');row.append(make('th','',['scatter','bubble'].includes(activeType)?h('X (numero)','X (number)'):h('Categoria','Category')));
      model.series.forEach((s,j)=>{
        const th=make('th'),input=make('input');
        input.type='text';input.maxLength=64;input.value=s.name;input.setAttribute('aria-label',h('Nome serie ','Series name ')+(j+1));
        input.addEventListener('input',()=>{s.name=input.value;refresh()});
        const picker=make('input');
        picker.type='color';picker.className='nm-chart-series-color';picker.value=s.color;
        picker.setAttribute('aria-label',h('Colore serie ','Series color ')+(j+1));
        picker.title=h('Cambia il colore della serie','Change series color');
        picker.addEventListener('input',()=>{s.color=picker.value;refresh()});
        const headerControls=make('div','nm-chart-series-header');
        headerControls.append(input,picker);th.append(headerControls);row.append(th);
        if(activeType==='bubble'){
          const sizeHeader=make('th','',h('Dimensione bolla · ','Bubble size · ')+s.name);
          row.append(sizeHeader);
        }
      });head.append(row);table.append(head);
      const body=make('tbody');model.categories.forEach((c,i)=>{
        const trEl=make('tr'),td=make('td'),name=make('input');name.type='text';name.maxLength=64;name.value=c;name.setAttribute('aria-label',h('Categoria ','Category ')+(i+1));
        name.oninput=()=>{model.categories[i]=name.value;refresh()};td.append(name);trEl.append(td);
        model.series.forEach((s,j)=>{
          const cell=make('td'),value=make('input');value.type='text';value.inputMode='decimal';value.value=String(s.values[i]||0);
          value.setAttribute('aria-label',h('Valore ','Value ')+(i+1)+' / '+(j+1));
          value.oninput=()=>{
            const number=core.chartNumber(value.value),key=i+':'+j;
            value.setAttribute('aria-invalid',String(number===null));
            if(number===null){
              invalidCells.add(key);
              notice.textContent=h('Numero non valido: usa cifre come 10,5 o 10.5.','Invalid number: enter 10.5 or 10,5.');
              return;
            }
            invalidCells.delete(key);s.values[i]=number;refresh();
          };cell.append(value);trEl.append(cell);
          if(activeType==='bubble'){
            const sizeCell=make('td'),sizeInput=make('input');
            sizeInput.type='text';sizeInput.inputMode='decimal';
            sizeInput.value=String(s.sizes?.[i]||0);
            sizeInput.setAttribute('aria-label',h('Dimensione della bolla ','Bubble size ')+(i+1)+' / '+(j+1));
            sizeInput.addEventListener('input',()=>{
              const number=core.chartNumber(sizeInput.value),key='size:'+i+':'+j;
              sizeInput.setAttribute('aria-invalid',String(number===null||number<0));
              if(number===null||number<0){
                invalidCells.add(key);
                notice.textContent=h('La dimensione della bolla deve essere un numero positivo.','Bubble size must be a positive number.');
                return;
              }
              invalidCells.delete(key);s.sizes[i]=number;refresh();
            });
            sizeCell.append(sizeInput);trEl.append(sizeCell);
          }
        });body.append(trEl);
      });table.append(body);
      addRow.disabled=model.categories.length>=60;delRow.disabled=model.categories.length<=1;
      addSeries.disabled=model.series.length>=8;delSeries.disabled=model.series.length<=1;
    }
    function refresh(){
      if(!d.valid())return;
      model.title=titleInput.value;
      model.type=activeType;
      const pair=explanations[activeType];
      typeHelp.textContent=pair?h(pair[0],pair[1]):'';
      const valid=core.graphic(model);
      preview.innerHTML=core.chartSVG(valid);
      if(typeof preview.querySelector==='function')preview.querySelector('svg')?.setAttribute('preserveAspectRatio','xMidYMid meet');
      if(typeof gallery.querySelectorAll==='function')gallery.querySelectorAll('[data-chart-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.chartType===activeType)));
      const crowded=(['pie','donut','radar'].includes(activeType)&&valid.categories.length>12)
        ||(['column','column-stacked','line','area','combo'].includes(activeType)&&valid.categories.length>24);
      const invalidX=['scatter','bubble'].includes(activeType)
        &&valid.categories.some(x=>core.chartNumber(x)===null);
      notice.textContent=invalidX?h('Per questo grafico inserisci numeri nella prima colonna X.','For this chart, enter numeric X values in the first column.'):
        crowded?h('Attenzione: troppe categorie per una lettura chiara. Riducile oppure scegli un grafico a barre.','Many categories may be hard to read. Try fewer, or use a bar chart.'):
        h('Anteprima aggiornata · '+valid.categories.length+' categorie','Preview updated · '+valid.categories.length+' categories');
    }
    for(const [type,it,en] of kinds){
      const tile=button('nm-chart-type-'+type,it,en,()=>{activeType=type;renderTable();refresh()});
      tile.dataset.chartType=type;tile.classList.add('nm-chart-tile');
      const mini=make('span','nm-chart-mini');mini.setAttribute('aria-hidden','true');
      mini.innerHTML=core.chartSVG({kind:'chart',type,title:'',categories:['A','B','C'],series:[{name:'1',values:[4,8,5]},{name:'2',values:[3,6,2]}]});
      tile.prepend(mini);gallery.append(tile);
    }
    const placement=make('label','nm-chart-attach'),check=make('input');check.type='checkbox';check.id='nm-chart-attach';
    check.checked=image?.mode==='attached';
    const targetName=app.state.findNode(selectedNodeId)?.text?.slice(0,55)||h('nodo centrale','central node');
    placement.append(check,make('span','',image?.mode==='attached'
      ?h('Mantieni agganciato a: ','Keep attached to: ')+targetName
      :h('Aggancia a: ','Attach to: ')+targetName));
    const save=button('nm-chart-save',image?h('Aggiorna grafico','Update chart'):h('Inserisci grafico','Insert chart'),
      image?h('Aggiorna grafico','Update chart'):h('Inserisci grafico','Insert chart'),()=>{
      if(!d.valid())return;
      if(invalidCells.size){
        notice.textContent=h('Correggi i numeri evidenziati prima di inserire il grafico.','Correct highlighted numbers before inserting the chart.');
        return;
      }
      model.title=titleInput.value;model.type=activeType;
      const meta=core.graphic(model),svg=core.chartSVG(meta);
      if(image){if(!app.state.images.includes(image))return;app.state.pushHistory();image.src=data(svg);image.graphic=meta;
        setGraphicPlacement(app,image,check.checked,selectedNodeId);
        app.markChanged();
      }else insertSmartGraphic(app,svg,meta,check.checked,selectedNodeId);
      d.close();
    });
    const foot=make('div','nm-chart-footer');
    const footActions=make('div','nm-chart-footer-actions');
    const cancelBtn=button('nm-chart-cancel','Annulla','Cancel',()=>d.close());
    cancelBtn.className='nm-chart-cancel-btn';
    save.className='nm-chart-save-btn btn-primary';
    footActions.append(cancelBtn,save);
    foot.append(placement,footActions);

    const studio=make('div','nm-chart-studio');
    const stageCol=make('div','nm-chart-stage-col');
    const dataCol=make('div','nm-chart-data-col');

    const statusBar=make('div','nm-chart-status-bar');
    statusBar.append(typeHelp,notice);

    const typeBlock=make('div','nm-chart-section');
    typeBlock.append(make('div','nm-chart-section-head',h('Tipo di grafico','Chart type')),gallery);

    const dataHead=make('div','nm-chart-data-head');
    dataHead.append(make('div','nm-chart-section-head',h('Dati del grafico','Chart data')),actions);
    actions.append(pasteToggle);

    stageCol.append(title,preview,statusBar,typeBlock);
    dataCol.append(dataHead,subtitle,paste,tableWrap,paletteRow);
    studio.append(stageCol,dataCol);
    d.panel.append(studio,foot);
    titleInput.addEventListener('input',refresh);renderTable();refresh();titleInput.focus();
  }
  function wordArtDialog(app,image=null){
    const d=dialog(app,'nm-wordart-dialog','WordArt · Testo decorativo','WordArt · Decorative text');
    d.panel.classList.add('nm-wordart-editor');
    const make=(tag,cls='',text='')=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e};
    let model=core.graphic(image?.graphic?.kind==='wordart'?image.graphic:{kind:'wordart',text:'Glauka',style:'classic'});
    const source=field('nm-wordart-text','Testo decorativo','Decorative text'),color=field('nm-wordart-color','Colore riempimento','Fill color','color'),outline=field('nm-wordart-outline','Colore contorno','Outline color','color');
    source.input.maxLength=250;source.input.value=model.text;color.input.value=model.color;outline.input.value=model.outline;
    const grid=make('div','nm-wordart-gallery'),preview=make('div','nm-wordart-preview');preview.id='nm-wordart-preview';
    preview.dataset.surface='dark';
    const styleNames={
      classic:['Classico','Classic'],outline:['Solo contorno','Outline'],
      shadow:['Con ombra','Shadow'],neon:['Luminoso','Neon'],
      gradient:['Sfumato','Gradient'],metal:['Metallizzato','Metal'],
      retro:['Vintage','Retro'],glow:['Bagliore','Glow']
    };
    for(const style of core.WORDART_TYPES){
      const names=styleNames[style];
      const b=button('nm-wordart-'+style,names[0],names[1],()=>{model.style=style;refresh()});
      b.dataset.wordartStyle=style;b.className='nm-wordart-tile';
      const mini=make('span','nm-wordart-mini');mini.innerHTML=core.wordArtSVG({...model,text:'Titolo',width:260,height:95,style});
      b.prepend(mini);grid.append(b);
    }
    const presetColors=[
      ['Glauka','Glauka','#7c8aff','#1e293b'],
      ['Tramonto','Sunset','#f97316','#7c2d12'],
      ['Smeraldo','Emerald','#10b981','#064e3b'],
      ['Oro','Gold','#facc15','#713f12'],
      ['Ghiaccio','Ice','#7dd3fc','#0c4a6e'],
      ['Inchiostro','Ink','#1e293b','#94a3b8']
    ];
    const presetRow=make('div','nm-wordart-presets');
    for(const [it,en,c1,c2]of presetColors){
      const chip=button('',it,en,()=>{color.input.value=c1;outline.input.value=c2;refresh()});
      chip.className='nm-chart-palette-button nm-wordart-preset-chip';
      const dots=make('span','nm-chart-palette-dots');
      const d1=make('i'),d2=make('i');d1.style.background=c1;d2.style.background=c2;
      dots.append(d1,d2);chip.prepend(dots);presetRow.append(chip);
    }
    const attach=make('label','nm-chart-attach'),check=make('input');check.type='checkbox';check.id='nm-wordart-attach';check.checked=image?.mode==='attached';
    const selected=image?.mode==='attached'&&image.attachedNodeId
      ?image.attachedNodeId:app.state.selectedNodeId;
    const targetName=app.state.findNode(selected)?.text?.slice(0,48)||tr('ramo selezionato','selected branch');
    attach.append(check,make('span','',tr(
      image?.mode==='attached'?'Mantieni agganciato a: '+targetName:'Aggancia a: '+targetName,
      image?.mode==='attached'?'Keep attached to: '+targetName:'Attach to: '+targetName)));
    const hexColor=make('span','nm-wordart-hex',model.color.toUpperCase());
    const hexOutline=make('span','nm-wordart-hex',model.outline.toUpperCase());
    function refresh(){
      if(!d.valid())return;
      model=core.graphic({...model,text:source.input.value,color:color.input.value,outline:outline.input.value});
      preview.innerHTML=core.wordArtSVG(model);
      if(typeof preview.querySelector==='function')preview.querySelector('svg')?.setAttribute('preserveAspectRatio','xMidYMid meet');
      if(typeof grid.querySelectorAll==='function')grid.querySelectorAll('[data-wordart-style]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wordartStyle===model.style)));
      hexColor.textContent=String(color.input.value||'').toUpperCase();
      hexOutline.textContent=String(outline.input.value||'').toUpperCase();
    }
    const wordNote=make('small','nm-chart-help');wordNote.setAttribute('role','status');
    wordNote.textContent=tr('Scrivi il testo, scegli uno stile e poi premi Inserisci.','Enter the text, choose a style, then press Insert.');
    const save=button('nm-wordart-save',image?'Aggiorna WordArt':'Inserisci WordArt',image?'Update WordArt':'Insert WordArt',()=>{
      if(!d.valid())return;
      if(!source.input.value.trim()){wordNote.textContent=tr('Scrivi almeno una parola.','Enter at least one word.');source.input.focus();return;}
      refresh();
      const svg=core.wordArtSVG(model);
      if(image){if(!app.state.images.includes(image))return;app.state.pushHistory();image.graphic=model;image.src=data(svg);setGraphicPlacement(app,image,check.checked,selected);app.markChanged();}
      else insertSmartGraphic(app,svg,model,check.checked,selected);
      d.close();
    });
    save.className='nm-chart-save-btn btn-primary';
    const cancel=button('nm-wordart-cancel','Annulla','Cancel',()=>d.close());
    cancel.className='nm-chart-cancel-btn';

    const bgToggle=make('div','nm-formula-bg-toggle');
    for(const [mode,it,en]of [['dark','Scuro','Dark'],['light','Chiaro','Light']]){
      const b=button('',it,en,()=>{
        preview.dataset.surface=mode;
        if(typeof bgToggle.querySelectorAll==='function')bgToggle.querySelectorAll('button').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.surfaceMode===mode)));
      });
      b.dataset.surfaceMode=mode;b.setAttribute('aria-pressed',String(mode==='dark'));bgToggle.append(b);
    }

    const studio=make('div','nm-wordart-studio');
    const stageCol=make('div','nm-wordart-stage-col');
    const ctrlCol=make('div','nm-wordart-controls-col');

    const previewHead=make('div','nm-formula-bar-head');
    previewHead.append(make('span','nm-chart-section-head',tr('Anteprima live','Live preview')),bgToggle);
    const statusBar=make('div','nm-chart-status-bar');
    statusBar.append(wordNote);
    const textWrap=make('div','nm-chart-section');
    textWrap.append(make('label','nm-chart-section-head',tr('Testo decorativo','Decorative text')),source.input);
    const stylesWrap=make('div','nm-chart-section');
    stylesWrap.append(make('div','nm-chart-section-head',tr('Stile tipografico','Text style')),grid);
    stageCol.append(textWrap,previewHead,preview,statusBar);

    const colorGrid=make('div','nm-wordart-color-grid');
    const cCard1=make('div','nm-wordart-color-card'),pRow1=make('div','nm-wordart-picker-row');
    pRow1.append(color.input,hexColor);cCard1.append(make('span','nm-chart-section-head',tr('Riempimento','Fill')),pRow1);
    const cCard2=make('div','nm-wordart-color-card'),pRow2=make('div','nm-wordart-picker-row');
    pRow2.append(outline.input,hexOutline);cCard2.append(make('span','nm-chart-section-head',tr('Contorno','Outline')),pRow2);
    colorGrid.append(cCard1,cCard2);

    const presetsWrap=make('div','nm-chart-section');
    presetsWrap.append(make('div','nm-chart-section-head',tr('Abbinamenti rapidi','Quick palettes')),presetRow);
    ctrlCol.append(stylesWrap,colorGrid,presetsWrap);

    const foot=make('div','nm-chart-footer');
    const footActions=make('div','nm-chart-footer-actions');
    footActions.append(cancel,save);
    foot.append(attach,footActions);

    studio.append(stageCol,ctrlCol);
    d.panel.append(studio,foot);
    for(const input of [source.input,color.input,outline.input])input.addEventListener('input',refresh);
    refresh();source.input.focus();
  }

