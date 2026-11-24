const { test, expect } = require('@playwright/test');

async function boot(page) {
  await page.addInitScript(() => localStorage.setItem('nm6_welcome_seen','1'));
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(() => window.neuroMapApp && window.NeuroMapCreative?.libraryHub);
  await page.evaluate(() => document.querySelectorAll('.nm6-shade').forEach(el=>el.classList.add('hidden')));
}
test('one library combines markers, existing emoji, SVG and personal assets on mobile',async({page})=>{
  await boot(page);
  await page.evaluate(() => neuroMapApp.nm62OpenAssets());
  const hub=page.locator('#nm-creative-library-hub');
  await expect(hub).toBeVisible();
  await expect(hub.getByRole('tab')).toHaveCount(5);
  await expect(hub.getByRole('tab',{name:'Simboli'})).toHaveAttribute('aria-selected','true');
  await expect(hub.locator('.nm-creative-library-glyph')).not.toHaveCount(0);
  await hub.getByRole('button',{name:'α',exact:true}).click();
  expect(await page.evaluate(()=>neuroMapApp.state.root.text.endsWith('α'))).toBe(true);
  await hub.getByRole('tab',{name:'Icone'}).click();
  await expect(hub.locator('.nm-creative-library-glyph')).not.toHaveCount(0);
  await hub.locator('.nm-creative-library-glyph').first().click();
  expect(await page.evaluate(()=>!!neuroMapApp.state.root.illustration?.svg)).toBe(true);
  await hub.getByRole('tab',{name:'Illustrazioni'}).click();
  await expect(hub.locator('#nm-object-art-grid .nm-object-art-card')).toHaveCount(24);
  await hub.locator('#nm-object-art-grid [data-asset="heart"]').click();
  await hub.locator('#nm-object-art-apply').click();
  expect(await page.evaluate(()=>neuroMapApp.state.root.objectArt?.id)).toBe('heart');
  await expect(hub).toHaveCount(0);
  await page.evaluate(()=>NeuroMapCreative.libraryHub(neuroMapApp,'personal'));
  await expect(page.locator('#nm-creative-library-hub #nm-library-save')).toBeVisible();
  await page.locator('#nm-creative-library-hub-close').click();
  await expect(hub).toHaveCount(0);
});
test('opening consolidated gallery closes active drawing toolbar without changing the map',async({page})=>{
  await boot(page);
  const old=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
  await page.evaluate(()=>NeuroMapCreativeModules.drawing.drawingToolbar(neuroMapApp));
  await expect(page.locator('#nm-drawing-toolbar')).toBeVisible();
  await page.evaluate(()=>neuroMapApp.nm62OpenAssets('gallery'));
  await expect(page.locator('#nm-drawing-toolbar')).toBeHidden();
  await expect(page.locator('#nm-creative-library-hub')).toBeVisible();
  await expect(page.locator('#nm-creative-tab-icons')).toHaveAttribute('aria-selected','true');
  expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(old);
});
test('formula and drawing chrome match the selected interface skin on Android',async({page})=>{
  await boot(page);
  for(const skin of ['minimal','orbit','cyber']){
    await page.evaluate(skin=>{document.body.dataset.nmSkin=skin},skin);
    await page.evaluate(()=>NeuroMapCreative.formulaDialog(neuroMapApp));
    const formula=await page.evaluate(()=>{
      const panel=document.querySelector('#nm-formula-dialog .nm-creative-dialog');
      const swatch=document.createElement('span');
      swatch.style.background=getComputedStyle(document.body).getPropertyValue('--nm-skin-surface');
      document.body.append(swatch);
      const expected=getComputedStyle(swatch).backgroundColor;
      swatch.remove();
      return {actual:getComputedStyle(panel).backgroundColor,expected};
    });
    expect(formula.actual).toBe(formula.expected);
    await page.locator('#nm-formula-dialog-close').click();
    await page.evaluate(()=>NeuroMapCreativeModules.drawing.drawingToolbar(neuroMapApp));
    const drawing=await page.evaluate(()=>{
      const panel=document.querySelector('#nm-drawing-toolbar');
      const swatch=document.createElement('span');
      swatch.style.background=getComputedStyle(document.body).getPropertyValue('--nm-skin-surface');
      document.body.append(swatch);
      const expected=getComputedStyle(swatch).backgroundColor;
      swatch.remove();
      return {actual:getComputedStyle(panel).backgroundColor,expected};
    });
    expect(drawing.actual).toBe(drawing.expected);
    await page.evaluate(()=>NeuroMapCreativeModules.drawing.stopDrawing(neuroMapApp));
  }
});
