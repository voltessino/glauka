const{test,expect}=require('@playwright/test');const path=require('node:path');
async function boot(page,theme='prisma'){
 await page.setViewportSize({width:1100,height:440});await page.addInitScript(theme=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm_ui_skin_v1',JSON.stringify({theme,contrast:'normal',readability:'compact'}))},theme);
 await page.goto((process.env.GLAUKA_DESKTOP_TEST_URL||'http://127.0.0.1:5174/index.html'));await page.waitForFunction(()=>window.neuroMapApp?.nmSettings);
 await page.addStyleTag({content:'*{animation:none!important;transition:none!important;scroll-behavior:auto!important}'});
}
for(const theme of ['prisma','graphite'])test('expanded panel header owns its full width and never scrolls over content '+theme,async({page},info)=>{
 await boot(page,theme);const panels=['#nm-insert-panel','#nm-learn-panel','#nm614-navigation-flyout'];
 for(const [opener,id]of [['nm-open-insert',panels[0]],['nm-learn-open',panels[1]],['nm614-open-navigation',panels[2]]]){
  await page.locator('#'+opener).click();const panel=page.locator(id);await expect(panel).toBeVisible();
  for(const other of panels.filter(p=>p!==id))await expect(page.locator(other)).toBeHidden();
  const result=await panel.evaluate(e=>{const h=e.querySelector('.nm-side-panel-heading'),b=e.querySelector(':scope>.nm-panel-body'),r=e.getBoundingClientRect(),before=h.getBoundingClientRect();b.scrollTop=1000;const after=h.getBoundingClientRect(),body=b.getBoundingClientRect();return{root:{x:r.x,y:r.y,width:r.width},header:{x:after.x,y:after.y,width:after.width},moved:after.y-before.y,bodyBelow:body.y>=after.bottom-.5,scroll:b.scrollTop,scrollable:b.scrollHeight>b.clientHeight}});
  expect(result.header.x).toBeCloseTo(result.root.x+1,0);expect(result.header.width).toBeCloseTo(result.root.width-2,0);expect(result.header.y).toBeCloseTo(result.root.y+1,0);expect(result.moved).toBe(0);expect(result.bodyBelow).toBe(true);if(result.scrollable)expect(result.scroll).toBeGreaterThan(0);else expect(result.scroll).toBe(0);
  if(opener==='nm-open-insert')await page.screenshot({path:info.outputPath('insert-scrolled-'+theme+'.png')});
  const toggle=panel.locator('.nm-panel-preview-toggle');await toggle.click();const small=await panel.boundingBox();expect(small.x).toBeCloseTo(result.root.x,0);await expect(panel.locator(':scope>.nm-panel-body')).toBeHidden();await toggle.click();
  await expect.poll(()=>panel.locator(':scope>.nm-panel-body').evaluate(e=>e.scrollTop)).toBeCloseTo(result.scroll,0);
  await panel.locator('.nm-panel-header-actions button').last().click();await expect(panel).toBeHidden();
 }
});
test('View as displays its current name and separates focus and split actions',async({page},info)=>{
 await boot(page);await page.locator('#v6-show-layout').click();const trigger=page.locator('#nm-view-picker-trigger');await expect(trigger.locator('span')).toHaveText('Mappa mentale');await expect(trigger.locator('span')).toBeVisible();
 const rect=await trigger.boundingBox();expect(rect.width).toBeGreaterThan(250);const actions=await page.locator('#nm-view-focus,#nm-view-split').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{id:e.id,x:r.x,y:r.y,right:r.right}}));const focus=actions.find(e=>e.id==='nm-view-focus'),split=actions.find(e=>e.id==='nm-view-split');expect(Math.abs(focus.y-split.y)).toBeLessThan(1);expect(focus.right).toBeLessThanOrEqual(split.x);
 await page.screenshot({path:info.outputPath('view-as.png')});await trigger.click();await page.locator('#nm-view-picker-gallery [data-view="orgchart"]').click();await expect(page.locator('#nm-view-overlay')).toBeVisible();
});
test('all secondary Tools commands have distinct semantic SVGs',async({page})=>{
 await boot(page);const icons=await page.evaluate(()=>['nm-tool-links','nm-tool-database','nm-tool-dashboard','nm-tool-quality','nm-tool-journey','nm-tool-visual-study','nm-tool-anki','nm616-compare-open'].map(id=>{const e=document.getElementById(id);return{id,count:e.querySelectorAll(':scope>svg').length,path:[...e.querySelectorAll(':scope>svg path')].map(e=>e.getAttribute('d')).join('|')}}));
 for(const icon of icons){expect(icon.count,icon.id).toBe(1);expect(icon.path.length).toBeGreaterThan(15)}expect(new Set(icons.map(i=>i.path)).size).toBe(icons.length);
});
test('recent file chips do not stretch across the Home or repeat the same filename',async({page},info)=>{
 await boot(page);await page.setViewportSize({width:1377,height:940});await page.evaluate(()=>{const a=neuroMapApp;window.neuromapDesktop={openProject:async()=>({cancelled:true})};a._nmAtlasArchive=Array.from({length:6},(_,i)=>({filePath:'C:/Maps/ist_'+i+'.gk',title:'ist_'+i,updatedAt:i+1,originSheetIndex:0,nodes:[{id:'n'+i,text:'N'}]}));NeuroMapHome.open()});
 const home=await page.locator('.nm-home-screen').boundingBox();
 await expect(page.locator('.nm-home-recent-item')).toHaveCount(6);
 const titles=[];
 for(const item of await page.locator('.nm-home-recent-item').all()){
  const r=await item.boundingBox();
  expect(r.x).toBeGreaterThanOrEqual(home.x-1);
  expect(r.x+r.width).toBeLessThanOrEqual(home.x+home.width+1);
  expect(r.height).toBeGreaterThanOrEqual(48);
  expect(r.height).toBeLessThanOrEqual(64);
  const title=await item.locator('strong').innerText();
  titles.push(title);
  await expect(item.locator('small')).not.toHaveText(title);
  await expect(item.locator('[data-action="pin"]')).toBeVisible();
 }
 expect(new Set(titles).size).toBe(titles.length);
 await page.screenshot({path:info.outputPath('recent-chips.png')});
});
test('Cloud availability follows native configuration, account and actual sync status',async({page})=>{
 await page.setContent('<div id="dropdown-file"></div>');await page.evaluate(()=>{window.GlaukaI18n={pair:(it,en)=>it};window.__cloudStatus={supported:true,google:{configured:false},dropbox:{configured:false},onedrive:{configured:false}};window.__sync=false;window.neuromapDesktop={cloudAuth:{status:async()=>__cloudStatus,getPublicConfig:async()=>({callback:'http://127.0.0.1/callback'})}};window.GlaukaCloudSync={enabled:()=>__sync,summary:async()=>({dirty:true})}});
 await page.addScriptTag({path:path.resolve('apps/desktop-shared/src/cloud_panel.js')});await page.locator('#gl-cloud-open').click();const overview=page.locator('.gl-cloud-overview');await expect(overview).toHaveAttribute('data-cloud-state','unconfigured');await expect(overview).toContainText('Cloud non disponibile');await expect(overview).toContainText('restano in locale');await expect(page.getByRole('button',{name:'Collega',exact:true})).toHaveCount(0);
 await page.evaluate(()=>__cloudStatus.google.configured=true);await page.locator('.gl-cloud-refresh').click();await expect(overview).toHaveAttribute('data-cloud-state','ready');await expect(page.getByRole('button',{name:'Collega',exact:true})).toHaveCount(1);
 await page.evaluate(()=>__cloudStatus.google.connected=true);await page.locator('.gl-cloud-refresh').click();await expect(overview).toHaveAttribute('data-cloud-state','connected');await expect(overview).toContainText('Sincronizzazione disattivata');
 await page.evaluate(()=>__sync=true);await page.locator('.gl-cloud-refresh').click();await expect(overview).toHaveAttribute('data-cloud-state','active');await expect(overview).toContainText('Modifiche in attesa');
});
test('minimap and layout miniature show physical branch continuations, without modifying data',async({page})=>{
 await boot(page);const result=await page.evaluate(()=>{const a=neuroMapApp;a.importHierarchy({text:'Root',children:[{text:'Tessuto connettivo',children:Array.from({length:40},(_,i)=>({text:'Topic '+i,children:[]}))}]},{newTab:true});a.state.root.layoutMode='clockwise';a.state.root.layoutDistribution={enabled:true,height:480,minimumHeight:480,overflowMode:'expand'};a.recalculateAndRender();const before=JSON.stringify(a.state.createSnapshot());const points=NeuroMapNavigationCore.layoutPoints(a.state.root,a.layout),branch=a.state.root.children[0].id,views=points.filter(p=>p.logicalId===branch);return{before,branch,views}});
 expect(result.views.length).toBeGreaterThan(1);expect(new Set(result.views.map(v=>v.x)).size).toBeGreaterThan(1);
 await page.locator('#v6-show-layout').click();await expect.poll(()=>page.locator('#nm-layout-mini-preview [data-logical-id="'+result.branch+'"]').count()).toBeGreaterThan(1);
 const physical=await page.evaluate(()=>document.getElementById('nm616-map')._nmProjection.nodes.filter(n=>n.logicalId===neuroMapApp.state.root.children[0].id));expect(physical.length).toBe(result.views.length);
 expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()))).toBe(result.before);
});
test('an overview safety limit cannot interrupt editing or mutate the project',async({page})=>{
 await boot(page);await page.locator('#v6-show-layout').click();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const before=await page.evaluate(()=>{window.__navigationCore=NeuroMapNavigationCore;window.NeuroMapNavigationCore={...__navigationCore,layoutPoints:()=>{throw Error('Navigation node limit exceeded')}};const before=JSON.stringify(neuroMapApp.state.createSnapshot());neuroMapApp.recalculateAndRender();return before});
 await expect(page.locator('#nm-layout-mini-preview')).toBeHidden();expect(errors).toEqual([]);expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()))).toBe(before);
 await page.evaluate(()=>{window.NeuroMapNavigationCore=__navigationCore;neuroMapApp.recalculateAndRender()});await expect(page.locator('#nm-layout-mini-preview')).toBeVisible();
});
