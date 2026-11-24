const {test,expect}=require('@playwright/test');
async function open(page,width,orbit=false){
 await page.setViewportSize({width,height:900});
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.NeuroMapOrbit&&window.neuroMapApp&&document.getElementById('nm-workspace-rail'));
 await page.evaluate(orbit=>{
  document.querySelectorAll('.nm6-shade').forEach(el=>el.classList.add('hidden'));
  NeuroMapOrbit.set({enabled:orbit});
  const a=neuroMapApp;a.importHierarchy({text:'Centro',children:[{text:'Un ramo dal titolo molto lungo che non deve coprire i comandi',children:[{text:'Dettaglio',children:[]}]},{text:'Secondo',children:[]}]},{newTab:true});
  a.selectNode(a.state.root.children[0].id);
 },orbit);
 await page.locator('#nm614-open-navigation').click();
 await expect(page.locator('#nm616-context')).toBeVisible();
}
for(const width of [390,900,1440])for(const orbit of [false,true])test(`compact header ${width}px, Orbit ${orbit}: no floating bars or overflow`,async({page})=>{
 await open(page,width,orbit);
 await expect(page.locator('#nm-workspace-rail')).toBeHidden();
 await expect(page.locator('#nm616-nav-disclosure>summary')).toBeHidden();
 await expect(page.locator('#nm616-nav-focus')).toBeVisible();
 const card=await page.locator('.nm616-nav-card').boundingBox();expect(card.x+card.width).toBeLessThanOrEqual(width);
 await page.locator('#nm616-nav-focus').click();
 await expect(page.locator('#nm616-nav-focus')).toHaveAttribute('aria-pressed','true');
 await page.keyboard.press('Escape');await expect(page.locator('#nm616-nav-focus')).toBeHidden();
 const before=await page.evaluate(()=>({root:JSON.stringify(neuroMapApp.state.root),undo:neuroMapApp.state.undoStack.length}));
 await page.locator('#nm614-open-navigation').click();await page.locator('#btn-toggle-inspector').focus();await page.keyboard.press('Enter');
 await expect(page.locator('#inspector-sidebar')).not.toHaveClass(/collapsed/);
 expect(await page.evaluate(()=>({root:JSON.stringify(neuroMapApp.state.root),undo:neuroMapApp.state.undoStack.length}))).toEqual(before);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width<=850)await expect(page.locator('#nm616-minimap-shell')).toBeHidden();
 else{const radar=await page.locator('#nm616-minimap-shell').boundingBox(),inspector=await page.locator('#inspector-sidebar').boundingBox();if(radar)expect(radar.x+radar.width).toBeLessThanOrEqual(inspector.x);}
});
test('typography profile stays below sticky settings while scrolling, menu still works',async({page})=>{
 await open(page,1440,true);await page.locator('#btn-toggle-inspector').click();
 const hierarchy=page.locator('.nm70-inspector-accordion').filter({has:page.locator('#v6-preset-wrap')});
 await hierarchy.locator('summary').first().click();
 await page.locator('#v6-preset-trigger').scrollIntoViewIfNeeded();
 await page.locator('#v6-preset-trigger').click();await expect(page.locator('#v6-preset-menu')).toBeVisible();
 await page.locator('[data-v6-preset="balanced"]').click();
 expect(await page.evaluate(()=>neuroMapApp.state.typographyPreset)).toBe('balanced');
 const result=await page.evaluate(()=>{
  const sidebar=document.getElementById('inspector-sidebar'),preset=document.getElementById('v6-preset-wrap'),bar=document.getElementById('nm-settings-style');
  sidebar.scrollTop=preset.offsetTop;
  return Number(getComputedStyle(preset).zIndex)<Number(getComputedStyle(bar).zIndex);
 });expect(result).toBe(true);
 const box=await page.locator('#nm-settings-style').boundingBox();
 expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('#nm-settings-style')!==null,{x:box.x+box.width/2,y:box.y+box.height/2})).toBe(true);
});
test('compact controls follow language changes and Zen restores their header location',async({page})=>{
 await open(page,1440);await page.evaluate(()=>{document.documentElement.lang='en';neuroMapApp.requestRender();});
 await expect(page.locator('#nm616-nav-disclosure > summary')).toBeHidden();
 await expect(page.locator('#btn-toggle-inspector')).toHaveAttribute('aria-label',/Format/i);
 await page.locator('#btn-menu-view').click();await page.locator('#nm616-zen-switch').click();await expect(page.locator('#nm616-nav-disclosure > summary')).toBeHidden();
 await page.locator('#nm616-zen-exit').click();
 await expect(page.locator('#nm-workspace-rail')).toBeHidden();
});
test('deleting a sibling preserves attachments and links inside a collapsed branch',async({page})=>{
 await open(page,1440);
 const result=await page.evaluate(()=>{
  const a=neuroMapApp,kept=a.state.root.children[0],hidden=kept.children[0],other=a.state.root.children[1];
  kept.collapsed=true;
  a.state.images.push({id:'hidden-photo',mode:'attached',attachedNodeId:hidden.id,src:'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',width:50,height:50});
  a.state.relationships.push({id:'hidden-link',fromId:kept.id,toId:hidden.id});
  a.recalculateAndRender();a.selectNode(other.id);a.deleteSelected();
  return {image:a.state.images.some(i=>i.id==='hidden-photo'),link:a.state.relationships.some(r=>r.id==='hidden-link'),hidden:!!a.state.findNode(hidden.id),deleted:!a.state.findNode(other.id)};
 });expect(result).toEqual({image:true,link:true,hidden:true,deleted:true});
});
test('flashcard edits while saving stay dirty until a second save writes them',async({page})=>{
 await open(page,1440);
 const result=await page.evaluate(async()=>{
  const a=neuroMapApp,tab=a.tabs.find(t=>t.id===a.activeTabId);
  a.studyCards=[{id:'race-card',sourceTabId:tab.id,sourceNodeId:a.state.root.id,question:'Q',answer:'Old'}];
  let release,written;
  window.neuromapDesktop={saveProject:request=>{written=JSON.parse(request.json);return new Promise(resolve=>release=()=>resolve({path:'C:/maps/test.neuromap',name:'test.neuromap'}));}};
  const first=a.saveToFile();
  while(!release)await new Promise(r=>setTimeout(r,0));
  a.studyCards[0].answer='New';release();await first;
  const dirty=tab.state.isDirty,firstAnswer=written.studyCards[0].answer;
  release=null;const second=a.saveToFile();while(!release)await new Promise(r=>setTimeout(r,0));release();await second;
  return {dirty,firstAnswer,secondAnswer:written.studyCards[0].answer,clean:!tab.state.isDirty};
 });expect(result).toEqual({dirty:true,firstAnswer:'Old',secondAnswer:'New',clean:true});
});

test('linked view windows stay below the actual header height',async({page})=>{
 await open(page,900,true);
 await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'orgchart'));
 await expect(page.locator('#nm-view-overlay')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.getElementById('nm-view-overlay').getBoundingClientRect().top-document.querySelector('.top-chrome').getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(7);
 await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'mindmap'));
 if(!await page.locator('#nm614-navigation-flyout').isVisible())await page.locator('#nm614-open-navigation').click();
 await expect(page.locator('#nm616-context')).toBeVisible();
});

test('global Save shortcuts still work while compact toolbar buttons have focus',async({page})=>{
 await open(page,1440);
 await page.evaluate(()=>{window.headerSaves=0;neuroMapApp.saveToFile=async()=>{headerSaves++;return {ok:true};};});
 await page.locator('#btn-toggle-inspector').focus();await page.keyboard.press('Control+s');
 await expect.poll(()=>page.evaluate(()=>headerSaves)).toBe(1);
 await page.locator('#nm614-open-navigation').focus();await page.keyboard.press('Meta+s');
 await expect.poll(()=>page.evaluate(()=>headerSaves)).toBe(2);
});
