const {test,expect}=require('@playwright/test');

async function boot(page,width=1440){
 await page.setViewportSize({width,height:900});
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&document.getElementById('nm614-open-navigation'));
 const welcome=page.locator('#nm6-welcome-start');
 if(await welcome.isVisible().catch(()=>false))await welcome.click();
}

test('Compass path follows selected hierarchy without changing document data',async({page})=>{
 await boot(page);
 const original=await page.evaluate(()=>{
  const app=neuroMapApp;
  app.importHierarchy({text:'Anatomia',children:[
   {text:'Cuore',children:[{text:'Pericardio',children:[]}]},
   {text:'Rene',children:[]}
  ]},{newTab:true});
  app.selectNode(app.state.root.children[0].children[0].id);
  app.requestRender();
  return JSON.stringify(app.state.root);
 });
 await page.locator('#nm614-open-navigation').click();
 const firstTop=await page.locator('#nm614-navigation-flyout').evaluate(el=>el.getBoundingClientRect().top);
 await page.evaluate(()=>new Promise(requestAnimationFrame));
 const secondTop=await page.locator('#nm614-navigation-flyout').evaluate(el=>el.getBoundingClientRect().top);
 expect(Math.abs(secondTop-firstTop)).toBeLessThanOrEqual(1);
 await expect(page.locator('#nm616-nav-trail-path')).toContainText('Pericardio');
 await expect(page.locator('#nm616-nav-trail-meta')).toContainText('Livello 2');
 expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(original);
});

test('Right panel keyboard resize is bounded, persistent and UI-only',async({page})=>{
 await boot(page);
 const inspector=page.locator('#inspector-sidebar');
 if(await inspector.evaluate(el=>el.classList.contains('collapsed')))
  await page.locator('#btn-toggle-inspector').click();
 const grip=inspector.locator('.nm-panel-resize-handle');
 await expect(grip).toBeVisible();
 const headerWeight=await inspector.locator('.inspector-header strong,.inspector-header h2,.inspector-title').first().evaluate(el=>getComputedStyle(el).fontWeight);
 expect(Number(headerWeight)).toBeGreaterThanOrEqual(600);
 expect(await grip.evaluate(el=>getComputedStyle(el).position)).toBe('absolute');
 const edge=await grip.evaluate(el=>{
  const handle=el.getBoundingClientRect(),panel=el.closest('#inspector-sidebar').getBoundingClientRect(),style=getComputedStyle(el);
  return {left:handle.left-panel.left,width:style.width,padding:style.paddingLeft,margin:style.marginLeft,box:style.boxSizing};
 });
 expect(edge.left).toBeGreaterThanOrEqual(-1);
 expect(edge.left).toBeLessThanOrEqual(2);
 expect(edge.width).toBe('2px');
 expect(edge.padding).toBe('0px');
 expect(edge.margin).toBe('0px');
 expect(edge.box).toBe('border-box');
 const original=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
 await grip.focus();
 await grip.press('Home');
 await expect(grip).toHaveAttribute('aria-valuenow','340');
 await grip.press('ArrowLeft');
 await expect(grip).toHaveAttribute('aria-valuenow','360');
 await grip.press('End');
 await expect(grip).toHaveAttribute('aria-valuenow','560');
 expect(await page.evaluate(()=>localStorage.getItem('nm.workspace.inspectorWidth.v1'))).toBe('560');
 expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(original);
 await page.reload();
 await page.waitForFunction(()=>document.querySelector('#inspector-sidebar .nm-panel-resize-handle'));
 expect(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--nm-inspector-panel-width').trim())).toBe('560px');
});

test('Study quiz exposes accessible question progress',async({page})=>{
 await boot(page);
 await page.evaluate(()=>{
  neuroMapApp.importHierarchy({text:'Anatomia',children:[
   {text:'Cuore',notes:'Pompa il sangue',children:[
    {text:'Atrio destro',notes:'Riceve sangue venoso',children:[]}]},
   {text:'Rene',notes:'Filtra il sangue',children:[]}
  ]},{newTab:true});
 });
 await page.locator('#nm-learn-open').click();
 await page.getByRole('button',{name:'Quiz',exact:true}).click();
 await page.getByRole('button',{name:'Inizia quiz'}).click();
 const bar=page.locator('#nm-learn-panel progress.nm-learn-progress');
 await expect(bar).toBeVisible();
 await expect(bar).toHaveAttribute('aria-label','Posizione nel quiz');
 const values=await bar.evaluate(el=>({max:el.max,value:el.value}));
 expect(values.max).toBeGreaterThan(0);
 expect(values.value).toBeGreaterThan(0);
 expect(values.value).toBeLessThanOrEqual(values.max);
});
