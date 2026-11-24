const {test,expect}=require('@playwright/test');

// Reproduce the Android screenshot: the "2" priority badge belongs to node.markers,
// while the new "Nel testo" action must put a Unicode character into node.text.
for(const platform of ['android','desktop']){
  test(`${platform}: Priorità 2 can be embedded in the topic text or shown as an external badge`,async({page})=>{
    await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
    await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
    await page.waitForFunction(()=>window.neuroMapApp?.nm62OpenAssets&&window.NeuroMapMarkers);
    await page.evaluate(()=>{
      document.querySelectorAll('.nm6-shade').forEach(el=>el.classList.add('hidden'));
      neuroMapApp.importHierarchy({text:'Ciao',children:[]},{newTab:true});
      neuroMapApp.nm62OpenAssets();
    });
    const panel=page.locator('#nm-creative-library-hub');
    const placement=panel.locator('.nm-creative-symbol-placement');
    const number=panel.locator('.nm-creative-library-glyph[data-it-label="Priorità 2"]');
    await expect(panel).toBeVisible();
    await expect(placement.locator('[data-placement="text"]')).toHaveAttribute('aria-pressed','true');
    await page.evaluate(()=>GlaukaI18n.setLanguage('en'));
    await expect(placement.locator('[data-placement="text"]')).toHaveText('In text');
    await expect(placement.locator('[data-placement="badge"]')).toHaveText('On branch');
    await expect(placement).toHaveAttribute('aria-label','Symbol placement');
    await page.evaluate(()=>GlaukaI18n.setLanguage('it'));
    await expect(placement.locator('[data-placement="text"]')).toHaveText('Nel testo');


    await number.click();
    expect(await page.evaluate(()=>({
      text:neuroMapApp.state.root.text,
      markers:neuroMapApp.state.root.markers||[]
    }))).toEqual({text:'❷ Ciao',markers:[]});

    await page.evaluate(()=>neuroMapApp.undo());
    expect(await page.evaluate(()=>neuroMapApp.state.root.text)).toBe('Ciao');
    await page.evaluate(()=>neuroMapApp.redo());
    expect(await page.evaluate(()=>neuroMapApp.state.root.text)).toBe('❷ Ciao');
    await number.click();
    expect(await page.evaluate(()=>neuroMapApp.state.root.text)).toBe('Ciao');

    await placement.locator('[data-placement="badge"]').click();
    await number.click();
    expect(await page.evaluate(()=>({
      text:neuroMapApp.state.root.text,
      markers:neuroMapApp.state.root.markers||[]
    }))).toEqual({text:'Ciao',markers:['priority-2']});

    // Real serializer/importer round trip of an existing external marker.
    expect(await page.evaluate(async()=>{
      const a=neuroMapApp,payload=a.io.buildSerializedProjectPayload();
      return await a.importFiles([new File([JSON.stringify(payload)],'legacy.neuromap',{type:'application/json'})],true);
    })).toBe(1);
    await page.evaluate(()=>neuroMapApp.nm62OpenAssets());
    expect(await page.evaluate(()=>({text:neuroMapApp.state.root.text,markers:neuroMapApp.state.root.markers}))).toEqual({text:'Ciao',markers:['priority-2']});
    await placement.locator('[data-placement="badge"]').click();
    expect(await page.evaluate(()=>({text:neuroMapApp.state.root.text,markers:neuroMapApp.state.root.markers}))).toEqual({text:'Ciao',markers:['priority-2']});
    await placement.locator('[data-placement="text"]').click();
    await number.click();
    expect(await page.evaluate(()=>({
      text:neuroMapApp.state.root.text,
      markers:neuroMapApp.state.root.markers||[]
    }))).toEqual({text:'❷ Ciao',markers:[]});
    await page.evaluate(()=>neuroMapApp.undo());
    expect(await page.evaluate(()=>({text:neuroMapApp.state.root.text,markers:neuroMapApp.state.root.markers}))).toEqual({text:'Ciao',markers:['priority-2']});
    await page.evaluate(()=>neuroMapApp.redo());
    expect(await page.evaluate(async()=>{
      const a=neuroMapApp,payload=a.io.buildSerializedProjectPayload();
      return await a.importFiles([new File([JSON.stringify(payload)],'inline.neuromap',{type:'application/json'})],true);
    })).toBe(1);
    expect(await page.evaluate(()=>({text:neuroMapApp.state.root.text,markers:neuroMapApp.state.root.markers||[]}))).toEqual({text:'❷ Ciao',markers:[]});
  });
}
