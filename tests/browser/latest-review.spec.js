const {test,expect}=require('@playwright/test');
async function open(page,android=false,width=1440){
 await page.setViewportSize({width,height:900});
 await page.goto(android?(process.env.NEUROMAP_REVIEW_ANDROID_URL||'http://127.0.0.1:5173/app/index.html'):(process.env.NEUROMAP_REVIEW_DESKTOP_URL||'http://127.0.0.1:5174/index.html'));
 await page.waitForFunction(()=>window.neuroMapApp);
 await page.evaluate(()=>{
  document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));
  const a=neuroMapApp;
  a.importHierarchy({text:'Original title',children:[{text:'Alpha',children:[{text:'Shared',children:[]}]},{text:'Beta',children:[{text:'Shared',children:[]}]}]},{newTab:true});
  a.selectNode(a.state.root.children[0].id);
 });
}
async function snapshot(page){return page.evaluate(()=>JSON.stringify({root:neuroMapApp.state.root,images:neuroMapApp.state.images,undo:neuroMapApp.state.undoStack.length}));}
test('comparison dialog isolates Delete and clipboard paste from the map',async({page})=>{
 await open(page);
 const before=await snapshot(page);
 await page.evaluate(()=>NeuroMapComparison.open(neuroMapApp));
 await page.locator('#nm616-compare-close').focus();
 await page.keyboard.press('Delete');
 expect(await snapshot(page)).toBe(before);
 await page.evaluate(()=>(()=>{const data=new DataTransfer();data.setData('text/plain','Unexpected pasted branch');document.getElementById('nm616-compare-close').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:data}));})());
 expect(await snapshot(page)).toBe(before);
 const selected=await page.evaluate(()=>neuroMapApp.state.selectedNodeId);
 await page.mouse.click(4,450);
 expect(await page.evaluate(()=>neuroMapApp.state.selectedNodeId)).toBe(selected);
});
test('image preview isolates typing and Delete from underlying nodes',async({page})=>{
 await open(page);
 await page.evaluate(()=>{
  const a=neuroMapApp;a.state.images.push({id:'preview',src:'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',mode:'free',worldPos:{x:20,y:20},width:100,height:80});
  a.recalculateAndRender();a.selectImage('preview');NeuroMapPresentation.openImage(a);
 });
 await page.waitForFunction(()=>neuroMapApp.state.findImage('preview')?.naturalWidth===1);
 const before=await snapshot(page);
 await page.locator('#nm616-image-close').focus();
 await page.keyboard.press('Delete');await page.keyboard.press('x');
 expect(await snapshot(page)).toBe(before);
 expect(await page.evaluate(()=>neuroMapApp.editorNodeId)).toBeFalsy();
});
test('minimap Enter fits the map without creating a sibling',async({page})=>{
 await open(page);const before=await snapshot(page);
 await page.locator('#nm616-map').focus();await page.keyboard.press('Enter');
 expect(await snapshot(page)).toBe(before);
});
test('new desktop workspaces follow IT to EN to IT without translating map labels',async({page})=>{
 await open(page);
 await page.evaluate(()=>NeuroMapComparison.open(neuroMapApp));
 for(const lang of ['en','it']){
  await page.evaluate(async lang=>{await GlaukaI18n.setLanguage(lang);neuroMapApp.requestRender();},lang);
  await expect(page.locator('#nm616-compare-close')).toContainText(lang==='en'?'Close':'Chiudi');
  await expect(page.locator('#nm616-compare-depth option[value="2"]')).toHaveText(lang==='en'?'Two levels':'Due livelli');
  await expect(page.locator('#nm616-minimap-shell header span')).toHaveText(lang==='en'?'Minimap':'Minimappa');
  await expect(page.locator('#nm616-zen-exit')).toContainText(lang==='en'?'Leave Zen':'Esci da Zen');
  await expect(page.locator('#nm616-compare-left h3')).toHaveText('Alpha');
 }
});
for(const width of [360,390,768])test(`Android integrated commands and persistent appearance at ${width}px`,async({page})=>{
 await open(page,true,width);await page.evaluate(async()=>{await GlaukaI18n.setLanguage('en')});
 const commands=async()=>{await page.locator('#glauka-options-open').click();await page.locator('#glauka-app-sheet').getByRole('button',{name:'All commands',exact:true}).click();};
 await expect(page.locator('#glauka-options-open')).toBeVisible();
 await expect(page.locator('#nm-orbit-stylesheet')).toHaveCount(0);
 const initial=await snapshot(page);await commands();
 await page.locator('#nm-android-command-query').fill('Style panel');await page.locator('#nm-android-command-query').press('Enter');
 await expect(page.locator('#nm-android-command-overlay')).toBeHidden();
 await expect(page.locator('#inspector-sidebar')).not.toHaveClass(/collapsed/);expect(await snapshot(page)).toBe(initial);
 await page.evaluate(()=>GlaukaAndroidStylePanel.openInterface());
 await page.locator('#gl-android-style-overlay').getByRole('combobox',{name:'Accent',exact:true}).selectOption('cyan');
 await expect(page.locator('body')).toHaveAttribute('data-gl-android-accent','cyan');
 expect(await snapshot(page)).toBe(initial);await page.locator('.gl-android-style-close').click();
 await page.locator('#glauka-style-scrim').click({position:{x:4,y:4}});
 await expect(page.locator('#inspector-sidebar')).toHaveClass(/collapsed/);
 await commands();await page.locator('#nm-android-command-query').fill('nonexisting-action');await expect(page.locator('.nm-android-command-empty')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('#nm-android-command-overlay')).toBeHidden();
 for(const [locale,label] of [['it','Opzioni'],['en','Options']]){await page.evaluate(async locale=>{await GlaukaI18n.setLanguage(locale)},locale);await expect(page.locator('#glauka-options-open')).toHaveAccessibleName(label);}
 await page.reload();await page.waitForFunction(()=>window.neuroMapApp);
 await expect(page.locator('body')).toHaveAttribute('data-gl-android-accent','cyan');
 await expect(page.locator('#nm-orbit-stylesheet')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
