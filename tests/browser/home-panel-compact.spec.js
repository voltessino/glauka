const {test,expect}=require('@playwright/test');
async function boot(page,{width=1377,height=940,theme='prisma'}={}){
 await page.setViewportSize({width,height});
 await page.addInitScript(theme=>{
  localStorage.setItem('nm6_welcome_seen','1');
  localStorage.setItem('nm_ui_skin_v1',JSON.stringify({theme,contrast:'normal',readability:'compact'}));
  // Presentation fixture only; does not bypass the application's license verifier.
  window.neuromapDesktop={productStatus:async()=>({plan:'pro'}),readWorkspace:async()=>null,readEditorPreferences:async()=>null,readAISettings:async()=>null,readAISecret:async()=>({}),writeWorkspace:async()=>true,onExternalFile:()=>{}};
 },theme);
 await page.goto((process.env.GLAUKA_DESKTOP_TEST_URL||'http://127.0.0.1:5174/index.html'));
 await page.waitForFunction(()=>window.NeuroMapHome&&neuroMapApp.nmSettings&&neuroMapApp._nmKnowledge);
 await page.addStyleTag({content:'*{transition:none!important;animation:none!important;scroll-behavior:auto!important}'});
}
async function openPanel(page,opener){
 await page.evaluate(opener=>{
  const a=neuroMapApp;
  if(opener==='knowledge')a._nmKnowledge.open('document');
  else if(opener==='image'){
   const image=a.state.images.at(-1)||a.state.addImageItem({src:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',width:10,height:10});
   a.selectImage(image.id);
  }else document.getElementById(opener).click();
 },opener);
}
for(const size of [{width:1377,height:940},{width:900,height:700},{width:360,height:740},{width:320,height:640}])test('compact Home stays within viewport '+size.width,async({page},info)=>{
 await boot(page,size);await page.evaluate(()=>NeuroMapHome.open());
 await expect(page.locator('#nm6-welcome .nm6-eyebrow')).toHaveCount(0);
 await expect(page.locator('#nm6-welcome-small')).toHaveCount(0);
 await expect(page.locator('#nm6-welcome-privacy')).toBeVisible();
 const dimensions=await page.locator('.nm-home-screen').evaluate(e=>({width:e.getBoundingClientRect().width,scroll:e.scrollWidth,height:e.getBoundingClientRect().height,title:parseFloat(getComputedStyle(e.querySelector('h2')).fontSize)}));
 expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);expect(dimensions.title).toBeLessThanOrEqual(22);
 for(const rect of await page.locator('#nm6-welcome :is(button,input,select)').evaluateAll(es=>es.filter(e=>e.checkVisibility()).map(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right}}))){expect(rect.left).toBeGreaterThanOrEqual(0);expect(rect.right).toBeLessThanOrEqual(size.width+1)}
 if(size.width===1377){expect(dimensions.height).toBeLessThan(600);await page.screenshot({path:info.outputPath('home-compact-desktop.png')});}
 await page.locator('#nm-home-close').click();await expect(page.locator('#nm6-welcome')).toBeHidden();
});
test('recent files integrate independent pin and open commands, preserve full titles and filter',async({page},info)=>{
 await boot(page);const before=await page.evaluate(()=>{
  const a=neuroMapApp;window.__recentOpens=[];window.neuromapDesktop.openProject=async path=>{__recentOpens.push(path);return{cancelled:true}};
  a._nmAtlasArchive=Array.from({length:6},(_,i)=>({filePath:'C:/Maps/project-'+i+'.gk',originSheetIndex:0,title:i?'Project '+i:'Project with a very long name that must remain available in a tooltip',updatedAt:i+1,tabId:'saved-'+i,nodes:[{id:'n'+i,text:'Topic',depth:0}]}));
  a.createNewTab('Open project');NeuroMapHome.open();return JSON.stringify(a.state.createSnapshot());
 });
 await expect(page.locator('.nm-home-recent-item')).toHaveCount(6);
 for(const item of await page.locator('.nm-home-recent-item').all()){
  const rect=await item.boundingBox();expect(rect.height).toBeLessThan(65);
  for(const button of await item.locator('button').all())expect(await button.evaluate(e=>getComputedStyle(e).borderTopWidth)).toBe('0px');
  await expect(item.locator('[data-action="open"]')).toHaveAttribute('title',await item.locator('strong').innerText());
 }
 const pin=page.locator('.nm-home-recent-item [data-action="pin"]').first();await pin.click();
 expect(await page.evaluate(()=>__recentOpens.length)).toBe(0);await expect(page.locator('.nm-home-recent-item [data-action="pin"]').first()).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:info.outputPath('home-recents.png')});
 await page.locator('#nm-home-search').fill('very long');await expect(page.locator('.nm-home-recent-item')).toHaveCount(1);
 await page.locator('.nm-home-recent-item [data-action="open"]').click();await expect(page.locator('#nm-decision-overlay')).toBeVisible();
 await page.locator('#nm-decision-overlay').getByRole('button',{name:'Scegli file…',exact:true}).click();await expect.poll(()=>page.evaluate(()=>__recentOpens.length)).toBe(1);
 expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()))).toBe(before);
 await page.locator('#nm-home-search').fill('');await page.locator('#nm-home-open-tabs button').first().click();await expect(page.locator('#nm6-welcome')).toBeHidden();
});
for(const theme of ['prisma','graphite'])test('all compact headers have identical controls and no visible body '+theme,async({page},info)=>{
 await boot(page,{theme});
 const cases=[['v6-show-layout','.hud-bottom-left'],['nm-learn-open','#nm-learn-panel'],['nm-open-insert','#nm-insert-panel'],['nm614-open-navigation','#nm614-navigation-flyout'],['btn-toggle-inspector','#inspector-sidebar'],['btn-ai-settings','#nm-ai-studio'],['knowledge','#nm-knowledge-panel'],['image','#image-controls']];
 for(const [opener,selector]of cases){
  await openPanel(page,opener);
  const panel=page.locator(selector);await expect(panel).toBeVisible();const header=panel.locator('.nm-side-panel-heading').first();
  const actions=header.locator('.nm-panel-header-actions');await expect(actions.locator('button')).toHaveCount(2);
  const geometry=await actions.locator('button').evaluateAll(es=>es.map(e=>{const c=getComputedStyle(e),r=e.getBoundingClientRect(),s=e.querySelector('svg');return{w:r.width,h:r.height,y:r.y,radius:c.borderRadius,padding:c.padding,iconWidth:s.getBoundingClientRect().width,stroke:s.getAttribute('stroke-width')}}));
  expect(geometry[0]).toEqual(geometry[1]);expect(geometry[0].w).toBe(32);expect(geometry[0].h).toBe(32);
  const before=await panel.evaluate(e=>JSON.stringify([...e.querySelectorAll('input,select,textarea')].map(c=>({id:c.id,value:c.value,checked:c.checked}))));
  const toggle=actions.locator('button').first();await toggle.click();await expect(panel).toHaveClass(/nm-panel-compact/);
  const state=await panel.evaluate(e=>{const header=e.querySelector('.nm-side-panel-heading'),r=e.getBoundingClientRect(),h=header.getBoundingClientRect(),c=getComputedStyle(e);return{height:r.height,expected:h.height+parseFloat(c.paddingTop)+parseFloat(c.paddingBottom)+parseFloat(c.borderTopWidth)+parseFloat(c.borderBottomWidth),border:getComputedStyle(header).borderBottomWidth,body:[...e.querySelectorAll('*')].filter(el=>!header.contains(el)&&!el.contains(header)&&el.checkVisibility()).map(el=>el.id||el.tagName)}});
  expect(state.body,selector).toEqual([]);expect(state.border,selector).toBe('0px');expect(Math.abs(state.height-state.expected),selector).toBeLessThan(1);
  if(opener==='nm-open-insert')await page.screenshot({path:info.outputPath('insert-compact-'+theme+'.png')});
  await toggle.click();await expect(panel).not.toHaveClass(/nm-panel-compact/);
  expect(await panel.evaluate(e=>JSON.stringify([...e.querySelectorAll('input,select,textarea')].map(c=>({id:c.id,value:c.value,checked:c.checked}))))).toBe(before);
  await toggle.click();await actions.locator('button').last().click();await expect(panel).toBeHidden();
  await openPanel(page,opener);await expect(panel).toBeVisible();
  if(await panel.evaluate(e=>e.classList.contains('nm-panel-compact')))await toggle.click();
  expect(await panel.evaluate(e=>JSON.stringify([...e.querySelectorAll('input,select,textarea')].map(c=>({id:c.id,value:c.value,checked:c.checked}))))).toBe(before);
  await expect(actions.locator('button')).toHaveCount(2);await actions.locator('button').last().click();await expect(panel).toBeHidden();
 }
});
test('touch headers retain a 44 pixel target for both controls',async({browser})=>{
 const context=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:800,height:900}});const page=await context.newPage();try{await boot(page,{width:800,height:900});await page.locator('#nm-open-insert').click();for(const button of await page.locator('#nm-insert-panel .nm-panel-header-actions button').all()){const r=await button.boundingBox();expect(r.width).toBe(44);expect(r.height).toBe(44)}await page.evaluate(()=>NeuroMapHome.open());for(const button of await page.locator('#nm6-welcome button:visible').all())expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);}finally{await context.close()}
});
test('a reduced WordArt editor preserves its draft and keyboard focus stays on its header',async({page})=>{
 await boot(page);const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()));
 await page.locator('#nm-open-insert').click();await page.locator('#nm-insert-wordart').click();
 const panel=page.locator('#nm-wordart-dialog .nm-creative-dialog'),field=page.locator('#nm-wordart-text');await field.fill('Unsaved decorative title');
 const controls=panel.locator('.nm-panel-header-actions button');await controls.first().click();await expect(field).toBeHidden();
 await page.keyboard.press('Tab');await expect(controls.last()).toBeFocused();await page.keyboard.press('Tab');await expect(controls.first()).toBeFocused();
 await controls.first().click();await expect(field).toHaveValue('Unsaved decorative title');await expect(field).toBeVisible();
 await controls.last().click();expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()))).toBe(before);
});

for(const theme of ['prisma','graphite'])test('Home primary and selected actions retain accessible contrast '+theme,async({page},info)=>{
 await boot(page,{theme});await page.evaluate(()=>NeuroMapHome.open());
 const ratios=await page.locator('#nm6-welcome-start,#nm-home-categories [aria-pressed="true"]').evaluateAll(es=>{
  const luminance=color=>{const channels=color.match(/[\d.]+/g).slice(0,3).map(n=>{const v=Number(n)/255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722};
  return es.map(e=>{const c=getComputedStyle(e),a=luminance(c.color),b=luminance(c.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)})
 });for(const ratio of ratios)expect(ratio).toBeGreaterThanOrEqual(4.5);
 if(theme==='graphite')await page.screenshot({path:info.outputPath('home-compact-dark.png')});
});
