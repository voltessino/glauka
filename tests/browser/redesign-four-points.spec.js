const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const { pdfFixture } = require('./pdfjs-fixture');

const DESKTOP_URL = process.env.GLAUKA_DESKTOP_TEST_URL || 'http://127.0.0.1:5174/index.html';
const os = require('node:os');
const SHOT_DIR = process.env.GLAUKA_UX_SHOT_DIR
  ? path.resolve(process.env.GLAUKA_UX_SHOT_DIR)
  : path.join(os.tmpdir(), 'glauka-ux-audit-screenshots');

async function boot(page, theme = 'prisma') {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1360, height: 860 });
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem('nm6_welcome_seen', '1');
    localStorage.setItem('nm6_locale', 'it');
    localStorage.setItem('nm_ui_skin_v1', JSON.stringify({ theme: selectedTheme, contrast: 'normal', readability: 'compact' }));
  }, theme);
  await page.goto(DESKTOP_URL);
  await page.waitForFunction(() => window.neuroMapApp && window.neuroMapApp._nmOCR && window.neuroMapApp._nmLearning && window.neuroMapApp._nmKnowledge);
  await page.addStyleTag({ content: '*{transition:none!important;animation:none!important;scroll-behavior:auto!important}' });
}

for (const theme of ['prisma', 'slate']) {
  test(`four-point visual and functional verification (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    await boot(page, theme);

    // 1. Miniatura della mappa attuale: 5 branches (17 nodes) including branch 5 children
    const branch5LastChildId = await page.evaluate(() => {
      const a = neuroMapApp;
      a.importHierarchy({
        text: 'Mappa Centrale',
        children: [
          { text: '1. Strategia e Visione', children: [{ text: 'Obiettivi Q4' }, { text: 'Analisi Mercato' }, { text: 'KPI Chiave' }] },
          { text: '2. Architettura Prodotto', children: [{ text: 'Motore Grafico' }, { text: 'Esperienza Utente' }] },
          { text: '3. Design organico', children: [{ text: 'Curva di Bézier' }, { text: 'Tavolozza Armonica' }] },
          { text: '4. Ricerca e Sviluppo', children: [{ text: 'Prototipi Rapidi' }, { text: 'Prova Usabilità' }] },
          { text: '5. Operazioni & Lancio', children: [{ text: 'Marketing' }, { text: 'Distribuzione' }] },
        ],
      }, { newTab: true });
      a.state.root.layoutMode = 'right';
      a.recalculateAndRender();
      a.centerMap?.();
      return a.state.root.children[4].children[1].id;
    });
    await page.locator('#v6-show-layout').click();
    await expect(page.locator('#nm-layout-mini-preview')).toBeVisible();
    await page.locator('#nm-layout-mini-preview').scrollIntoViewIfNeeded();
    await expect(page.locator('#nm-layout-mini-preview rect')).toHaveCount(17);
    await expect(page.locator(`#nm-layout-mini-preview [data-logical-id="${branch5LastChildId}"]`)).toHaveCount(1);
    await expect(page.locator('#nm-layout-mini-preview small')).toContainText('17 nodi');
    await page.screenshot({ path: path.join(SHOT_DIR, `1-miniature-${theme}.png`) });
    await page.locator('.hud-bottom-left .nm-panel-header-actions button').last().click();

    // 2. OCR Studio: 420-page PDF + 25-page range without 350-page or 20-page limit errors
    await page.evaluate(() => neuroMapApp._nmOCR.open());
    const ocrDialog = page.locator('#nm-ocr');
    await expect(ocrDialog).toBeVisible();
    const pdf420 = pdfFixture(420, { bookmarks: true });
    await page.locator('#nm-ocr-file').setInputFiles({ name: 'Project nutrition.pdf', mimeType: 'application/pdf', buffer: pdf420 });
    await expect(page.locator('.ocr-drop-meta')).toContainText('420 pagine rilevate', { timeout: 15000 });
    await expect(page.locator('.ocr-presets')).toContainText('420');
    await page.locator('#nm-ocr-pages').fill('1-25');
    await page.locator('#nm-ocr-run').click();
    await expect(page.locator('#nm-ocr-review-page option')).toHaveCount(25, { timeout: 30000 });
    await expect(page.locator('#nm-ocr-status')).toContainText('Lettura completata');
    const ocrOverflow = await page.locator('.ocr-window').evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(ocrOverflow).toBe(false);
    await page.screenshot({ path: path.join(SHOT_DIR, `2-ocr-studio-${theme}.png`) });
    await page.evaluate(async () => {
      neuroMapApp._nmOCR.close();
    });
    // Dismiss unsaved preview prompt cleanly
    const discardBtn = page.locator('#nm-decision-panel').getByRole('button', { name: 'Scarta', exact: true });
    if (await discardBtn.isVisible().catch(() => false)) await discardBtn.click();
    await expect(ocrDialog).toBeHidden();

    // 3. Strumenti menu -> Study & Knowledge Panel unification
    if (theme === 'prisma') {
      await page.locator('#btn-menu-tools').click();
      if ((await page.locator('#nm-tools-study').getAttribute('open')) === null) {
        await page.locator('#nm-tools-study > summary').click();
      }
      await expect(page.locator('#nm-tool-studio-panel')).toBeVisible();
      await page.screenshot({ path: path.join(SHOT_DIR, `3-tools-menu-${theme}.png`) });
      await page.locator('#nm-tool-studio-panel').click();
    } else {
      await page.locator('#nm-learn-open').click();
    }

    const learnPanel = page.locator('#nm-learn-panel');
    await expect(learnPanel).toBeVisible();
    await learnPanel.getByRole('button', { name: 'Da ripassare', exact: true }).click();
    await expect(learnPanel.locator('.nm-learn-unified-stats')).toBeVisible();
    await expect(learnPanel.locator('.nm-learn-tool-card')).toHaveCount(6);
    await page.screenshot({ path: path.join(SHOT_DIR, `4-studio-panel-${theme}.png`) });

    // Click connected "Scadenze flashcard" inside right Studio panel -> jumps cleanly to Scadenze dei ripassi
    await learnPanel.locator('[data-studio-tool="schedule"]').click();
    const knPanel = page.locator('#nm-knowledge-panel');
    await expect(knPanel).toBeVisible();
    await expect(knPanel.locator('.nm-kn-header strong')).toHaveText('Scadenze dei ripassi');
    await expect(knPanel.locator('.nm-radar-strip, .nm-kn-bridge').first()).toBeVisible();
    await knPanel.locator('.nm-kn-picker > summary').click();
    await expect(knPanel.locator('.nm-kn-picker-extra')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, `5-knowledge-radar-${theme}.png`) });

    // Open Visual Learning via Studio card and check clean theme adoption
    await knPanel.getByRole('button', { name: 'Ripassa su immagini', exact: true }).click();
    await expect(page.locator('#nm-visual-study')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, `6-visual-study-${theme}.png`) });
  });
}
