const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const modes=['orgchart','concept-tree','concept-network','flowchart','kanban','timeline'];
const desktop=process.env.GLAUKA_DESKTOP_TEST_URL||'http://127.0.0.1:5174/index.html';
const android=process.env.GLAUKA_ANDROID_TEST_URL||'http://127.0.0.1:5173/app/index.html';
async function load(page){await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));await page.goto(desktop);await page.waitForFunction(()=>window.NeuroMapLinkedViews);await page.evaluate(()=>NeuroMapHome?.close())}
async function fixture(page,size){return page.evaluate(size=>{
 const a=neuroMapApp,root={text:'Stability '+size,children:[]};for(let i=1;i<size;i++){const n={text:'Concept '+i+(i===3?' 🧠 <safe> & Ω':''),notes:'Keep '+i,children:[]};if(i<=8)root.children.push(n);else root.children[(i-9)%8].children.push(n)}
 a.importHierarchy(root,{newTab:true});a.state.root.layoutMode='balanced';a.state.root.layoutDistribution={enabled:false};
 const nodes=a.state.getAllNodesIncludingCollapsed().slice(1);nodes.forEach((n,i)=>{n.taskStatus=['todo','doing','done'][i%3];n.startDate='2026-11-'+String(1+i%20).padStart(2,'0');n.dueDate='2026-11-'+String(2+i%20).padStart(2,'0')});
 a.state.relationships=nodes.slice(1).map((n,i)=>({id:'relation-'+i,fromId:nodes[i].id,toId:n.id,kind:'sequence',label:i%100===0?'Explicit link':''}));a.recalculateAndRender();a.fitToScreen();
 return a.state.getAllNodesIncludingCollapsed().map(n=>n.id);
},size)}
async function content(page){return page.evaluate(()=>{const s=neuroMapApp.state,p=s.createSnapshot();delete p.root.viewMode;return JSON.stringify({root:p.root,images:p.images,relationships:p.relationships})})}
async function choosePaintedSelect(page,selector,value){
 const control=page.locator(selector);
 await control.evaluate(e=>e.scrollIntoView({block:'center'}));
 const target=await control.evaluate((e,value)=>{
  const r=e.getBoundingClientRect();
  return {x:r.x+r.width/2,y:r.y+r.height/2,index:[...e.options].findIndex(o=>o.value===value),hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e};
 },value);
 expect(target.index).toBeGreaterThanOrEqual(0);expect(target.hit).toBe(true);
 await page.mouse.click(target.x,target.y);
 await page.keyboard.press('Home');
 for(let i=0;i<target.index;i++)await page.keyboard.press('ArrowDown');
 await page.keyboard.press('Enter');
 await expect(control).toHaveValue(value);
}
test('six views produce real PNG and PDF bytes through Chromium Canvas',async({page})=>{
 await load(page);await fixture(page,10);const before=await content(page);
 for(const mode of modes){
  await page.evaluate(mode=>NeuroMapLinkedViews.setMode(neuroMapApp,mode),mode);
  for(const format of ['png','pdf']){
   const result=await page.evaluate(format=>new Promise((resolve,reject)=>{
    const a=neuroMapApp,original=a.io.triggerDownload;
    const timer=setTimeout(()=>{a.io.triggerDownload=original;reject(Error('Raster export timed out'))},10000);
    a.io.triggerDownload=async(blob,name)=>{
     clearTimeout(timer);a.io.triggerDownload=original;
     resolve({name,type:blob.type,bytes:Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0,8)),size:blob.size});
    };
    document.getElementById('nm-view-export-'+(format==='png'?'png1':'pdf')).click();
   }),format);
   expect(result.size).toBeGreaterThan(100);
   expect(result.type).toBe(format==='png'?'image/png':'application/pdf');
   expect(result.bytes.slice(0,4)).toEqual(format==='png'?[137,80,78,71]:[37,80,68,70]);
  }
 }
 expect(await content(page)).toBe(before);
});
for(const size of [10,100,500,1000])test(`linked view canonical stability at ${size} nodes and safe projection limits`,async({page},info)=>{
 test.setTimeout(120000);await load(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));const ids=await fixture(page,size),before=await content(page),samples=[];
 for(const mode of modes){
  const result=await page.evaluate(async mode=>{const start=performance.now(),ok=NeuroMapLinkedViews.setMode(neuroMapApp,mode);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {ok,ms:performance.now()-start}},mode);samples.push({mode,...result});
  expect(await content(page)).toBe(before);
  expect(result.ok).not.toBe(false);await expect(page.locator('#nm-view-overlay')).toBeVisible();
  const geometry=await page.locator('#nm-view-stage [data-node-id]').evaluateAll(cards=>cards.map(c=>({id:c.dataset.nodeId,x:parseFloat(c.style.left),y:parseFloat(c.style.top),w:parseFloat(c.style.width),h:parseFloat(c.style.height)})));
  expect(geometry.length).toBeGreaterThan(0);expect(new Set(geometry.map(g=>g.id)).size).toBe(geometry.length);
  for(const g of geometry){expect(ids).toContain(g.id);expect([g.x,g.y,g.w,g.h].every(Number.isFinite)).toBe(true)}
  if(size===10){
   const pending=page.waitForEvent('download');await page.evaluate(()=>NeuroMapLinkedViews.exportSVG(neuroMapApp));const download=await pending;
   await download.saveAs(info.outputPath(mode+'.svg'));const text=fs.readFileSync(await download.path(),'utf8');
   const svg=await page.evaluate(text=>{const doc=new DOMParser().parseFromString(text,'image/svg+xml');return {invalid:!!doc.querySelector('parsererror,script'),width:doc.documentElement.getAttribute('width'),title:doc.documentElement.querySelector('title')?.textContent,text:doc.documentElement.textContent}},text);
   expect(svg.invalid).toBe(false);expect(Number(svg.width)).toBeGreaterThan(0);expect(svg.text).toContain('🧠');
  }
 }
 await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'orgchart'));await page.locator('#nm-view-split').click();await page.locator('#nm-dual-picker').selectOption('concept-network');
 await expect(page.locator('#nm-dual-stage [data-node-id]')).toHaveCount(size);expect(await content(page)).toBe(before);
 await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'mindmap'));expect(await content(page)).toBe(before);expect(errors).toEqual([]);
 const cdp=info.project.name==='chromium'?await page.context().newCDPSession(page):null;
 let openHeap;
 if(cdp){await cdp.send('HeapProfiler.collectGarbage');openHeap=await cdp.send('Runtime.getHeapUsage')}
 await page.evaluate(()=>{const a=neuroMapApp;a.state.isDirty=false;a.closeTab(a.activeTabId)});await page.waitForFunction(()=>neuroMapApp.tabs.length===1);await expect(page.locator('#nm-view-stage [data-node-id],#nm-dual-stage [data-node-id]')).toHaveCount(0);
 if(cdp){await cdp.send('HeapProfiler.collectGarbage');const closedHeap=await cdp.send('Runtime.getHeapUsage');fs.writeFileSync(info.outputPath('heap-after-close.json'),JSON.stringify({openHeap,closedHeap}));await info.attach('heap-after-close',{body:JSON.stringify({openHeap,closedHeap}),contentType:'application/json'});await cdp.detach()}
 fs.writeFileSync(info.outputPath('render-timings.json'),JSON.stringify(samples,null,2));
 await info.attach('render-timings',{body:JSON.stringify(samples,null,2),contentType:'application/json'});
});
test('view metadata survives a real desktop → Android → desktop project roundtrip',async({page,context})=>{
 await load(page);await fixture(page,10);
 const original=await page.evaluate(()=>{const a=neuroMapApp,first=a.state.root.children[0];a.state.root.viewAppearance=NeuroMapViewAppearance.update(null,'orgchart',{preset:'corporate',orientation:'horizontal',fontSize:16});a.state.root.viewAppearance=NeuroMapViewAppearance.update(a.state.root.viewAppearance,'timeline',{timeScale:'weeks'});first.flowShape='decision';first.taskOrder=7;return a.io.buildSerializedProjectPayload()});
 const mobile=await context.newPage();await mobile.goto(android);await mobile.waitForFunction(()=>window.neuroMapApp?.io);
 const saved=await mobile.evaluate(async payload=>{const a=neuroMapApp;await a.importFiles([new File([JSON.stringify(payload)],'cross.gk')],true);a.state.pushHistory();a.state.root.text='Temporary';a.state.undo();return a.io.buildSerializedProjectPayload()},original);
 expect(saved.root.viewAppearance).toEqual(original.root.viewAppearance);expect(saved.root.children[0].flowShape).toBe('decision');expect(saved.root.children[0].taskOrder).toBe(7);
 const reopened=await page.evaluate(async payload=>{await neuroMapApp.importFiles([new File([JSON.stringify(payload)],'cross.gk')],true);return neuroMapApp.io.buildSerializedProjectPayload()},saved);
 expect(reopened.root.viewAppearance).toEqual(original.root.viewAppearance);expect(reopened.root.children[0].flowShape).toBe('decision');expect(reopened.root.children[0].taskOrder).toBe(7);await mobile.close();
});
test('appearance presets and property reset are isolated, undoable and persist across reopen',async({page})=>{
 await load(page);await fixture(page,10);await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'orgchart'));
 await page.locator('#nm-view-appearance > summary').click();
 await page.locator('#nm-view-appearance details').evaluateAll(sections=>sections.forEach(section=>{section.open=true}));
 await choosePaintedSelect(page,'#nm-view-appearance-theme','corporate');
 await choosePaintedSelect(page,'#nm-view-appearance-fontSize','18');
 expect(await page.evaluate(()=>neuroMapApp.state.root.viewAppearance.modes.orgchart.fontSize)).toBe(18);
 await page.evaluate(()=>neuroMapApp.undo());await expect(page.locator('#nm-view-appearance-fontSize')).not.toHaveValue('18');
 await page.evaluate(()=>neuroMapApp.redo());await expect(page.locator('#nm-view-appearance-fontSize')).toHaveValue('18');
 await choosePaintedSelect(page,'#nm-view-appearance-reset-property','fontSize');await page.locator('#nm-view-appearance-reset-single').click();
 expect(await page.evaluate(()=>neuroMapApp.state.root.viewAppearance.modes.orgchart.fontSize)).toBeUndefined();
 expect(await page.evaluate(()=>neuroMapApp.state.root.viewAppearance.modes.orgchart.preset)).toBe('corporate');
 await page.evaluate(()=>neuroMapApp.undo());await expect(page.locator('#nm-view-appearance-fontSize')).toHaveValue('18');
 const id=await page.evaluate(()=>{const a=neuroMapApp,id=a.state.root.children[0].id;a.selectNode(id);return id});
 await page.locator('#nm-view-appearance-node').check();await page.locator('#nm-view-appearance-accent').evaluate(el=>{el.value='#123456';el.dispatchEvent(new Event('change',{bubbles:true}))});
 expect(await page.evaluate(id=>neuroMapApp.state.root.viewAppearance.modes.orgchart.elements[id].accent,id)).toBe('#123456');
 expect(await page.evaluate(()=>neuroMapApp.state.root.viewAppearance.modes.orgchart.accent)).toBeUndefined();
 await page.locator('#nm-view-appearance-node').uncheck();
 const stored=await page.evaluate(()=>neuroMapApp.io.buildSerializedProjectPayload());
 await page.evaluate(async payload=>neuroMapApp.importFiles([new File([JSON.stringify(payload)],'appearance.gk')],true),stored);
 expect(await page.evaluate(()=>neuroMapApp.state.root.viewAppearance)).toEqual(stored.root.viewAppearance);
});

test('hiding linked stages releases cards without discarding a split inline edit',async({page})=>{
 await load(page);await fixture(page,10);await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'orgchart'));
 await page.locator('#nm-view-split').click();await page.locator('#nm-dual-picker').selectOption('concept-network');
 const id=await page.locator('#nm-dual-stage .nm-view-card').nth(1).getAttribute('data-node-id');
 const card=page.locator('#nm-dual-stage .nm-view-card[data-node-id="'+id+'"]');
 const original=await page.evaluate(id=>({text:neuroMapApp.state.findNode(id).text,history:neuroMapApp.state.undoStack.length}),id);
 await card.dblclick();await card.locator('.nm-view-edit').fill('Preserved split draft');
 await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'mindmap'));
 await expect(page.locator('#nm-view-stage [data-node-id],#nm-dual-stage [data-node-id]')).toHaveCount(0);
 expect(await page.evaluate(id=>neuroMapApp.state.findNode(id).text,id)).toBe('Preserved split draft');
 // Blur and the mode transition can share the pending snapshot or create
 // two entries. Verify the bounded transaction and its complete roundtrip,
 // rather than assuming which intermediate presentation snapshot exists.
 const steps=await page.evaluate(()=>neuroMapApp.state.undoStack.length)-original.history;
 expect(steps).toBeGreaterThanOrEqual(1);expect(steps).toBeLessThanOrEqual(2);
 for(let i=0;i<steps;i++)await page.evaluate(()=>neuroMapApp.undo());
 expect(await page.evaluate(id=>neuroMapApp.state.findNode(id).text,id)).toBe(original.text);
 for(let i=0;i<steps;i++)await page.evaluate(()=>neuroMapApp.redo());
 expect(await page.evaluate(id=>neuroMapApp.state.findNode(id).text,id)).toBe('Preserved split draft');
});

test('actual light and dark view colors are not overwritten by the workspace theme',async({page})=>{
 await load(page);await fixture(page,10);
 const presets={orgchart:'corporate','concept-tree':'academic','concept-network':'cluster',flowchart:'blueprint',kanban:'soft-saas',timeline:'roadmap'};
 for(const mode of modes)for(const preset of [presets[mode],'graphite']){
  const colors=await page.evaluate(async({mode,preset})=>{
   const a=neuroMapApp;a.state.root.viewAppearance=NeuroMapViewAppearance.update(a.state.root.viewAppearance,mode,{preset});NeuroMapLinkedViews.setMode(a,mode);NeuroMapLinkedViews.refresh(a);
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const card=document.querySelector('#nm-view-stage [data-node-id]'),scroller=document.getElementById('nm-view-scroller');
   return {card:getComputedStyle(card).color,expectedCard:card.style.color,background:getComputedStyle(scroller).backgroundColor,expectedBackground:scroller.style.backgroundColor,theme:document.body.dataset.nmSkin};
  },{mode,preset});
  expect(colors.theme).toBeTruthy();expect(colors.card).toBe(colors.expectedCard);expect(colors.background).toBe(colors.expectedBackground);
 }
});
