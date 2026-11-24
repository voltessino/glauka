const {test,expect}=require('@playwright/test');
test('Android node format keeps word-processor controls compact and edits only the selected node',async({page},info)=>{
 await page.setViewportSize({width:393,height:852});
 await page.goto('http://127.0.0.1:5173/app/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&window.GlaukaAndroidStylePanel);
 await page.evaluate(async()=>{await GlaukaI18n.setLanguage('it');document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));const a=neuroMapApp;a.selectNode(a.state.root.children[0].id);GlaukaAndroidStylePanel.openNode();});
 const bar=page.locator('.gl-node-word-toolbar');await expect(bar).toBeVisible();
 const positions=await bar.locator('.gl-node-emphasis button').evaluateAll(bs=>bs.map(b=>({text:b.textContent,label:b.getAttribute('aria-label'),y:b.getBoundingClientRect().y})));
 // Toolbar glyphs are intentionally compact and language-neutral; the accessible
 // button names remain localized and must match the user's UI language.
 expect(positions.map(p=>p.text)).toEqual(['G','C','S','S']);
 expect(positions.map(p=>p.label)).toEqual(['Grassetto','Corsivo','Sottolineato','Barrato']);
 expect(new Set(positions.map(p=>p.y)).size).toBe(1);
 await bar.getByRole('button',{name:'Grassetto',exact:true}).click();
 await bar.getByRole('button',{name:'Corsivo',exact:true}).click();
 await bar.getByRole('button',{name:'Destra',exact:true}).click();
 await bar.getByRole('spinbutton',{name:'Dimensione del testo'}).fill('24');await bar.getByRole('spinbutton',{name:'Dimensione del testo'}).press('Tab');
 const selected=await page.evaluate(()=>{const a=neuroMapApp,n=a.state.findNode(a.state.selectedNodeId);return {bold:n.fontWeight,italic:n.fontItalic,align:n.labelAlign,size:n.fontSize,root:a.state.root.fontWeight};});
 expect(selected).toMatchObject({bold:700,italic:true,align:'right',size:24});expect(selected.root).not.toBe(700);
 expect(await bar.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('android-word-format.png')});
});
test('shared Windows and Mac inspector retains compact emphasis controls',async({page})=>{
 await page.goto('http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp&&document.getElementById('nm-text-emphasis'));
 const labels=await page.locator('#nm-text-emphasis [data-nm-format]').allTextContents();expect(labels.every(s=>s.trim().length===1)).toBe(true);expect(labels.length).toBeGreaterThanOrEqual(3);
});
