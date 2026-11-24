  function exportView(app,format='svg',scale=2){
    const field=document.querySelector('#nm-view-stage .nm-view-edit');
    if(field)field.blur(); // commit any active inline rename first
    const rootNode=app.state?.root,mode=displayMode(app.state);
    if(!rootNode||mode==='mindmap')return false;
    let graph;
    try{graph=projected(app.state,mode)}
    catch(error){app.showToast?.(error.message,'ERRORE');return false}
    const sceneStyle=viewStyle(app.state,mode);
    const modeElements=appearance?.clean(app.state.root.viewAppearance).modes[mode]?.elements||null;
    const NS='http://www.w3.org/2000/svg';
    const el=name=>document.createElementNS(NS,name);
    const svg=el('svg');
    svg.setAttribute('xmlns',NS);svg.setAttribute('viewBox','0 0 '+graph.width+' '+graph.height);
    svg.setAttribute('width',String(graph.width));svg.setAttribute('height',String(graph.height));
    const scoped=focusRoot(app.state),exportRoot=scoped||rootNode;
    const title=el('title');title.textContent=String(exportRoot.text||'NeuroMap')+
      (scoped?' — '+tr('solo ramo','selected branch'):'')+' — '+mode;svg.append(title);
    const background=el('rect');background.setAttribute('width','100%');background.setAttribute('height','100%');
    background.setAttribute('fill',sceneStyle?.background||'#0d1627');svg.append(background);
    const defs=el('defs'),marker=el('marker');
    marker.setAttribute('id','nm-export-arrow');marker.setAttribute('viewBox','0 0 10 10');
    marker.setAttribute('refX','9');marker.setAttribute('refY','5');marker.setAttribute('markerWidth','6');
    marker.setAttribute('markerHeight','6');marker.setAttribute('orient','auto-start-reverse');
    const arrow=el('path');arrow.setAttribute('d','M0 0 L10 5 L0 10 z');arrow.setAttribute('fill',mode==='concept-network'?sceneStyle?.accent||'#a78bfa':sceneStyle?.edge||'#9cafd1');
    marker.append(arrow);defs.append(marker);
    // Match the interactive stage's 28px radial-dot grid. This pattern is
    // fully self-contained in SVG and survives local PNG/PDF rasterization.
    const grid=el('pattern');grid.setAttribute('id','nm-export-grid');
    grid.setAttribute('patternUnits','userSpaceOnUse');
    const gridStep=appearance.CANVAS_GRID_SIZE;
    grid.setAttribute('width',String(gridStep));grid.setAttribute('height',String(gridStep));
    const gridDot=el('circle');gridDot.setAttribute('cx',String(gridStep/2));
    gridDot.setAttribute('cy',String(gridStep/2));
    gridDot.setAttribute('r','1');gridDot.setAttribute('fill',sceneStyle?.grid||'#2b405e');
    grid.append(gridDot);defs.append(grid);svg.append(defs);
    const gridFill=el('rect');gridFill.setAttribute('width','100%');gridFill.setAttribute('height','100%');
    gridFill.setAttribute('fill','url(#nm-export-grid)');
    gridFill.setAttribute('pointer-events','none');svg.append(gridFill);
    if(mode==='flowchart')addFlowArrowMarkers(svg,'nm-export-process',sceneStyle);
    if(mode==='timeline')timelineAxis(svg,graph,sceneStyle);
    if(mode==='kanban')for(const column of graph.columns){
      const heading=el('text');heading.textContent=tr(...({unassigned:['Da classificare','Unassigned'],todo:['Da fare','To do'],doing:['In corso','In progress'],done:['Completato','Done']}[column.id]))+' · '+column.count;
      heading.setAttribute('x',String(column.x));heading.setAttribute('y','67');heading.setAttribute('fill',sceneStyle?.text||'#e2e8f0');
      heading.setAttribute('text-anchor','middle');heading.setAttribute('font-size','15');svg.append(heading);
      const rule=el('rect');rule.setAttribute('x',String(column.x-column.width/2+7));
      rule.setAttribute('y','84');rule.setAttribute('width',String(column.width-14));
      rule.setAttribute('height','3');rule.setAttribute('rx','1.5');
      rule.setAttribute('data-kanban-rule',column.id);
      rule.setAttribute('fill',kanbanStatusColor(column.id));svg.append(rule);
    }
    const boxes=new Map(graph.nodes.map(n=>[n.id,n]));
    const networkLabels=mode==='concept-network'?network.placeLabels(graph):null;
    for(const edge of graph.edges){
      const from=boxes.get(edge.fromId),to=boxes.get(edge.toId);if(!from||!to)continue;
      const p=el('path');p.setAttribute('d',mode==='timeline'?timelineDependencyPath(from,to):mode==='flowchart'?flows.path(from,to,edge.kind):mode==='concept-network'?network.path(from,to):core.path(from,to,mode));
      p.setAttribute('fill','none');p.setAttribute('stroke',mode==='flowchart'?semanticFlowColor(edge.kind,sceneStyle):sceneStyle?.edge||'#8295b7');
      p.setAttribute('stroke-width','2');
       if(mode==='concept-network'){
         p.setAttribute('stroke',edge.type==='relation'?sceneStyle?.accent||'#a78bfa':sceneStyle?.edge||'#8295b7');
         p.setAttribute('stroke-width',edge.type==='relation'?'2.5':'1.7');
         if(edge.type==='hierarchy')p.setAttribute('stroke-opacity','.62');
       }
       if(mode==='timeline'){
         decorateTimelineDependency(p,edge,from,to,sceneStyle);
         p.setAttribute('marker-end','url(#nm-export-arrow)');
       }
       if(mode==='flowchart')p.setAttribute('marker-end',flowArrowId('nm-export-process',edge.kind));
       if(mode==='concept-network'&&edge.type==='relation')p.setAttribute('marker-end','url(#nm-export-arrow)');
      if(mode==='concept-network')describeNetworkEdge(p,edge);
      svg.append(p);
      if(mode==='concept-network'&&edge.type==='relation'&&edge.label)
        drawNetworkLabel(svg,edge,networkLabels.get(edge.id),sceneStyle);
      if(mode==='flowchart'&&(edge.kind==='yes'||edge.kind==='no')){
        const text=el('text');text.textContent=edge.kind==='yes'?tr('Sì','Yes'):tr('No','No');
        const position=flows.labelPoint(from,to,edge.kind);
        text.setAttribute('x',String(position.x));text.setAttribute('y',String(position.y));
        text.setAttribute('text-anchor','middle');text.setAttribute('font-size','12');
        text.setAttribute('fill',semanticFlowColor(edge.kind,sceneStyle));svg.append(text);
      }
    }
    const orgImages=(mode==='orgchart'||mode==='concept-tree')?orgAttachedImages(app.state):null;
    for(const card of graph.nodes){
      const override=modeElements&&Object.prototype.hasOwnProperty.call(modeElements,card.id)?modeElements[card.id]:null;
      const cardStyle=sceneStyle&&override?{...sceneStyle,...override}:sceneStyle;
      if(mode==='timeline'){
        const full=String(card.text||'');
        const title=el('text');
        // The timeline label column ends before the time axis. A fixed 31-character
        // cutoff overflows at larger font sizes; keep the SVG within its 200px slot.
        const titleFontSize=cardStyle?.fontSize||12;
        const maxTitleChars=Math.max(8,Math.floor(200/(titleFontSize*.58)));
        // Slice by Unicode code point, never between the halves of an emoji.
        const titleChars=Array.from(full);
        title.textContent=titleChars.length>maxTitleChars?
          titleChars.slice(0,maxTitleChars-1).join('').trimEnd()+'…':full;
        title.setAttribute('aria-label',full);
        const fullTitle=el('title');fullTitle.textContent=full;title.append(fullTitle);
        title.setAttribute('x','20');title.setAttribute('y',String(card.y-5));
        title.setAttribute('fill',cardStyle?.text||'#e2e8f0');
        title.setAttribute('font-family','system-ui,Arial,sans-serif');
        title.setAttribute('font-size',String(titleFontSize));title.setAttribute('font-weight','700');svg.append(title);
        const date=el('text');date.textContent=timelineDateCaption(card);
        if(card.startGroupCount>1){
          const group=el('text');group.textContent=String(card.startGroupIndex+1)+'/'+String(card.startGroupCount);
          group.setAttribute('x','226');group.setAttribute('y',String(card.y-5));
          group.setAttribute('font-family','system-ui,Arial,sans-serif');
          group.setAttribute('font-size','10');
          group.setAttribute('font-weight','600');
          group.setAttribute('fill',cardStyle?.text||'#e2e8f0');
          svg.append(group);
        }
        date.setAttribute('x','20');date.setAttribute('y',String(card.y+13));
        date.setAttribute('fill',cardStyle?.text||'#e2e8f0');date.setAttribute('opacity','.78');
        date.setAttribute('font-family','system-ui,Arial,sans-serif');
        date.setAttribute('font-size','10');svg.append(date);
      }
      const isDiamond=(mode==='flowchart'&&card.decision)||(mode==='timeline'&&card.milestone);
      const isIO=mode==='flowchart'&&card.io;
      const shape=el(isDiamond||isIO?'polygon':'rect');
      if(isIO){
        shape.setAttribute('points',flows.ioPoints(card).map(([x,y])=>x+','+y).join(' '));
        shape.setAttribute('data-flow-shape',card.shape);
      }else if(isDiamond){
        shape.setAttribute('points',[
          [card.x,card.y-card.h/2],[card.x+card.w/2,card.y],
          [card.x,card.y+card.h/2],[card.x-card.w/2,card.y]
        ].map(([x,y])=>x+','+y).join(' '));
      }else{
        for(const [k,v]of [['x',card.x-card.w/2],['y',card.y-card.h/2],['width',card.w],['height',card.h],['rx',mode==='flowchart'&&card.terminal?card.h/2:cardStyle?.radius||12]])shape.setAttribute(k,String(v));
      }
      const color=/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(card.color)?card.color:'#818cf8';
      shape.setAttribute('fill',cardStyle?.surface||(mode==='timeline'?'#5075b8':card.decision?'#322c43':card.depth===0?'#282c63':'#1b2a40'));
      const explicitAccent=modeElements?.[card.id]?.accent||
        app.state.root.viewAppearance?.modes?.[mode]?.accent;
      shape.setAttribute('stroke',explicitAccent||(/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(card.color||'')?card.color:cardStyle?.accent)||'#818cf8');
      shape.setAttribute('stroke-width','2');svg.append(shape);
      if(mode==='flowchart'&&card.roleConflict){
        const warning=el('text');warning.textContent='!';
        warning.setAttribute('x',String(card.x+card.w/2-8));
        warning.setAttribute('y',String(card.y-card.h/2-8));
        warning.setAttribute('text-anchor','middle');
        warning.setAttribute('font-family','system-ui,Arial,sans-serif');
        warning.setAttribute('font-weight','800');
        warning.setAttribute('font-size','16');
        warning.setAttribute('fill','#f59e0b');
        warning.setAttribute('aria-label',card.shape==='start'?
          tr('Inizio con collegamenti in ingresso','Start has incoming links'):
          tr('Fine con collegamenti in uscita','End has outgoing links'));
        svg.append(warning);
      }
      if(mode==='flowchart'&&(card.terminal||card.io)){
        const role=el('text');
        role.textContent=flowShapeLabel(card.shape);
        role.setAttribute('x',String(card.x));
        role.setAttribute('y',String(card.y-card.h/2-9));
        role.setAttribute('font-family','system-ui,Arial,sans-serif');
        role.setAttribute('font-size','10');
        role.setAttribute('font-weight','700');
        role.setAttribute('text-anchor','middle');
        role.setAttribute('fill',cardStyle?.text||'#e2e8f0');
        svg.append(role);
      }
       if(mode==='concept-tree')drawTreeMarkers(svg,card,sceneStyle,orgImages?.get(card.id));
       if(mode==='kanban')drawKanbanDecorations(svg,card,cardStyle);
       if(mode==='orgchart')drawOrgMarkers(svg,card,cardStyle,orgImages?.get(card.id));
       if(mode==='concept-network'&&Number.isInteger(card.clusterIndex)&&card.clusterIndex>=0){
         const dot=el('circle');dot.setAttribute('cx',String(card.x-card.w/2-2));
         dot.setAttribute('cy',String(card.y-card.h/2+14));dot.setAttribute('r','4.5');
         dot.setAttribute('fill',NETWORK_CLUSTER_COLORS[card.clusterIndex%NETWORK_CLUSTER_COLORS.length]);
         dot.setAttribute('data-network-cluster','1');dot.setAttribute('stroke-width','0');
         svg.append(dot);
       }
      // Keep exported labels within their cards at every supported font size.
      // Preserve the complete canonical text in SVG accessibility metadata.
      if(mode!=='timeline'){
        const full=String(card.text||'');
        const typography=mode==='concept-tree'?
          appearance.treeTypography(card.depth,cardStyle?.fontSize||12):null;
        const fontSize=typography?.fontSize??cardStyle?.fontSize??12;
        const lineHeight=Math.ceil(fontSize*1.25);
        // F10: org-chart cards reserve the left column for the real-data
        // monogram, the lower row for level/report count, and the right
        // edge for native actions. SVG/PNG/PDF use the same typography lanes.
        const orgCard=mode==='orgchart';
        const maxLines=orgCard?(fontSize>=16?1:2):
          Math.max(1,Math.min(3,Math.floor((card.h-16)/lineHeight)));
        const maxChars=Math.max(4,Math.floor((card.w-(orgCard?86:24))/(fontSize*.57)));
        const words=full.trim().split(/\s+/).filter(Boolean);
        const lines=[];
        let pending='';
        for(const word of words){
          if(!pending){pending=word;continue}
          if(Array.from(pending+' '+word).length<=maxChars)pending+=' '+word;
          else{lines.push(pending);pending=word}
        }
        if(pending)lines.push(pending);
        if(!lines.length)lines.push('');
        const visible=lines.slice(0,maxLines);
        const ellipsis=value=>Array.from(value).slice(0,Math.max(1,maxChars-1)).join('').trimEnd()+'…';
        for(let i=0;i<visible.length;i++){
          if(Array.from(visible[i]).length>maxChars)visible[i]=ellipsis(visible[i]);
        }
        if(lines.length>maxLines)visible[visible.length-1]=ellipsis(visible[visible.length-1]);
        const label=el('text');
        const textX=orgCard?card.x-card.w/2+45:card.x;
        label.setAttribute('x',String(textX));
        label.setAttribute('y',String(card.y-(visible.length-1)*lineHeight/2+fontSize*.35-(orgCard?7:0)));
        label.setAttribute('text-anchor',orgCard?'start':'middle');
        label.setAttribute('font-family','system-ui,Arial,sans-serif');
        label.setAttribute('font-size',String(fontSize));
        if(typography)label.setAttribute('font-weight',String(typography.fontWeight));
        label.setAttribute('fill',cardStyle?.text||'#f1f5f9');
        label.setAttribute('aria-label',full);
        const fullTitle=el('title');fullTitle.textContent=full;label.append(fullTitle);
        visible.forEach((line,i)=>{
          const span=el('tspan');span.textContent=line;
          span.setAttribute('x',String(textX));
          span.setAttribute('dy',i?String(lineHeight):'0');
          label.append(span);
        });
        svg.append(label);
      }
    }
    const name=String(exportRoot.text||'NeuroMap').replace(/[^\w\u00C0-\u024F -]/g,'').slice(0,65).trim()||'NeuroMap';
    const stem=name+(scoped?'-branch':'')+'-'+mode;
    if(format==='png'||format==='pdf')return rasterizeViewRaster(app,svg,graph.width,graph.height,stem,scale,format);
    const blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'});
    const result=app.io.triggerDownload(blob,stem+'.svg');
    if(!root.neuromapDesktop)app.showToast?.(tr('Vista SVG esportata','SVG view exported'),'SVG');
    return result;
  }
