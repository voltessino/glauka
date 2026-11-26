const { test, expect } = require('@playwright/test');

async function openApp(page, target) {
  await page.addInitScript(() => localStorage.setItem('nm6_locale', 'it'));
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto(target === 'desktop' ? 'http://127.0.0.1:5174/index.html' : 'http://127.0.0.1:5173/app/index.html');
  await page.waitForFunction(() => window.neuroMapApp?.state?.root && window.NeuroMapInlineSuggest);
  await page.evaluate(() => {
    document.querySelectorAll('.nm6-shade').forEach((el) => el.classList.add('hidden'));
    const a = window.neuroMapApp;
    a.importHierarchy({ text: 'Studio', children: [{ text: 'Concetto', children: [] }] }, { newTab: true });
    a.selectNode(a.state.root.children[0].id);
  });
}

for (const target of ['desktop', 'android']) {
  test.describe(`${target} inline smart suggest`, () => {
    test('suggests offline SVGs and shorthand symbols while typing, applies cleanly, and respects Settings toggle', async ({ page }) => {
      await openApp(page, target);

      await page.evaluate(() => window.neuroMapApp.editSelected(''));
      const input = page.locator('#inline-editor-input');
      await expect(input).toBeVisible();

      // 1. Typing "cuore" reveals #nm-inline-smart-suggest with SVG chip(s) without blurring editor.
      await input.fill('Anatomia del cuore');
      await input.dispatchEvent('input');
      const bar = page.locator('#nm-inline-smart-suggest');
      await expect(bar).toBeVisible();
      const svgChip = bar.locator('.nm-inline-suggest-chip[data-kind="svg"]').first();
      await expect(svgChip).toBeVisible();
      await svgChip.click();
      await expect(input).toBeFocused();
      const appliedArt = await page.evaluate(() => {
        const a = window.neuroMapApp;
        return a.state.findNode(a.editorNodeId)?.objectArt?.id || '';
      });
      expect(appliedArt.length).toBeGreaterThan(0);

      // 2. Typing shorthand "->" offers "→" chip and transforms inline without blocking Enter.
      await input.fill('Causa ->');
      await input.dispatchEvent('input');
      const shorthandChip = bar.locator('.nm-inline-suggest-chip[data-kind="shorthand"]').first();
      await expect(shorthandChip).toBeVisible();
      await shorthandChip.click();
      await expect(input).toHaveValue('Causa →');
      await input.press('Enter');
      await expect(input).toBeHidden();
      await expect(bar).toBeHidden();
      expect(await page.evaluate(() => {
        const a = window.neuroMapApp;
        return a.state.findNode(a.state.selectedNodeId)?.text;
      })).toBe('Causa →');

      // 3. Disabling in Settings Center (#gl-settings-smart-suggest) suppresses suggestions immediately.
      if (await page.locator('#gl-settings-quick').isVisible()) {
        await page.locator('#gl-settings-quick').click();
      } else {
        await page.evaluate(() => window.NeuroMapSettingsCenter?.open?.());
      }
      await expect(page.locator('#gl-settings-center')).toBeVisible();
      await page.locator('#gl-settings-nav button[data-category="editor"]').click();
      const toggle = page.locator('#gl-settings-smart-suggest');
      await expect(toggle).toBeChecked();
      await page.locator('label:has(#gl-settings-smart-suggest)').click();
      await expect(toggle).not.toBeChecked();
      await page.keyboard.press('Escape');
      await expect(page.locator('#gl-settings-center')).toBeHidden();

      await page.evaluate(() => window.neuroMapApp.editSelected(''));
      await input.fill('Anatomia del cuore');
      await input.dispatchEvent('input');
      await page.waitForTimeout(260);
      await expect(bar).toBeHidden();
    });
  });
}
