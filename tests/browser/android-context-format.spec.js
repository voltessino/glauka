const {test,expect}=require('@playwright/test');
async function boot(page,language='it'){await page.setViewportSize({width:393,height:852});await page.addInitScript(language=>{localStorage.setItem('nm6_locale',language);localStorage.setItem('nm6_welcome_seen','1');},language);await page.goto('/app/index.html');await page.waitForFunction(()=>window.GlaukaAndroidStylePanel&&window.GlaukaMobileShell);await page.evaluate(()=>{const a=neuroMapApp;document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden'));a.importHierarchy({text:'Progetto',children:[{text:'Save',children:[{text:'Dettaglio',children:[]}]},{text:'Altro ramo',children:[]}]},{newTab:true});const r=a.state.root;for(const [n,size]of [[r,15],[r.children[0],16],[r.children[0].children[0],18],[r.children[1],20]]){n.fontSize=size;n.fontFamily='Arial';}a.selectNode(r.children[0].id);});}
test('selection toolbar has readable labels and formatting never inherits a whole-map target',async({page},info)=>{
 await boot(page);const bar=page.locator('#gl-mobile-node-actions');await expect(bar).toBeVisible();await expect(bar.locator('button span')).toHaveText(['Figlio','Modifica','Formato','Elimina']);
 await page.evaluate(()=>{const t=document.getElementById('nm-format-target');if(t)t.value='all';});
 await bar.locator('.gl-node-style').click();const panel=page.locator('#gl-android-style-overlay');await expect(panel).toContainText('Formato del concetto');await expect(panel.locator('.gl-android-style-gallery,.gl-android-style-finishing')).toHaveCount(0);
 await panel.getByRole('spinbutton',{name:'Dimensione del testo',exact:true}).fill('27');await panel.getByRole('spinbutton').press('Tab');
 let result=await page.evaluate(()=>{const r=neuroMapApp.state.root;return {root:r.fontSize,chosen:r.children[0].fontSize,child:r.children[0].children[0].fontSize,other:r.children[1].fontSize};});expect(result).toEqual({root:15,chosen:27,child:18,other:20});
 await panel.getByRole('combobox',{name:'Applica a',exact:true}).selectOption('branch');await panel.getByRole('combobox',{name:'Carattere',exact:true}).selectOption('Georgia');
 expect(await page.evaluate(()=>{const r=neuroMapApp.state.root;return [r.fontFamily,r.children[0].fontFamily,r.children[0].children[0].fontFamily,r.children[1].fontFamily];})).toEqual(['Arial','Georgia','Georgia','Arial']);
 await page.screenshot({path:info.outputPath('node-format.png')});await panel.getByRole('button',{name:'Chiudi',exact:true}).click();
 await page.evaluate(()=>neuroMapApp.undo());expect(await page.evaluate(()=>neuroMapApp.state.root.children[0].fontFamily)).toBe('Arial');
 await page.screenshot({path:info.outputPath('labelled-node-actions.png')});
});
test('map presets and interface preferences are separate from node formatting',async({page})=>{
 await boot(page);await page.evaluate(()=>GlaukaAndroidStylePanel.open());let panel=page.locator('#gl-android-style-overlay');await expect(panel.locator('.gl-android-style-gallery')).toBeHidden();await panel.locator('#gl-android-map-style-picker>summary').click();await expect(panel.locator('.gl-android-style-gallery')).toBeVisible();await expect(panel.locator('.gl-node-format-controls,.gl-android-style-finishing')).toHaveCount(0);await panel.getByRole('button',{name:'Chiudi',exact:true}).click();
 const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));await page.locator('#glauka-options-open').click();await page.getByRole('button',{name:'Aspetto dell’interfaccia',exact:true}).click();await expect(panel.locator('.gl-android-style-finishing')).toBeVisible();await expect(panel.locator('.gl-node-format-controls,.gl-android-style-gallery')).toHaveCount(0);await panel.getByRole('combobox',{name:'Accento',exact:true}).selectOption('cyan');expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(before);
});
for(const width of [320,393])test(`AI is directly visible and the header fits at ${width}px`,async({page},info)=>{
 await boot(page);await page.setViewportSize({width,height:852});await expect(page.locator('#glauka-ai-open')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('#glauka-ai-open').click();await expect(page.locator('#nm-ai-studio')).toBeVisible();await page.screenshot({path:info.outputPath('visible-ai-entry.png')});
});

test('a stale node formatting panel cannot modify another selection and Android Back closes it',async({page})=>{
 await boot(page);await page.locator('.gl-node-style').click();const panel=page.locator('#gl-android-style-overlay');
 await page.evaluate(()=>neuroMapApp.selectNode(neuroMapApp.state.root.children[1].id));const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
 await panel.getByRole('combobox',{name:'Carattere',exact:true}).selectOption('Georgia');expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(before);
 expect(await page.evaluate(()=>GlaukaMobileShell.back())).toBe(true);await expect(panel).toHaveCount(0);
});

test('context formatting translates to English without translating authored concepts',async({page})=>{
 await boot(page,'en');await page.locator('.gl-node-style').click();const panel=page.locator('#gl-android-style-overlay');
 await expect(panel.locator('h2')).toHaveText('Concept formatting');await expect(panel.locator('.gl-node-format-target')).toHaveText('Save');
 expect(await panel.innerText()).not.toMatch(/Modifiche riguardano|Dimensione del testo|Carattere|sottorami/);
 await expect(page.locator('#glauka-ai-open')).toHaveText('AI');
});
