const {test,expect}=require('@playwright/test');
for(const platform of ['desktop','android']){
  test(`${platform} background palette stays in Style and remembers the chosen swatch`,async({page},testInfo)=>{
    const mobile=platform==='android';
    await page.setViewportSize(mobile?{width:390,height:844}:{width:1366,height:900});
    await page.goto(mobile?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
    await page.waitForFunction(()=>window.neuroMapApp && window.NeuroMapThemePicker);
    await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
    const openStyle=async()=>{
      if(mobile){
        await page.locator('#glauka-style-open').click();
        await expect.poll(()=>page.locator('#inspector-sidebar').evaluate(el=>el.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
        await page.locator('#inspector-sidebar .glauka-map-background > summary').click();
        expect(await page.locator('.nm-theme-picker').evaluate(el=>!!el.closest('.glauka-map-background'))).toBe(true);
      }else{
        await page.locator('#gl-settings-quick').click();
        await page.locator('#gl-settings-nav button[data-category="appearance"]').click();
        await page.locator('#gl-format-map-canvas').scrollIntoViewIfNeeded();
        expect(await page.locator('.nm-theme-picker').evaluate(el=>!!el.closest('#gl-settings-center'))).toBe(true);
        expect(await page.locator('.nm-theme-picker').evaluate(el=>!!el.closest('#inspector-sidebar'))).toBe(false);
      }
    };
    await expect(page.locator('#nm614-right-dock select, #nm614-right-dock .nm-theme-picker, #mobile-dock select, #mobile-dock .nm-theme-picker')).toHaveCount(0);
    await openStyle();
    await expect(page.locator('.nm-build-revision')).toHaveCount(0);
    const picker=page.locator('#nm-map-background-picker');
    const trigger=page.locator('#nm-map-background-trigger');
    const group=page.getByRole('radiogroup',{name:'Sfondo mappa',exact:true});
    if(mobile){
      await expect(trigger).toBeVisible();
      await expect(picker).not.toHaveAttribute('open','');
      await trigger.click();
    }
    await expect(group).toBeVisible();
    if(!mobile){
      await expect(group.getByRole('radio')).toHaveCount(10);
      await page.getByRole('button',{name:'Mostra tutti',exact:true}).click();
    }
    await expect(group.getByRole('radio')).toHaveCount(25);
    await expect(page.locator('#nm615-theme-top, #nm615-theme, #nm-android-theme')).toHaveCount(0);
    await group.getByRole('radio',{name:'Oceano',exact:true}).click();
    if(mobile)await expect(picker).not.toHaveAttribute('open','');
    else await expect(picker).toHaveAttribute('open','');
    await expect(trigger).toContainText('Oceano');
    if(mobile)await trigger.click();
    await expect(group.getByRole('radio',{name:'Oceano',exact:true})).toHaveAttribute('aria-checked','true');
    const layout=await group.evaluate(el=>{
      const bounds=el.getBoundingClientRect();
      return [...el.querySelectorAll('button')].every(button=>{
        const r=button.getBoundingClientRect();return r.width>=44 && r.height>=44 && r.left>=bounds.left-1 && r.right<=bounds.right+1;
      });
    });
    expect(layout).toBe(true);
    await page.screenshot({path:testInfo.outputPath(platform+'-background.png'),animations:'disabled'});
    await page.reload();
    await page.waitForFunction(()=>window.neuroMapApp && window.NeuroMapThemePicker);
    await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
    await openStyle();
    if(mobile)await page.locator('#nm-map-background-trigger').click();
    const selected=page.getByRole('radio',{name:'Oceano',exact:true});
    await expect(selected).toHaveAttribute('aria-checked','true');
    const before=await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root));
    for(const key of ['Enter','Space','Tab','a']){
      if(!await selected.isVisible())await trigger.click();
      await selected.focus();await page.keyboard.press(key);
      expect(await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root))).toBe(before);
    }
    if(!await selected.isVisible())await trigger.click();
    await selected.focus();await page.keyboard.press('End');
    await expect(page.getByRole('radio',{name:'Crema',exact:true})).toHaveAttribute('aria-checked','true');
    await page.evaluate(async ()=>{await GlaukaI18n.setLanguage('en');});
    if(await trigger.isVisible() && await page.locator('#nm-map-background-picker').getAttribute('open')===null)await trigger.click();
    await expect(page.getByRole('radiogroup',{name:'Map background',exact:true})).toBeVisible();
    await expect(page.getByRole('radio',{name:'Cream',exact:true})).toHaveAttribute('aria-checked','true');
  });
}
