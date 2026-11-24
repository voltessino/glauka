const {test,expect}=require('@playwright/test');
async function open(page,target,size={width:1280,height:900}){
 await page.setViewportSize(size);
 await page.goto(target==='desktop'?'http://127.0.0.1:5174/index.html':'http://127.0.0.1:5173/app/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?.io);
 await page.evaluate(()=>{
  document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));
  const a=window.neuroMapApp;
  a.importHierarchy({text:'Mappa α 🧠',children:Array.from({length:8},(_,i)=>({text:`Ramo ${i}`,children:Array.from({length:3},(_,j)=>({text:`Concetto ${i}/${j}`,children:[]}))}))},{newTab:true});
  a.state.selectedNodeId=null;a.recalculateAndRender();
 });
}
async function capture(page,method){return page.evaluate(async method=>{
 const a=window.neuroMapApp,old=a.io.triggerDownload;
 try{return await new Promise((resolve,reject)=>{a.io.triggerDownload=async(blob,name)=>resolve({name,type:blob.type,text:method==='exportSVG'||method==='exportPDF'?await blob.text():null,bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))});Promise.resolve(a.io[method]()).catch(reject);});}
 finally{a.io.triggerDownload=old;}
},method);}
for(const target of ['desktop','android'])test.describe(`${target} graphics`,()=>{
 for(const size of [{width:1280,height:900},{width:390,height:844},{width:844,height:390}])for(const inspector of [false,true]){
 test(`whole map fits usable viewport ${size.width}x${size.height}, inspector ${inspector}`,async({page})=>{
  await open(page,target,size);
  const r=await page.evaluate(inspector=>{
   const a=window.neuroMapApp,s=document.getElementById('inspector-sidebar');s.classList.toggle('collapsed',!inspector);s.style.transition='none';
   a.state.images=[{id:'far',mode:'free',width:180,height:100,worldPos:{x:-1800,y:700}}];a.fitWholeMap();
   const b=a.layout.computeBoundingBox(a.state.images),p=a.renderer.worldToScreen(b.minX,b.minY),q=a.renderer.worldToScreen(b.maxX,b.maxY);
   const top=document.querySelector('.top-chrome')?.getBoundingClientRect().bottom||0,dock=document.getElementById('mobile-dock')?.getBoundingClientRect(),sb=s.getBoundingClientRect();
   const rail=document.getElementById('nm614-right-dock')?.getBoundingClientRect();
   let freeLeft=18,freeRight=Math.min(innerWidth-18,rail?.width?rail.left-12:innerWidth-18,inspector&&sb.left>=180&&sb.width>100?sb.left-17:innerWidth-18);
   let freeTop=Math.max(18,Math.ceil(top)+12),freeBottom=dock&&dock.height&&dock.top>top+42?Math.min(innerHeight-22,dock.top-12):innerHeight-22;
   const radar=document.getElementById('nm616-minimap-shell');
   if(radar&&!radar.hidden&&!radar.classList.contains('hidden')){
    const box=radar.getBoundingClientRect();
    if(box.width>40&&box.height>40){
     const width=freeRight-freeLeft,height=freeBottom-freeTop,gap=12;
     const nextRight=Math.floor(box.left)-gap,nextBottom=Math.floor(box.top)-gap;
     if(box.left>freeLeft+width*0.55&&nextRight-freeLeft>width*0.62)freeRight=Math.min(freeRight,nextRight);
     else if(box.top>freeTop+height*0.45&&nextBottom-freeTop>height*0.62)freeBottom=Math.min(freeBottom,nextBottom);
    }
   }
   return {p,q,center:{x:(freeLeft+freeRight)/2,y:(freeTop+freeBottom)/2},top,bottom:dock&&dock.height&&dock.top>innerHeight/2?dock.top:innerHeight,right:inspector&&sb.left>innerWidth*.35&&sb.width>100?sb.left:innerWidth};
  },inspector);
  expect((r.p.x+r.q.x)/2).toBeCloseTo(r.center.x,5);expect((r.p.y+r.q.y)/2).toBeCloseTo(r.center.y,5);
  expect(r.p.x).toBeGreaterThanOrEqual(8);expect(r.q.x).toBeLessThanOrEqual(r.right-8);
  expect(r.p.y).toBeGreaterThanOrEqual(r.top+8);expect(r.q.y).toBeLessThanOrEqual(r.bottom-8);
 });}
 for(const style of ['neon','buzan','thickparents','radial','xmind8','simple']){
 test(`finite layout, no node overlaps, branch geometry: ${style}`,async({page})=>{
  await open(page,target);
  const r=await page.evaluate(style=>{
   const a=window.neuroMapApp;a.state.branchStyle=style;a.recalculateAndRender();
   const nodes=a.state.getAllNodes(),ms=nodes.map(n=>a.layout.getLayout(n.id)).filter(Boolean),overlaps=[];
   for(let i=0;i<ms.length;i++)for(let j=i+1;j<ms.length;j++)if(Math.abs(ms[i].x-ms[j].x)<(ms[i].width+ms[j].width)/2-1&&Math.abs(ms[i].y-ms[j].y)<(ms[i].height+ms[j].height)/2-1)overlaps.push([nodes[i].text,nodes[j].text]);
   const g=style==='radial'?a.renderer.radialRibbon(a.state.root,a.state.root.children[0]):a.renderer.computeBranchGeometry(a.state.root,a.state.root.children[0],0,4);
   const numbers=JSON.stringify(g);return {finite:ms.every(m=>[m.x,m.y,m.width,m.height].every(Number.isFinite)&&m.width>0&&m.height>0),overlaps,geometry:!!g&&!numbers.includes('null')};
  },style);
  expect(r.finite).toBe(true);expect(r.overlaps).toEqual([]);expect(r.geometry).toBe(true);
 });}
 for(const zoom of [.12,.5,1,2,3.5])test(`hit targets and inverse coordinates after pan at zoom ${zoom}`,async({page})=>{
  await open(page,target);
  const r=await page.evaluate(zoom=>{
   const a=window.neuroMapApp;a.renderer.semanticZoomEnabled=false;Object.assign(a.renderer.camera,{zoom,x:317,y:263});a.renderer.render();
   return a.state.getAllNodes().map(n=>{const m=a.layout.getLayout(n.id),p=a.renderer.worldToScreen(m.x,m.y),w=a.renderer.screenToWorld(p.x,p.y),hit=a.findHit(p.x,p.y);return {id:n.id,hit:hit?.item?.id||hit?.node?.id,dx:w.x-m.x,dy:w.y-m.y};});
  },zoom);
  for(const n of r){expect(n.hit).toBe(n.id);expect(Math.abs(n.dx)).toBeLessThan(1e-8);expect(Math.abs(n.dy)).toBeLessThan(1e-8);}
 });
 for(const label of ['Un concetto molto lungo '.repeat(20),'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(10),'日本語 中文 Ελληνικά العربية 🧠👨‍👩‍👧‍👦','Prima riga\nSeconda riga\nTerza riga'])test(`label measurements contain painted text: ${label.slice(0,25)}`,async({page})=>{
  await open(page,target);
  const r=await page.evaluate(label=>{
   const a=window.neuroMapApp,n=a.state.root.children[0];n.text=label;n.fontSize=48;n.labelWrapChars=18;n.labelIndent=40;a.recalculateAndRender();
   const m=a.layout.getLayout(n.id),c=document.createElement('canvas').getContext('2d');c.font=`${m.fontWeight??400} ${m.fontSize}px Inter, -apple-system, sans-serif`;
   return {width:m.width,height:m.height,lines:m.lines.map(line=>c.measureText(line).width),lineHeight:m.lineHeight,count:m.lines.length};
  },label);
  expect(Math.max(...r.lines)).toBeLessThanOrEqual(r.width+1);expect(r.lineHeight*r.count).toBeLessThanOrEqual(r.height+1);
 });
 for(const style of ['neon','buzan','thickparents','radial','simple','xmind8'])test(`stroke slider changes drawing monotonically: ${style}`,async({page})=>{
  await open(page,target);
  const r=await page.evaluate(style=>{
   const a=window.neuroMapApp;a.state.branchStyle=style;a.recalculateAndRender();
   return [.5,1,2,3].map(scale=>{a.state.strokeScale=scale;const c=document.createElement('canvas');c.width=2000;c.height=1500;const ctx=c.getContext('2d');const prev=a.renderer.ctx;a.renderer.ctx=ctx;ctx.translate(1000,750);try{a.renderer.drawTaperingBranch(a.state.root,a.state.root.children[0],0,4);}finally{a.renderer.ctx=prev;}
    const d=ctx.getImageData(0,0,c.width,c.height).data;let alpha=0;for(let i=3;i<d.length;i+=4)alpha+=d[i];return alpha;
   });
  },style);
  // Thick ribbons intentionally saturate to keep dense fans readable.
  expect(r.at(-1)).toBeGreaterThan(r[0]);for(let i=1;i<r.length;i++)expect(r[i]).toBeGreaterThanOrEqual(r[i-1]);
 });
 for(const style of ['simple','xmind8'])test(`SVG preserves actual branch stroke ${style}`,async({page})=>{
  await open(page,target);await page.evaluate(style=>{const a=window.neuroMapApp;a.state.branchStyle=style;a.state.strokeScale=3;a.recalculateAndRender();},style);
  const out=await capture(page,'exportSVG');
  const widths=await page.evaluate(svg=>{const doc=new DOMParser().parseFromString(svg,'image/svg+xml');return [...doc.querySelectorAll('path[stroke-width]')].map(p=>Number(p.getAttribute('stroke-width')));},out.text);
  expect(widths.length).toBeGreaterThan(0);for(const width of widths)expect(width).toBeCloseTo((style==='simple'?1.35:1.7)*3,5);
 });
 test('SVG retains relationship and boundary captions',async({page})=>{
  await open(page,target);await page.evaluate(()=>{const a=window.neuroMapApp,[x,y]=a.state.root.children;x.boundary={enabled:true,title:'Group α'};a.state.relationships=[{id:'r',fromId:x.id,toId:y.id,label:'Link β'}];a.recalculateAndRender();});
  const out=await capture(page,'exportSVG');expect(out.text).toContain('Group α');expect(out.text).toContain('Link β');
 });
 test('PNG decodes, includes distant images and leaves camera unchanged',async({page})=>{
  await open(page,target);const before=await page.evaluate(()=>{const a=window.neuroMapApp;a.state.images=[{id:'free',mode:'free',width:200,height:100,worldPos:{x:1500,y:0}}];return {...a.renderer.camera};});
  const out=await capture(page,'exportPNG');expect(out.type).toBe('image/png');expect(out.bytes.slice(0,8)).toEqual([137,80,78,71,13,10,26,10]);
  const dimensions=await page.evaluate(async bytes=>{const bmp=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));return {w:bmp.width,h:bmp.height};},out.bytes);
  expect(dimensions.w).toBeGreaterThan(3000);expect(dimensions.h).toBeGreaterThan(400);expect(await page.evaluate(()=>({...window.neuroMapApp.renderer.camera}))).toEqual(before);
 });
 test('attached image follows node, free image stays fixed after relayout',async({page})=>{
  await open(page,target);const r=await page.evaluate(()=>{const a=window.neuroMapApp,n=a.state.root.children[0];const attached={id:'a',mode:'attached',attachedNodeId:n.id,width:160,height:80,offset:{dx:17,dy:0}},free={id:'f',mode:'free',width:120,height:60,worldPos:{x:123,y:456}};a.state.images=[attached,free];return [0,50,100].map(bias=>{a.state.balanceBias=bias;a.recalculateAndRender();const m=a.layout.getLayout(n.id),p=a.renderer.resolveImageWorldRect(attached),f=a.renderer.resolveImageWorldRect(free);return {dx:p.cx-m.x,dy:p.cy-m.y,ratio:p.w/p.h,x:f.cx,y:f.cy};});});
  for(const e of r)expect(e).toEqual({dx:17,dy:0,ratio:2,x:123,y:456});
 });
 test('repeated redraw does not change pixels or geometry',async({page})=>{
  await open(page,target);const r=await page.evaluate(()=>{const a=window.neuroMapApp;a.renderer.pulse=null;const paint=()=>{const c=document.createElement('canvas');c.width=1200;c.height=900;a.renderer.render(c.getContext('2d'),{scale:.5,tx:1000,ty:850});return c.toDataURL();};const first=paint();for(let i=0;i<20;i++)a.recalculateAndRender();return {same:first===paint()};});expect(r.same).toBe(true);
 });
 if(target==='desktop'){
 test('subtree fit expands hidden ancestors and contains attached image with zero offset',async({page})=>{
  await open(page,target);const r=await page.evaluate(()=>{const a=window.neuroMapApp,n=a.state.root.children[0],child=n.children[0];n.collapsed=true;a.recalculateAndRender();a.state.images=[{id:'a',mode:'attached',attachedNodeId:child.id,width:400,height:100,offset:{dx:0,dy:0}}];a.nm612FitSubtree(child.id,{animated:false});const b=a.nm612Bounds(child.id),rect=a.renderer.resolveImageWorldRect(a.state.images[0]);return {expanded:!n.collapsed,b,rect,selected:a.state.selectedNodeId,id:child.id};});
  expect(r.expanded).toBe(true);expect(r.selected).toBe(r.id);expect(r.b.minY).toBeLessThanOrEqual(r.rect.y);expect(r.b.maxY).toBeGreaterThanOrEqual(r.rect.y+r.rect.h);
 });
 test('PDF contains valid page objects and xref offsets',async({page})=>{
  await open(page,target);const out=await capture(page,'exportPDF');expect(out.text.startsWith('%PDF-1.4')).toBe(true);
  const bytes=Buffer.from(out.bytes),body=bytes.toString('latin1'),start=Number(body.match(/startxref\s+(\d+)/)[1]);expect(body.slice(start,start+4)).toBe('xref');
  const entries=body.slice(start).split('\n').slice(3);let objects=0;for(const line of entries){const match=line.match(/^(\d{10}) 00000 n/);if(!match)break;const offset=Number(match[1]);objects++;expect(body.slice(offset,offset+30)).toMatch(new RegExp('^'+objects+' 0 obj'));}expect(objects).toBeGreaterThan(5);
 });}
});

for(const target of ['desktop','android'])test.describe(`${target} graphics raster and menus`,()=>{
 for(const density of [1,1.25,1.5,2])test(`branch thickness in physical pixels at display scale ${density}`,async({browser})=>{
  const context=await browser.newContext({deviceScaleFactor:density});const page=await context.newPage();
  try{await open(page,target);const measured=await page.evaluate(density=>{
   const a=window.neuroMapApp;a.importHierarchy({text:'Root',children:[{text:'Child',children:[]}]},{newTab:true});a.state.root.children[0].sidePinned='right';a.state.branchStyle='simple';a.state.balanceBias=100;a.state.strokeScale=3;a.recalculateAndRender();
   const g=a.renderer.computeBranchGeometry(a.state.root,a.state.root.children[0],0,1),zoom=2,c=document.createElement('canvas');c.width=1800*density;c.height=800*density;const ctx=c.getContext('2d');ctx.scale(zoom*density,zoom*density);ctx.translate(100,100);
   const widths=[],stroke=ctx.stroke.bind(ctx);ctx.stroke=()=>{widths.push(ctx.lineWidth);stroke();};const previous=a.renderer.ctx;a.renderer.ctx=ctx;try{a.renderer.drawTaperingBranch(a.state.root,a.state.root.children[0],0,1);}finally{a.renderer.ctx=previous;}
   const x=Math.round(((g.endX+g.underlineEndX)/2+100)*zoom*density),y=Math.round((g.underlineEndY+100)*zoom*density),data=ctx.getImageData(x,y-30,1,61).data;let coverage=0;
   for(let i=3;i<data.length;i+=4)coverage+=data[i]/255;
   return {coverage,widths,expected:1.35*3*zoom*density,dpr:a.renderer.dpr,actual:devicePixelRatio};
  },density);// Integrating edge alpha permits at most half a physical pixel of raster rounding.
  expect(measured.widths).toHaveLength(1);expect(measured.widths[0]).toBeCloseTo(1.35*3,6);expect(Math.abs(measured.coverage-measured.expected)).toBeLessThan(.51);expect(measured.actual).toBe(density);expect(measured.dpr).toBe(Math.min(2,density));}
  finally{await context.close();}
 });
 for(const theme of ['night','slate','ocean','paper','pearl'])test(`theme ${theme}: readable labels and matching SVG/PNG background`,async({page},info)=>{
  await open(page,target);const color=await page.evaluate(({theme,target})=>{(target==='desktop'?window.NM615:window.NeuroMapAndroidEditor).setTheme(theme);window.neuroMapApp.fitWholeMap();return getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim();},{theme,target});
  const svg=await capture(page,'exportSVG');expect(svg.text).toContain(`fill="${color}"`);
  const png=await capture(page,'exportPNG');const pixel=await page.evaluate(async bytes=>{const bmp=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;const ctx=c.getContext('2d');ctx.drawImage(bmp,0,0);return [...ctx.getImageData(0,0,1,1).data];},png.bytes);
  expect(pixel).toEqual([...color.slice(1).match(/../g).map(v=>parseInt(v,16)),255]);
  // Borderless labels have no fill; measure text against the actual canvas.
  const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const palette=await page.evaluate(()=>{const a=window.neuroMapApp,c=document.createElement('canvas'),ctx=c.getContext('2d'),fills=[],texts=[],old=a.renderer.ctx;
   ctx.fill=()=>fills.push(ctx.fillStyle);ctx.fillText=()=>texts.push(ctx.fillStyle);a.renderer.ctx=ctx;try{a.renderer.drawNode(a.state.root.children[0].children[0]);}finally{a.renderer.ctx=old;}
   const rgba=style=>{ctx.fillStyle=style;ctx.fillRect(0,0,1,1);const d=[...ctx.getImageData(0,0,1,1).data];ctx.clearRect(0,0,1,1);return d;};return {pill:fills.length?rgba(fills[0]):[0,0,0,0],text:rgba(texts[0])};
  });
  const alpha=palette.pill[3]/255,pill=palette.pill.slice(0,3).map((v,i)=>v*alpha+pixel[i]*(1-alpha));
  const a=luminance(palette.text.slice(0,3)),b=luminance(pill),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({path:info.outputPath(`${target}-${theme}.png`),animations:'disabled'});
 });
 for(const size of [{width:390,height:844},{width:844,height:390}])for(const menu of ['file','edit','insert','view'])test(`menu ${menu} stays reachable at ${size.width}x${size.height}`,async({page})=>{
  await open(page,target,size);
  if(target==='android'){
   await page.locator(menu==='insert'?'#glauka-add-open':'#glauka-options-open').click();
   const names={file:'Salva il progetto',edit:'Ripeti',view:'Aspetto della mappa'};
   if(names[menu])await expect(page.locator('#glauka-app-sheet').getByRole('button',{name:names[menu],exact:true})).toBeVisible();
  }else await page.locator('#btn-menu-'+menu).click();
  const panel=page.locator(target==='android'?'#glauka-app-sheet':'#dropdown-'+menu);await expect(panel).toBeVisible();await expect.poll(async()=>{const b=await panel.boundingBox();return b.y+b.height;}).toBeLessThanOrEqual(size.height+1);const r=await panel.boundingBox();expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(size.width+1);expect(r.y+r.height).toBeLessThanOrEqual(size.height+1);
 });
 test('summary and boundary geometry follows moved concepts and exports its brace',async({page})=>{
  await open(page,target);const result=await page.evaluate(()=>{const a=window.neuroMapApp,n=a.state.root.children[0];const summary=a.state.addSummaryForNodes(n.children.slice(0,2).map(n=>n.id));summary.text='Sintesi';n.boundary={enabled:true,title:'Raggruppamento'};a.recalculateAndRender();const before=a.layout.getLayout(summary.id);n.children[0].text='Una frase decisamente più lunga per allargare il concetto';a.recalculateAndRender();const after=a.layout.getLayout(summary.id);return {before:before.bracketGeom,after:after.bracketGeom,box:a.layout.getSubtreeBoundingBox(n,false)};});
  expect(result.before).toBeTruthy();expect(result.after).toBeTruthy();for(const v of Object.values(result.after))expect(Number.isFinite(v)).toBe(true);
  const svg=await capture(page,'exportSVG');expect(svg.text).toContain('Raggruppamento');expect(svg.text).toContain('stroke-width="2.4"');
 });
});
for(const target of ['desktop','android'])test.describe(`${target} graphics edge cases`,()=>{
 for(const zLayer of ['front','back'])test(`image hit testing follows ${zLayer} stacking order`,async({page})=>{
  await open(page,target);const r=await page.evaluate(zLayer=>{const a=window.neuroMapApp,n=a.state.root,m=a.layout.getLayout(n.id);a.state.images=[{id:'overlap',mode:'free',width:m.width+20,height:m.height+20,worldPos:{x:m.x,y:m.y},zLayer}];const p=a.renderer.worldToScreen(m.x,m.y);return {hit:a.findHit(p.x,p.y)?.item?.id,node:n.id};},zLayer);
  expect(r.hit).toBe(zLayer==='front'?'overlap':r.node);
 });
 test('1001-node map fits even when overview requires zoom below 12%',async({page})=>{
  await open(page,target,{width:390,height:844});const r=await page.evaluate(()=>{const a=window.neuroMapApp;a.importHierarchy({text:'Large',children:Array.from({length:20},(_,i)=>({text:'Branch '+i,children:Array.from({length:49},(_,j)=>({text:'Leaf '+j,children:[]}))}))},{newTab:true});a.fitWholeMap();const box=a.layout.computeBoundingBox([]),p=a.renderer.worldToScreen(box.minX,box.minY),q=a.renderer.worldToScreen(box.maxX,box.maxY);return {p,q,top:document.querySelector('.top-chrome').getBoundingClientRect().bottom,bottom:document.getElementById('mobile-dock')?.getBoundingClientRect().top||innerHeight,zoom:a.renderer.camera.zoom};});
  expect(r.zoom).toBeLessThan(.12);expect(r.p.x).toBeGreaterThanOrEqual(0);expect(r.q.x).toBeLessThanOrEqual(390);expect(r.p.y).toBeGreaterThan(r.top);expect(r.q.y).toBeLessThan(r.bottom);
 });
 test('zoom anchored at cursor preserves the pointed world coordinate',async({page})=>{
  await open(page,target);const r=await page.evaluate(()=>{const a=window.neuroMapApp,p={x:321,y:437},before=a.renderer.screenToWorld(p.x,p.y);for(const f of [1.3,.7,2,.5])a.zoomAt(f,p.x,p.y);return {before,after:a.renderer.screenToWorld(p.x,p.y)};});expect(r.after.x).toBeCloseTo(r.before.x,8);expect(r.after.y).toBeCloseTo(r.before.y,8);
 });
 test('subtree navigation includes attached image and remains centered after resize',async({page})=>{
  await open(page,target);await page.setViewportSize({width:844,height:390});const r=await page.evaluate(()=>{const a=window.neuroMapApp,n=a.state.root.children[0];a.state.images=[{id:'a',mode:'attached',attachedNodeId:n.id,width:700,height:200,offset:{dx:-250,dy:0}}];a.nmGraphicsFitSubtree(n.id);const b=a.renderer.resolveImageWorldRect(a.state.images[0]),p=a.renderer.worldToScreen(b.x,b.y),q=a.renderer.worldToScreen(b.x+b.w,b.y+b.h);return {p,q,top:document.querySelector('.top-chrome').getBoundingClientRect().bottom,bottom:document.getElementById('mobile-dock')?.getBoundingClientRect().top||innerHeight};});
  expect(r.p.x).toBeGreaterThan(0);expect(r.q.x).toBeLessThan(844);expect(r.p.y).toBeGreaterThan(r.top);expect(r.q.y).toBeLessThan(r.bottom);
 });
 test('relationship endpoints follow moved nodes and disappear when their child is hidden',async({page})=>{
  await open(page,target);const r=await page.evaluate(()=>{const a=window.neuroMapApp,[x,y]=a.state.root.children,leaf=x.children[0],rel={id:'rel',fromId:leaf.id,toId:y.id,label:'Link'};a.state.relationships=[rel];a.recalculateAndRender();a.renderer.render();a.v5ReparentNode(leaf.id,y.id,false,true);a.renderer.render();const m=a.layout.getLayout(leaf.id),c=rel._runtimeCurve,left=m.x-m.width/2,right=m.x+m.width/2,top=m.y-m.height/2,bottom=m.y+m.height/2,dx=c.x1<left?left-c.x1:c.x1>right?c.x1-right:0,dy=c.y1<top?top-c.y1:c.y1>bottom?c.y1-bottom:0,matched=!!c&&dx<=8&&dy<=8;y.collapsed=true;a.recalculateAndRender();const svg=NeuroMapGraphics.svgLayers(a.renderer);return {matched,hidden:!a.layout.getLayout(leaf.id),visible:svg.relationships.includes('Link')};});expect(r).toEqual({matched:true,hidden:true,visible:false});
 });
 test('export bounds contain long relationship labels',async({page})=>{
  await open(page,target);const r=await page.evaluate(()=>{const a=window.neuroMapApp,[x,y]=a.state.root.children,rel={id:'r',fromId:x.id,toId:y.id,label:'A very long relationship caption '.repeat(30)};a.state.relationships=[rel];a.recalculateAndRender();const c=a.renderer.computeRelationshipCurve(a.layout.getLayout(x.id),a.layout.getLayout(y.id)),ctx=a.layout.measureCtx;ctx.font='600 11.5px Inter, -apple-system, sans-serif';const w=ctx.measureText(rel.label).width+18,b=NeuroMapGraphics.bounds?NeuroMapGraphics.bounds(a):a.layout.computeBoundingBox(a.state.images);return {left:c.labelX-w/2,right:c.labelX+w/2,b};});
  expect(r.b.minX).toBeLessThanOrEqual(r.left);expect(r.b.maxX).toBeGreaterThanOrEqual(r.right);
 });
});
for(const target of ['desktop','android'])test.describe(`${target} graphics export fidelity`,()=>{
 test('PNG contains the first image even if it has not painted on screen yet',async({page})=>{
  await open(page,target);await page.evaluate(()=>{(window.NM615||window.NeuroMapAndroidEditor).setTheme('paper');const a=window.neuroMapApp,c=document.createElement('canvas');c.width=30;c.height=20;const ctx=c.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,15,20);ctx.fillStyle='#00ff00';ctx.fillRect(15,0,15,20);a.state.images=[{id:'new',src:c.toDataURL(),width:180,height:120,mode:'free',worldPos:{x:1500,y:0},aspectLocked:true}];});
  expect(await page.locator('#mindmap-canvas').evaluate(e=>getComputedStyle(e).filter)).toBe('none');
  const out=await capture(page,'exportPNG');const counts=await page.evaluate(async bytes=>{const bmp=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'})),c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;const ctx=c.getContext('2d');ctx.drawImage(bmp,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let red=0,green=0;for(let i=0;i<data.length;i+=4){if(data[i]>250&&data[i+1]<5&&data[i+2]<5)red++;if(data[i]<5&&data[i+1]>250&&data[i+2]<5)green++;}return {red,green};},out.bytes);
  expect(counts.red).toBeGreaterThan(30000);expect(counts.green).toBeGreaterThan(30000);expect(Math.abs(counts.red-counts.green)).toBeLessThan(1000);
 });
 test('export ignores selection, hover and drag indicators while preserving UI state',async({page})=>{
  await open(page,target);const r=await page.evaluate(()=>{const a=window.neuroMapApp;const paint=()=>{const c=document.createElement('canvas');c.width=1200;c.height=900;a.renderer.render(c.getContext('2d'),{scale:.5,tx:1000,ty:850});return c.toDataURL();};
   a.state.selectedNodeId=null;a.state.selectedNodeIds=[];const normal=paint(),id=a.state.root.children[0].id;a.state.selectedNodeId=id;a.state.selectedNodeIds=[id];a.state.hoveredNodeId=id;a.renderer.dragHoverNodeId=id;const decorated=paint();return {same:normal===decorated,selected:a.state.selectedNodeId,hovered:a.state.hoveredNodeId,drag:a.renderer.dragHoverNodeId,id};});
  expect(r.same).toBe(true);expect([r.selected,r.hovered,r.drag]).toEqual([r.id,r.id,r.id]);
 });
 test('wrapping never splits an emoji or combining character across lines',async({page})=>{
  await open(page,target);const r=await page.evaluate(()=>{const a=window.neuroMapApp,n=a.state.root.children[0];n.text='A'.repeat(7)+'🧠'+'B'.repeat(7)+'👨‍👩‍👧‍👦'+'C'.repeat(7)+'e\u0301';n.labelWrapChars=8;a.recalculateAndRender();const lines=a.layout.getLayout(n.id).lines;return {lines,source:n.text};});
  expect(r.lines.join('')).toBe(r.source);expect(r.lines.some(line=>line.includes('👨‍👩‍👧‍👦'))).toBe(true);expect(r.lines.some(line=>line.includes('e\u0301'))).toBe(true);for(const line of r.lines)expect(line).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
 });
});

for(const target of ['desktop','android'])test(`${target} graphics theme redraws an idle canvas immediately`,async({page})=>{
 await open(page,target);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.evaluate(()=>{const a=window.neuroMapApp,old=a.renderer.render;window.qaThemePaints=0;a.renderer.render=function(...args){window.qaThemePaints++;return old.apply(this,args);};(window.NM615||window.NeuroMapAndroidEditor).setTheme('paper');});
 await expect.poll(()=>page.evaluate(()=>window.qaThemePaints)).toBeGreaterThan(0);
});
for(const target of ['desktop','android'])for(const collapsed of [false,true])for(const style of ['neon','xmind8'])test(`${target} graphics ${style} floating island fits and exports without a spurious root edge, collapsed ${collapsed}`,async({page})=>{
 await open(page,target);const r=await page.evaluate(({collapsed,style})=>{const a=window.neuroMapApp,n=a.state.root.children[0];a.state.branchStyle=style;n.isFloating=true;n.floatingPosition={x:1800,y:500};n.collapsed=collapsed;a.recalculateAndRender();a.fitWholeMap();const m=a.layout.getLayout(n.id),p=a.renderer.worldToScreen(m.x,m.y);return {p};},{collapsed,style});
 expect(r.p.x).toBeGreaterThan(0);expect(r.p.x).toBeLessThan(1280);expect(r.p.y).toBeGreaterThan(0);expect(r.p.y).toBeLessThan(900);
 const out=await capture(page,'exportSVG');const edges=await page.evaluate(svg=>[...new DOMParser().parseFromString(svg,'image/svg+xml').querySelectorAll('path')].filter(p=>(p.getAttribute('fill')||'').startsWith('url(#branchGrad_')||p.getAttribute('fill')==='none'&&Number(p.getAttribute('stroke-width'))===1.7).length,out.text);
 expect(edges).toBe(collapsed?28:31);
});
for(const target of ['desktop','android'])test(`${target} graphics export menu reports asynchronous image export errors`,async({page})=>{
 await open(page,target);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(()=>{window.neuroMapApp.io.exportPNG=async()=>{throw Error('qa-export-image-error');};document.querySelector('[data-export="png"]').click();});
 await expect(page.locator('#toast-text')).toContainText('qa-export-image-error');expect(errors).toEqual([]);
});
