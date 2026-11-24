const {test,expect}=require('@playwright/test');

async function boot(page){
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.NeuroMapUISkin?.set&&window.neuroMapApp);
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
}

test('Prisma Vivo is the classic UI; old blue is separately named',async({page})=>{
 await boot(page);
 const initial=await page.evaluate(()=>({
  theme:NeuroMapUISkin.get().theme,visible:document.body.dataset.nmSkin,
  label:NeuroMapUISkin.themes.find(t=>t.id==='prisma').it,
  blue:NeuroMapUISkin.themes.find(t=>t.id==='orbit').it,
  color:getComputedStyle(document.body).getPropertyValue('--nm-skin-ink').trim(),
 }));
 expect(initial).toMatchObject({theme:'prisma',visible:'prisma',label:'White — Prisma Vivo',blue:'Orbit'});
 expect(initial.color).toBe('#1b2140');
 await page.evaluate(()=>NeuroMapUISkin.set({theme:'classic'}));
 await expect(page.locator('body')).toHaveAttribute('data-nm-skin','orbit');
 await page.evaluate(()=>NeuroMapUISkin.set({theme:'prisma'}));
 await expect(page.locator('body')).toHaveAttribute('data-nm-skin','prisma');
});

test('Prisma menu commands are flat; hover and keyboard focus stay visible',async({page})=>{
 await boot(page);
 await page.evaluate(()=>NeuroMapUISkin.set({theme:'prisma'}));
 await page.locator('#btn-menu-file').click();
 await expect(page.locator('#dropdown-file')).toBeVisible();
 const sample=page.locator('#menu-save-file');
 await expect(sample).toBeVisible();
 const color=()=>sample.evaluate(el=>({
  row:getComputedStyle(el).backgroundColor,
  label:getComputedStyle(el.querySelector('span')).backgroundColor,
  shortcut:getComputedStyle(el.querySelector('kbd')).backgroundColor
 }));
 const idle=await color();
 expect(idle.row).toBe('rgba(0, 0, 0, 0)');
 expect(idle.label).toBe('rgba(0, 0, 0, 0)');
 expect(idle.shortcut).toBe('rgba(0, 0, 0, 0)');
 await sample.hover();
 expect((await color()).row).not.toBe(idle.row);
 await sample.focus();
 await page.keyboard.press('ArrowDown');
 const keyboard=await page.evaluate(()=>({
  inside:!!document.activeElement.closest('.dropdown-panel'),
  visible:document.activeElement.matches(':focus-visible'),
  outline:getComputedStyle(document.activeElement).outlineStyle
 }));
 expect(keyboard.inside).toBe(true);
 expect(keyboard.visible).toBe(true);
 expect(keyboard.outline).not.toBe('none');
 await page.keyboard.press('Escape');
 await page.evaluate(()=>NeuroMapUISkin.set({theme:'classic'}));
 await page.locator('#btn-menu-file').click();
 await expect(page.locator('body')).toHaveAttribute('data-nm-skin','orbit');
});

test('Prisma context menu also avoids persistent background tiles',async({page})=>{
 await boot(page);
 await page.evaluate(()=>NeuroMapUISkin.set({theme:'prisma'}));
 await page.locator('#mindmap-canvas').click({button:'right',position:{x:650,y:500}});
 await expect(page.locator('#context-menu')).toBeVisible();
 const item=page.locator('#context-menu .ctx-item').first();
 await expect(item).toBeVisible();
 expect(await item.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
 await item.hover();
 expect(await item.evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
});

test('legacy Classic preferences normalize to Orbit without a duplicate palette',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('nm_ui_skin_v1',JSON.stringify({theme:'classic',contrast:'normal',readability:'standard'}));
  localStorage.setItem('nm_orbit_desktop_ui_v1',JSON.stringify({enabled:false}));
 });
 await boot(page);
 expect(await page.evaluate(()=>document.body.dataset.nmSkin)).toBe('orbit');
 expect(await page.evaluate(()=>NeuroMapUISkin.get().theme)).toBe('orbit');
 expect(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--nm-skin-surface').trim())).toBe('#07142f');
});
