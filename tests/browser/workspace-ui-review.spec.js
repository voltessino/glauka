const {test,expect}=require('@playwright/test');
async function boot(page,{theme='prisma',width=1280}={}){await page.setViewportSize({width,height:900});await page.addInitScript(theme=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm_ui_skin_v1',JSON.stringify({theme,contrast:'normal',readability:'compact'}))},theme);await page.goto('http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.nmSettings&&window.neuroMapApp?._nmKnowledge);await page.addStyleTag({content:'*{transition:none!important;animation:none!important;scroll-behavior:auto!important}'});await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')))}
for(const theme of ['prisma','graphite'])test('tool windows shrink to real bars with stable titles: '+theme,async({page},info)=>{
 await boot(page,{theme});
 for(const [opener,selector,title]of [['v6-show-layout','.hud-bottom-left','.hud-title'],['nm-learn-open','#nm-learn-panel','header strong'],['nm-open-insert','#nm-insert-panel','header strong'],['nm614-open-navigation','#nm614-navigation-flyout','.nm614-fly-title strong'],['btn-toggle-inspector','#inspector-sidebar','.inspector-title']]){
  await page.evaluate(id=>document.getElementById(id).click(),opener);const panel=page.locator(selector);await expect(panel).toBeVisible();
  const heading=panel.locator(title),before=await heading.boundingBox(),toggle=panel.locator('.nm-panel-preview-toggle');await expect(toggle).toHaveCount(1);
  const expanded=await panel.boundingBox();
  const gripBox=await (opener==='v6-show-layout'
    ? page.locator('.nm-panel-resize-handle[data-nm-size-scope="layout"]')
    : panel.locator('.nm-panel-resize-handle')).boundingBox();
  if(opener==='v6-show-layout'){
   expect(expanded.x).toBeLessThan(1280/2);
   expect(expanded.x).toBeGreaterThanOrEqual(8);
   const gripRight=gripBox.x+gripBox.width;
   expect(gripRight).toBeGreaterThanOrEqual(expanded.x+expanded.width-3);
   expect(gripRight).toBeLessThanOrEqual(expanded.x+expanded.width+1);
   expect(await heading.textContent()).toBe('Disposizione della mappa');
   const titleY=before.y;
   await panel.evaluate(e=>{e.scrollTop=e.scrollHeight});
   await expect.poll(async()=>(await heading.boundingBox()).y).toBe(titleY);
   await panel.evaluate(e=>{e.scrollTop=0});
  }else{
   expect(gripBox.x).toBeGreaterThanOrEqual(expanded.x-1);
   expect(gripBox.x,selector).toBeLessThanOrEqual(expanded.x+4);
  }
  await toggle.click();
  await expect.poll(async()=>(await panel.boundingBox()).height).toBeLessThanOrEqual(84);await expect(toggle).toBeVisible();await expect(heading).toBeVisible();
  const after=await heading.boundingBox();expect(Math.abs(after.x-before.x)).toBeLessThanOrEqual(2);
  const bounds=await panel.boundingBox(),buttons=await panel.locator('.nm-side-panel-heading button').evaluateAll(items=>items.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom}}));
  for(const b of buttons){expect(b.x).toBeGreaterThanOrEqual(bounds.x);expect(b.right).toBeLessThanOrEqual(bounds.x+bounds.width+1);expect(b.y).toBeGreaterThanOrEqual(bounds.y);expect(b.bottom).toBeLessThanOrEqual(bounds.y+bounds.height+1)}
  if(opener==='v6-show-layout')await expect(page.locator('.nm-panel-resize-handle[data-nm-size-scope="layout"]')).toBeHidden();
  else await expect(panel.locator('.nm-panel-resize-handle')).toBeHidden();
  if(opener==='nm-learn-open')await page.screenshot({path:info.outputPath('study-compact-'+theme+'.png')});await toggle.click();await expect(panel).not.toHaveClass(/nm-panel-compact/);
 }
});
test('Disposizione grip stays on right without pushing its title or resizing Aspetto',async({page})=>{
 await boot(page,{width:1280});
 await page.locator('#v6-show-layout').click();
 const layout=page.locator('.hud-bottom-left');
 const grip=page.locator('.nm-panel-resize-handle[data-nm-size-scope="layout"]');
 const title=layout.locator('.hud-title');
 await expect(layout).toBeVisible();
 const frame=await layout.boundingBox(),heading=await title.boundingBox(),handle=await grip.boundingBox();
 expect(heading.y-frame.y).toBeLessThan(50);
 expect(handle.x+handle.width).toBeGreaterThanOrEqual(frame.x+frame.width-3);
 expect(handle.x+handle.width).toBeLessThanOrEqual(frame.x+frame.width+1);
 await grip.focus();
 await grip.press('ArrowRight');
 await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--nm-layout-panel-width').trim())).toBe('420px');
 expect(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--nm-inspector-panel-width').trim())).toBe('360px');
 await page.locator('#btn-toggle-inspector').click();
 const inspector=page.locator('#inspector-sidebar');
 await expect(inspector).toBeVisible();
 const appearanceGrip=inspector.locator('.nm-panel-resize-handle');
 await appearanceGrip.focus();
 await appearanceGrip.press('ArrowLeft');
 expect(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--nm-inspector-panel-width').trim())).toBe('380px');
 expect(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--nm-layout-panel-width').trim())).toBe('420px');
 await page.locator('#v6-show-layout').click();
 const again=await layout.boundingBox();
 expect(Math.abs(again.width-420)).toBeLessThanOrEqual(2);
 await layout.evaluate(el=>{el.scrollTop=el.scrollHeight});
 const movedGrip=await grip.boundingBox(),movedFrame=await layout.boundingBox();
 expect(movedGrip.x+movedGrip.width).toBeGreaterThanOrEqual(movedFrame.x+movedFrame.width-3);
 expect(movedGrip.x+movedGrip.width).toBeLessThanOrEqual(movedFrame.x+movedFrame.width+1);
});
test('insert catalogue uses compact action tiles',async({page})=>{
 await boot(page);await page.locator('#nm-open-insert').click();
 const panel=page.locator('#nm-insert-panel');await expect(panel).toBeVisible();
 const pictureGrid=panel.locator('#nm-insert-pictures .nm-insert-tool-grid');
 expect(await pictureGrid.evaluate(e=>getComputedStyle(e).gridTemplateColumns.trim().split(/\s+/).length)).toBe(3);
 const pictureCards=panel.locator('#nm-insert-pictures .nm-insert-tool-grid>button:visible');
 await expect(pictureCards).not.toHaveCount(0);
 for(const card of await pictureCards.evaluateAll(items=>items.map(e=>e.getBoundingClientRect().height)))
  expect(card).toBeLessThanOrEqual(64);
 const graphicCards=panel.locator('#nm-insert-data-graphics .nm-insert-grid>button:visible');
 for(const card of await graphicCards.evaluateAll(items=>items.map(e=>e.getBoundingClientRect().height)))
  expect(card).toBeLessThanOrEqual(52);
});
test('unchanged notes do not block switching; edited notes survive hiding and retain Undo/Redo',async({page})=>{
 await boot(page);await page.evaluate(()=>{const a=neuroMapApp;a.importHierarchy({text:'Original',children:[]},{newTab:true});a._nmKnowledge.open('outline')});
 const panel=page.locator('#nm-knowledge-panel');await panel.getByRole('button',{name:'Note…',exact:true}).click();await expect(panel.locator('textarea')).toBeVisible();
 expect(await page.evaluate(()=>neuroMapApp._nmKnowledge.hasDraft())).toBe(false);await page.locator('#nm-open-insert').click();await expect(panel).toBeHidden();
 await page.evaluate(()=>neuroMapApp._nmKnowledge.open('outline'));await panel.getByRole('button',{name:'Note…',exact:true}).click();await panel.locator('textarea').fill('Personal unsaved notes');
 await page.locator('#nm-open-insert').click();await expect(panel).toBeHidden();expect(await page.evaluate(()=>neuroMapApp.state.root.notes||'')).toBe('');
 await page.evaluate(()=>neuroMapApp._nmKnowledge.open('outline'));await expect(panel.locator('textarea')).toHaveValue('Personal unsaved notes');await panel.getByRole('button',{name:'Salva note',exact:true}).click();
 expect(await page.evaluate(()=>neuroMapApp.state.root.notes)).toBe('Personal unsaved notes');await page.evaluate(()=>neuroMapApp.undo());expect(await page.evaluate(()=>neuroMapApp.state.root.notes||'')).toBe('');await page.evaluate(()=>neuroMapApp.redo());expect(await page.evaluate(()=>neuroMapApp.state.root.notes)).toBe('Personal unsaved notes');
 expect(await page.evaluate(()=>neuroMapApp._nmKnowledge.hasDraft())).toBe(false);
});
test('draft close confirmation preserves the owner and offers save discard or continue',async({page})=>{
 await boot(page);const tab=await page.evaluate(()=>{const a=neuroMapApp,t=a.createNewTab('Draft owner');a._nmKnowledge.open('document');return t.id});
 await page.locator('#nm-kn-chapter-text').fill('Keep this draft');await page.locator('#nm-open-insert').click();await expect(page.locator('#nm-knowledge-panel')).toBeHidden();
 await page.evaluate(tab=>{window.__closingDraft=neuroMapApp.closeTab(tab)},tab);const dialog=page.locator('#nm-decision-overlay');await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Continua a modificare'}).click();expect(await page.evaluate(()=>__closingDraft)).toBe(false);
 await expect(page.locator('#nm-kn-chapter-text')).toHaveValue('Keep this draft');expect(await page.evaluate(tab=>neuroMapApp.tabs.some(t=>t.id===tab),tab)).toBe(true);
 await page.evaluate(tab=>{window.__closingDraft=neuroMapApp.closeTab(tab)},tab);await dialog.getByRole('button',{name:'Scarta',exact:true}).click();await page.evaluate(()=>__closingDraft);expect(await page.evaluate(tab=>neuroMapApp.tabs.some(t=>t.id===tab),tab)).toBe(false);
});
test('minimap contains its controls and coalesces camera-only pointer motion',async({page})=>{
 await boot(page);const map=page.locator('#nm616-map');await expect(map).toBeVisible();await page.waitForFunction(()=>document.getElementById('nm616-map')._nmProjection);
 const bounds=await page.locator('#nm616-minimap-shell').boundingBox();for(const r of await page.locator('#nm616-minimap-shell header button').evaluateAll(b=>b.map(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right}}))){expect(r.left).toBeGreaterThanOrEqual(bounds.x);expect(r.right).toBeLessThanOrEqual(bounds.x+bounds.width)}
 const box=await map.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 const result=await page.evaluate(async()=>{const a=neuroMapApp,c=document.getElementById('nm616-map'),r=c.getBoundingClientRect(),before=JSON.stringify(a.state.createSnapshot());let status=0,layouts=0,requests=0;for(const [obj,key,add]of [[a,'updateStatus',()=>status++],[a.layout,'computeLayout',()=>layouts++],[a,'requestRender',()=>requests++]]){const fn=obj[key];obj[key]=function(...args){add();return fn.apply(this,args)}}for(let i=0;i<100;i++)c.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:1,clientX:r.left+r.width*.6,clientY:r.top+r.height*.4}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return{status,layouts,requests,same:before===JSON.stringify(a.state.createSnapshot())}});await page.mouse.up();expect(result).toEqual({status:0,layouts:0,requests:1,same:true});
});

test('task menu icons are semantic SVGs without duplicate generic graphics',async({page})=>{
 await page.addInitScript(()=>{window.neuromapDesktop={readWorkspace:async()=>null,readEditorPreferences:async()=>null,readAISettings:async()=>null,readAISecret:async()=>({}),writeWorkspace:async()=>true,onExternalFile:()=>{},listProjectHistory:async()=>({versions:[]})}});
 await boot(page);
 const icons=await page.evaluate(()=>['menu-project-history','nm-tool-document','nm-tool-outline','nm-tool-sources','nm-ocr-launch','btn-flashcards','nm-tool-memory'].map(id=>{const e=document.getElementById(id);return{id,count:e?.querySelectorAll(':scope>svg').length,paths:[...e?.querySelectorAll(':scope>svg path')||[]].map(p=>p.getAttribute('d')).join('|')}}));
 for(const icon of icons){expect(icon.count,icon.id).toBe(1);expect(icon.paths.length,icon.id).toBeGreaterThan(15)}expect(new Set(icons.map(i=>i.paths)).size).toBe(icons.length);
});
test('AI work continues when hidden and tab navigation asks before discarding it',async({page})=>{
 await boot(page);const {owner,next}=await page.evaluate(()=>{const a=neuroMapApp;const owner=a.activeTabId,next=a.createNewTab('Other map').id;a.activateTab(owner);window.__aiCancels=0;const cancel=a.aiStudio.cancel.bind(a.aiStudio);a.aiStudio.cancel=()=>{__aiCancels++;return cancel()};a.aiStudio.busy=true;a.openAIStudio();return{owner,next}});
 await page.locator('#nm-open-insert').click();await expect(page.locator('#nm-ai-studio')).toBeHidden();expect(await page.evaluate(()=>__aiCancels)).toBe(0);
 await page.evaluate(()=>neuroMapApp.openAIStudio());await page.locator('#nm-ai-close').click();expect(await page.evaluate(()=>__aiCancels)).toBe(0);
 await page.locator('[data-nm69-tab-id="'+next+'"]').click();const dialog=page.locator('#nm-decision-overlay');await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Continua a modificare'}).click();expect(await page.evaluate(()=>neuroMapApp.activeTabId)).toBe(owner);expect(await page.evaluate(()=>__aiCancels)).toBe(0);
 await page.locator('[data-nm69-tab-id="'+next+'"]').click();await dialog.getByRole('button',{name:'Interrompi e continua'}).click();await expect.poll(()=>page.evaluate(()=>neuroMapApp.activeTabId)).toBe(next);expect(await page.evaluate(()=>__aiCancels)).toBe(1);
 await page.evaluate(next=>{neuroMapApp.aiStudio.busy=true;window.__aiClose=neuroMapApp.closeTab(next)},next);await dialog.getByRole('button',{name:'Continua a modificare'}).click();expect(await page.evaluate(()=>__aiClose)).toBe(false);expect(await page.evaluate(()=>neuroMapApp.aiStudio.busy)).toBe(true);expect(await page.evaluate(()=>__aiCancels)).toBe(1);
});
test('a preserved chapter draft saves only into its original open tab',async({page})=>{
 await boot(page);const owner=await page.evaluate(()=>{const a=neuroMapApp;a.createNewTab('Owner');a._nmKnowledge.open('document');return a.activeTabId});await page.locator('#nm-kn-chapter-text').fill('Owned chapter notes');
 await page.evaluate(()=>neuroMapApp.createNewTab('Other'));await page.locator('#nm-knowledge-panel').getByRole('button',{name:'Salva capitolo',exact:true}).click();
 expect(await page.evaluate(owner=>({original:neuroMapApp.tabs.find(t=>t.id===owner).state.root.notes,current:neuroMapApp.state.root.notes||''}),owner)).toEqual({original:'Owned chapter notes',current:''});
});

for(const config of [{width:960,height:640,theme:'prisma',lang:'it'},{width:1440,height:900,theme:'graphite',lang:'en'},{width:360,height:740,theme:'prisma',lang:'en'},{width:800,height:600,theme:'graphite',lang:'it'}])test('responsive headers and compact AI remain bounded '+JSON.stringify(config),async({page},info)=>{
 // The toolbar legitimately opens licensing for Free; this geometry test uses a native Pro response fixture.
 await page.addInitScript(()=>{window.neuromapDesktop={productStatus:async()=>({plan:'pro'}),readWorkspace:async()=>null,readEditorPreferences:async()=>null,readAISettings:async()=>null,readAISecret:async()=>({}),writeWorkspace:async()=>true,onExternalFile:()=>{}}});
 await boot(page,config);await expect.poll(()=>page.evaluate(()=>nmProduct.isPro())).toBe(true);await page.setViewportSize({width:config.width,height:config.height});await page.evaluate(lang=>GlaukaI18n.setLanguage(lang),config.lang);await expect(page.locator('body')).toHaveAttribute('data-nm-skin',config.theme);
 for(const [id,selector,toggle]of [['nm-learn-open','#nm-learn-panel','.nm-panel-preview-toggle'],['nm614-open-navigation','#nm614-navigation-flyout','.nm-panel-preview-toggle'],['btn-ai-settings','#nm-ai-studio','#nm-ai-minimize']]){
  await page.evaluate(id=>document.getElementById(id).click(),id);const panel=page.locator(selector);await expect(panel).toBeVisible();
  const expanded=await panel.boundingBox();expect(expanded.x).toBeGreaterThanOrEqual(0);expect(expanded.x+expanded.width).toBeLessThanOrEqual(config.width+1);
  await panel.locator(toggle).click();await expect(panel).toHaveClass(/nm-panel-compact/);const small=await panel.boundingBox();expect(small.height).toBeLessThanOrEqual(84);expect(small.y+small.height).toBeLessThanOrEqual(config.height);
  for(const r of await panel.locator('.nm-side-panel-heading button:visible').evaluateAll(items=>items.map(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom}}))){expect(r.left).toBeGreaterThanOrEqual(small.x);expect(r.right).toBeLessThanOrEqual(small.x+small.width+1);expect(r.bottom).toBeLessThanOrEqual(small.y+small.height+1)}
  if(id==='btn-ai-settings'&&config.width===1440)await page.screenshot({path:info.outputPath('ai-compact-dark-en.png')});await panel.locator(toggle).click();
 }
});
test('pending minimap movement cannot move another tab camera',async({page})=>{
 await boot(page);const box=await page.locator('#nm616-map').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 const result=await page.evaluate(async()=>{const a=neuroMapApp,c=document.getElementById('nm616-map'),r=c.getBoundingClientRect();c.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:1,clientX:r.left+r.width*.8,clientY:r.top+r.height*.2}));a.createNewTab('Other');const camera=JSON.stringify(a.renderer.camera);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return camera===JSON.stringify(a.renderer.camera)});await page.mouse.up();expect(result).toBe(true);
});

test('minimap flushes the final pointer position precisely without changing zoom',async({page})=>{
 await boot(page);await page.waitForFunction(()=>document.getElementById('nm616-map')._nmProjection);
 const results=await page.evaluate(()=>{const a=neuroMapApp,c=document.getElementById('nm616-map'),r=c.getBoundingClientRect(),rows=[];c.setPointerCapture=()=>{};for(const zoom of [.5,1,2]){a.renderer.camera.zoom=zoom;const projection=c._nmProjection,world=NeuroMapNavigationCore.minimapToWorld(projection,projection.width*.7,projection.height*.3);c.dispatchEvent(new PointerEvent('pointerdown',{button:0,pointerId:77,clientX:r.left+r.width*.5,clientY:r.top+r.height*.5}));c.dispatchEvent(new PointerEvent('pointermove',{pointerId:77,clientX:r.left+r.width*.7,clientY:r.top+r.height*.3}));c.dispatchEvent(new PointerEvent('pointerup',{pointerId:77}));rows.push({zoom:a.renderer.camera.zoom,errorX:Math.abs(a.renderer.camera.x-(innerWidth*.5-world.x*zoom)),errorY:Math.abs(a.renderer.camera.y-(innerHeight*.5-world.y*zoom))})}return rows});
 for(const [i,result]of results.entries()){expect(result.zoom).toBe([.5,1,2][i]);expect(result.errorX).toBeLessThan(.000001);expect(result.errorY).toBeLessThan(.000001)}
});
