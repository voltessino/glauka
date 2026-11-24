const {test,expect}=require('@playwright/test');
const {openSettings}=require('./settings-path');

test.describe('NeuroMap Orbit universal desktop/Web UI',()=>{
 test.beforeEach(async({page})=>{
   await page.setViewportSize({width:1440,height:900});
   await page.goto('http://127.0.0.1:5174/index.html');
   await page.evaluate(()=>{try{localStorage.removeItem('nm_orbit_desktop_ui_v1')}catch{}});
   await page.reload();
   await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapOrbit&&window.NeuroMapSettingsCenter);
   await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(el=>el.classList.add('hidden')));
 });
 test('Orbit and original Blue remain selectable without touching map or Undo',async({page})=>{
   const before=await page.evaluate(()=>{
     const app=window.neuroMapApp;
     return {root:JSON.stringify(app.state.root),history:app.state.undoStack.length,
       colors:app.state.activeThemeId,branch:app.state.branchStyle};
   });
   await expect(page.locator('body')).toHaveClass(/nm-orbit-workspace/);
   await expect(page.locator('body')).toHaveAttribute('data-nm-skin','prisma');
   await page.evaluate(()=>NeuroMapUISkin.set({theme:'orbit'}));
   await expect(page.locator('body')).toHaveClass(/nm-orbit-workspace/);
   await openSettings(page,'appearance');
   await expect(page.locator('#gl-settings-theme-extra')).toHaveValue('orbit');
   await page.locator('#gl-settings-accent').selectOption('violet');
   await page.locator('#gl-settings-panel-spacing').selectOption('compact');
   await expect(page.locator('body')).toHaveAttribute('data-nm-orbit-accent','violet');
   await expect(page.locator('body')).toHaveAttribute('data-nm-orbit-density','compact');
   const after=await page.evaluate(()=>{
     const app=window.neuroMapApp;
     return {root:JSON.stringify(app.state.root),history:app.state.undoStack.length,
       colors:app.state.activeThemeId,branch:app.state.branchStyle};
   });
   expect(after).toEqual(before);
   await page.evaluate(()=>NeuroMapUISkin.set({theme:'classic'}));
   await expect(page.locator('body')).toHaveClass(/nm-orbit-workspace/);
   await expect(page.locator('body')).toHaveAttribute('data-nm-skin','orbit');
 });
 test('command deck searches and invokes the original Spotlight control, no parallel canvas logic',async({page})=>{
   const original=await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root));
   await page.keyboard.press('Control+Shift+P');
   await expect(page.locator('#nm-orbit-command-overlay')).toBeVisible();
   const field=page.locator('#nm-orbit-command-search');
   await expect(field).toBeFocused();
   await field.fill('ricerca globale');
   await expect(page.locator('#nm-orbit-command-results .nm-orbit-command-result')).toHaveCount(1);
   await page.locator('.nm-orbit-command-result').first().click();
   await expect(page.locator('#nm-orbit-command-overlay')).toBeHidden();
   await expect(page.locator('#find-overlay')).toBeVisible();
   expect(await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root))).toBe(original);
 });
 test('Escape and focus-trap keep keyboard actions away from the editor',async({page})=>{
   await page.locator('#nm-orbit-command-trigger').click();
   await page.locator('#nm-orbit-command-search').fill('salva');
   await page.keyboard.press('Tab');
   await expect(page.locator('#nm-orbit-command-overlay')).toBeVisible();
   await page.keyboard.press('Escape');
   await expect(page.locator('#nm-orbit-command-overlay')).toBeHidden();
   expect(await page.evaluate(()=>window.neuroMapApp.state.selectedNodeId)).toBeTruthy();
 });
 test('Orbit UI preference persists across reload without affecting project files',async({page})=>{
   await page.evaluate(()=>NeuroMapUISkin.set({theme:'orbit'}));
   await page.evaluate(()=>window.NeuroMapOrbit.set({accent:'amber',density:'compact'}));
   const before=await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root));
   await page.reload();
   await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapOrbit);
   await expect(page.locator('body')).toHaveClass(/nm-orbit-workspace/);
   await expect(page.locator('body')).toHaveAttribute('data-nm-orbit-accent','amber');
   expect(await page.evaluate(()=>window.NeuroMapOrbit.get().density)).toBe('compact');
   expect(await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root))).toBe(before);
 });
});
