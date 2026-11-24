const {test,expect}=require('@playwright/test');

test('browser tab + remains a real new-map action and View no longer duplicates distribution',async({page})=>{
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?.tabs&&document.getElementById('btn-new-tab'));
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden')));
 const add=page.locator('#btn-new-tab');
 await expect(add).toHaveText('+');
 await expect(add).toHaveAttribute('aria-label',/Nuova scheda/);
 await page.evaluate(()=>{neuroMapApp.state.updateNodeText(neuroMapApp.state.root.id,'Existing project');neuroMapApp.markChanged();});
 const start=await page.evaluate(()=>neuroMapApp.tabs.length);
 await add.click();
 await expect(page.locator('#nm6-welcome')).toBeVisible();
 await page.locator('#nm-home-new').click();
 await page.locator('#nm-home-gallery .nm-home-choice[data-view=mindmap]').click();
 await expect.poll(()=>page.evaluate(()=>neuroMapApp.tabs.length)).toBe(start+1);
 await expect(page.locator('#gl-view-distribution-control')).toBeHidden();
 await page.locator('#btn-menu-tools').click();
 await expect(page.locator('#nm-fast-canvas-toggle')).toBeAttached();
 await page.locator('#gl-settings-quick').click();
 await page.locator('#gl-settings-nav button[data-category="editor"]').click();
 await expect(page.locator('#gl-settings-body')).toContainText(/solo gli elementi visibili/i);
});

test('real version timeline previews differences and supports pinned copies without overwriting',async({page})=>{
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?.tabs&&window.GlaukaVersionHistory?.open);
 const actions=await page.evaluate(()=>{
   const calls=[];
   window.neuromapDesktop={
    ...window.neuromapDesktop,
    listProjectHistory:async()=>({filename:'Anatomia.gk',versions:[
      {id:'20261030T120000.000000000Z_'+('a'.repeat(64))+'.snap',savedAt:'2026-10-30T12:00:00Z',size:1024,pinned:false}
    ]}),
    describeProjectHistory:async()=>({supported:true,added:3,removed:1,modified:2,imagesBefore:4,imagesNow:5}),
    pinProjectHistory:async(_path,_id,pinned)=>{calls.push(['pin',pinned]);return {pinned}},
    recoverProjectHistory:async()=>{calls.push(['recover']);return {name:'Anatomia (recovered).gk'}}
   };
   const app=window.neuroMapApp;
   app.tabs.find(t=>t.id===app.activeTabId).filePath='C:/Maps/Anatomia.gk';
   window.glHistoryTestCalls=calls;
   return calls;
 });
 await page.evaluate(()=>window.GlaukaVersionHistory.open(window.neuroMapApp));
 await expect(page.locator('#gl-history-dialog')).toBeVisible();
 await expect(page.locator('#gl-history-versions button')).toHaveCount(1);
 await expect(page.locator('#gl-history-details')).toContainText('aggiunti');
 await expect(page.locator('#gl-history-details')).toContainText('modificati');
 await page.locator('#gl-history-pin').click();
 await expect(page.locator('#gl-history-versions button')).toContainText('★');
 expect(await page.evaluate(()=>window.glHistoryTestCalls)).toEqual([['pin',true]]);
 await page.locator('#gl-history-close').click();
 await expect(page.locator('#gl-history-dialog')).toBeHidden();
});
