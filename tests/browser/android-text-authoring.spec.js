const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
 await page.setViewportSize({width:393,height:852});
 await page.addInitScript(()=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale','it');});
 await page.goto('/app/index.html');
 await page.waitForFunction(()=>window.neuroMapApp && document.getElementById('glauka-style-open'));
 await page.evaluate(()=>{
  document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));
  neuroMapApp.importHierarchy({text:'Titolo',children:[{text:'Primo\nSecondo',children:[]},{text:'Altro',children:[]}]},{newTab:true});
  neuroMapApp.selectNode(neuroMapApp.state.root.children[0].id);
 });
});
test('phone text toolbar changes real selected node, preserves sibling, supports Undo and native export',async({page},info)=>{
 await page.locator('#glauka-style-open').click();
 await expect(page.locator('#nm-creative-launcher')).toBeHidden();
 await page.locator('#glauka-font-family').selectOption('Georgia');
 await page.locator('#glauka-font-size').fill('24');
 await page.locator('#glauka-font-size').dispatchEvent('change');
 await page.locator('#btn-weight-bold').click();
 await page.locator('#nm70-italic').click();
 await page.locator('#nm-text-underline').click();
 await page.locator('#glauka-font-color').fill('#8b2355');
 await page.locator('#glauka-font-color').dispatchEvent('change');
 await page.locator('#glauka-list-style').selectOption('number');
 await page.locator('#glauka-text-align').selectOption('right');
 const state=await page.evaluate(()=>({n:neuroMapApp.state.root.children[0],s:neuroMapApp.state.root.children[1],payload:JSON.stringify(neuroMapApp.io.buildSerializedProjectPayload())}));
 expect(state.n).toMatchObject({fontFamily:'Georgia',fontSize:24,fontItalic:true,fontUnderline:true,fontColor:'#8b2355',labelAlign:'right',text:'1. Primo\n2. Secondo'});
 expect(state.s.text).toBe('Altro');expect(state.s.fontFamily).not.toBe('Georgia');expect(state.payload).toContain('Georgia');
 await page.evaluate(()=>neuroMapApp.undo());
 expect(await page.evaluate(()=>neuroMapApp.state.root.children[0].labelAlign)).toBe('center');
 await page.evaluate(()=>neuroMapApp.redo());
 expect(await page.evaluate(()=>neuroMapApp.state.root.children[0].labelAlign)).toBe('right');
 await page.screenshot({path:info.outputPath('text-toolbar.png'),animations:'disabled'});
});
test('one branch thickness control and no invisible animation preview',async({page})=>{
 await page.locator('#glauka-style-open').click();
 await expect(page.locator('[data-stroke-scale],#nm-motion-preview')).toHaveCount(0);
 await expect(page.locator('#nm63-stroke-range')).toHaveCount(1);
 await page.getByText('Rami e collegamenti',{exact:true}).click();
 await page.locator('#nm63-stroke-range').fill('2');
 await page.locator('#nm63-stroke-range').dispatchEvent('input');
 await expect(page.locator('#nm63-stroke-value')).toContainText('200');
});
test('text import explains structural parsing and opens without summoning the keyboard',async({page})=>{
 await page.locator('#glauka-add-open').click();
 await page.getByRole('button',{name:'Crea una mappa dal testo'}).click();
 await expect(page.locator('#nm-android-import-title')).toHaveText('Crea una mappa dal testo');
 await expect(page.getByText('Titoli, righe, rientri ed elenchi diventano rami.',{exact:false})).toBeVisible();
 expect(await page.evaluate(()=>document.activeElement.tagName)).not.toBe('TEXTAREA');
});
test('formula insertion remains accessible from Add with the old launcher hidden',async({page})=>{
 await page.locator('#glauka-add-open').click();
 await page.getByRole('button',{name:'Formula matematica'}).click();
 await expect(page.locator('#nm-formula-dialog')).toBeVisible();
});
test('shared Android Back closes the mobile style panel before requesting app exit',async({page})=>{
 await page.locator('#glauka-style-open').click();
 await expect(page.locator('#inspector-sidebar')).toBeVisible();
 expect(await page.evaluate(()=>NeuroMapLifecycle.handleBack())).toBe('closed');
 await expect(page.locator('#inspector-sidebar')).toHaveClass(/collapsed/);
 expect(await page.evaluate(()=>neuroMapApp.state.root.text)).toBe('Titolo');
});
