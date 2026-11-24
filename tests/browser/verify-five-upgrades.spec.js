const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const { fixture } = require('./ocr2-fixture');

const DESKTOP = process.env.GLAUKA_DESKTOP_TEST_URL || 'http://127.0.0.1:5174/index.html';
const SHOTS = process.env.GLAUKA_FIVE_SHOTS_DIR ? path.resolve(process.env.GLAUKA_FIVE_SHOTS_DIR) : null;

async function shotPath(info, name) {
  return SHOTS ? path.join(SHOTS, name) : info.outputPath(name);
}

async function boot(page, theme = 'prisma') {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.addInitScript((skin) => {
    localStorage.setItem('nm6_welcome_seen', '1');
    localStorage.setItem('nm.knowledge.guideSeen.v1', '1');
    localStorage.setItem('nm_ui_skin_v1', JSON.stringify({ theme: skin, contrast: 'normal', readability: 'compact' }));
    window.neuromapDesktop = {
      productStatus: async () => ({ plan: 'pro' }),
      readWorkspace: async () => null,
      readEditorPreferences: async () => null,
      readAISettings: async () => null,
      readAISecret: async () => ({}),
      writeWorkspace: async () => true,
      onExternalFile: () => {},
      listProjectHistory: async () => ({
        filename: 'ist_10.xmind',
        versions: [
          { id: '20261117T123517.000000000Z_' + 'a'.repeat(64) + '.snap', savedAt: '2026-11-17T11:35:17Z', size: 112640, pinned: true },
          { id: '20261116T181000.000000000Z_' + 'b'.repeat(64) + '.snap', savedAt: '2026-11-16T17:10:00Z', size: 98304, pinned: false },
        ],
      }),
      describeProjectHistory: async () => ({
        supported: true,
        format: 'XMind (.xmind)',
        added: 4,
        removed: 1,
        modified: 2,
        before: 42,
        now: 45,
        imagesBefore: 1,
        imagesNow: 2,
        addedNames: ['Tessuto epiteliale', 'Ghiandole esocrine', 'Giunzioni cellulari', 'Membrana basale'],
        modifiedNames: ['Lamina propria', 'Vascolarizzazione'],
        removedNames: ['Bozza iniziale'],
      }),
      pinProjectHistory: async (_p, _id, pinned) => ({ pinned }),
      recoverProjectHistory: async () => ({ recoveredPath: 'C:/Maps/ist_10.recovered.xmind', name: 'ist_10.recovered.xmind' }),
    };
  }, theme);
  await page.goto(DESKTOP);
  await page.waitForFunction(() => window.neuroMapApp?._nmKnowledge && document.body.classList.contains('nm-workspace-v2'));
  await page.addStyleTag({ content: '*{transition:none!important;animation:none!important;scroll-behavior:auto!important}' });
  await page.evaluate(() => {
    const a = neuroMapApp;
    const tab = a.tabs.find((t) => t.id === a.activeTabId);
    if (tab) {
      tab.filePath = 'C:/Maps/ist_10.xmind';
      tab.fileName = 'ist_10.xmind';
      tab.title = 'ist_10';
    }
    a.importHierarchy({
      text: 'Istologia Generale',
      children: [
        { text: '1. Tessuto Epiteliale', sr: { reviews: 3, lapses: 0, dueAt: Date.now() - 3600000 }, children: [{ text: 'Rivestimento' }, { text: 'Ghiandolare' }] },
        { text: '2. Tessuto Connettivo', sr: { reviews: 2, lapses: 1, dueAt: Date.now() + 86400000 * 3 }, children: [{ text: 'Propriamente detto' }, { text: 'Cartilagine' }] },
        { text: '3. Tessuto Muscolare', sr: { reviews: 4, lapses: 0 }, children: [{ text: 'Scheletrico' }, { text: 'Cardiaco' }] },
        { text: '4. Tessuto Nervoso', children: [{ text: 'Neuroni' }, { text: 'Cellule gliali' }] },
      ],
    }, { newTab: false });
    a.renderTabBar?.();
  });
}

for (const theme of ['prisma', 'slate']) {
  test(`five upgrades visual & geometry verification (${theme})`, async ({ page }, info) => {
    await boot(page, theme);

    // 1. Unified fixed headers & inner scrollers on Disposizione, Formato, and AI
    for (const [opener, sel, shot] of [
      ['v6-show-layout', '.hud-bottom-left', '1-disposizione-' + theme + '.png'],
      ['btn-toggle-inspector', '#inspector-sidebar', '2-formato-' + theme + '.png'],
      ['btn-ai-settings', '#nm-ai-studio', '3-ai-' + theme + '.png'],
    ]) {
      await page.locator('#' + opener).click();
      const panel = page.locator(sel);
      await expect(panel).toBeVisible();
      const geom = await panel.evaluate((el) => {
        const root = el.getBoundingClientRect();
        const heading = el.querySelector(':scope > .nm-side-panel-heading');
        const h = heading.getBoundingClientRect();
        const body = el.querySelector(':scope > .nm-panel-body, :scope > .nm-ai-body');
        const b = body.getBoundingClientRect();
        return {
          rootW: root.width,
          headW: h.width,
          headH: h.height,
          bodyBelow: b.top >= h.bottom - 1,
          outerOverflow: getComputedStyle(el).overflowY,
        };
      });
      expect(Math.abs((geom.headW + 2) - geom.rootW)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(geom.headH - 44)).toBeLessThanOrEqual(1);
      expect(geom.bodyBelow).toBe(true);
      expect(geom.outerOverflow).toBe('hidden');
      await page.mouse.move(10, 10);
      await page.screenshot({ path: await shotPath(info, shot) });

      // Collapse bar keeps exact header alignment
      const beforeTitle = await panel.locator('.nm-side-panel-heading').evaluate((h) => h.querySelector('strong,.hud-title,.inspector-title').getBoundingClientRect().left);
      await panel.locator('.nm-panel-preview-toggle, #nm-ai-minimize').first().click();
      await expect(panel).toHaveClass(/nm-panel-compact/);
      const compactBox = await panel.boundingBox();
      expect(Math.abs(compactBox.height - 44)).toBeLessThanOrEqual(2);
      const afterTitle = await panel.locator('.nm-side-panel-heading').evaluate((h) => h.querySelector('strong,.hud-title,.inspector-title').getBoundingClientRect().left);
      expect(Math.abs(afterTitle - beforeTitle)).toBeLessThanOrEqual(1.5);
      if (opener === 'v6-show-layout') {
        await page.mouse.move(10, 10);
        await page.screenshot({ path: await shotPath(info, '1b-disposizione-compact-' + theme + '.png') });
      }
      await panel.locator('.nm-panel-preview-toggle, #nm-ai-minimize').first().click();
      await panel.locator('.nm-panel-header-actions button').last().click();
    }

    // 2. Scadenze dei ripassi generous scroll & KPI cards
    await page.evaluate(() => neuroMapApp._nmKnowledge.open('radar'));
    const kn = page.locator('#nm-knowledge-panel');
    await expect(kn).toBeVisible();
    const scrollBox = await kn.locator('.nm-kn-scroll').boundingBox();
    expect(scrollBox.height).toBeGreaterThanOrEqual(240);
    await expect(kn.locator('.nm-radar-kpi')).toHaveCount(4);
    await page.mouse.move(10, 10);
    await page.screenshot({ path: await shotPath(info, '4-scadenze-' + theme + '.png') });
    await kn.locator('.nm-kn-header .nm-panel-header-actions button').last().click();

    // 3. Cronologia versioni (supports .xmind + clear labels + diff)
    await page.locator('#gl-history-quick').click();
    const hist = page.locator('#gl-history-dialog');
    await expect(hist).toBeVisible();
    await expect(hist).toContainText('XMind (.xmind)');
    await expect(hist.locator('#gl-history-recover')).toHaveText(/Apri come copia separata/);
    await page.mouse.move(10, 10);
    await page.screenshot({ path: await shotPath(info, '5-cronologia-' + theme + '.png') });
    await hist.locator('#gl-history-close').click();

    // 4. Salvataggio e backup clear modal
    await page.locator('#glauka-save-indicator').click();
    const saveModal = page.locator('#nm-save-status-modal');
    await expect(saveModal).toBeVisible();
    await page.mouse.move(10, 10);
    await page.screenshot({ path: await shotPath(info, '6-salvataggio-' + theme + '.png') });
    await saveModal.locator('.nm-save-close').click();

    // 5. Studia la mappa + Scadenze compact title + Back to Study + sleek Cambia strumento
    await page.evaluate(() => neuroMapApp._nmLearning.open());
    const learn = page.locator('#nm-learn-panel');
    await expect(learn).toBeVisible();
    const learnGeom = await learn.evaluate((el) => {
      const head = el.querySelector(':scope > header');
      const h = head.getBoundingClientRect();
      const title = head.querySelector('strong').getBoundingClientRect();
      const collapse = head.querySelector('.nm-panel-preview-toggle').getBoundingClientRect();
      return { headH: h.height, titleLeft: title.left, collapseLeft: collapse.left, outerOverflow: getComputedStyle(el).overflowY };
    });
    expect(Math.abs(learnGeom.headH - 44)).toBeLessThanOrEqual(1.5);
    expect(learnGeom.outerOverflow).toBe('hidden');
    await page.mouse.move(10, 10);
    await page.screenshot({ path: await shotPath(info, '8-studia-mappa-' + theme + '.png') });

    await learn.locator('header .nm-panel-preview-toggle').click();
    await expect(learn).toHaveClass(/nm-panel-compact/);
    await expect(learn.locator('header strong')).toBeVisible();
    const learnCompact = await learn.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const head = el.querySelector(':scope > header');
      return {
        h: box.height,
        titleText: head.querySelector('strong').textContent.trim(),
        titleLeft: head.querySelector('strong').getBoundingClientRect().left,
        collapseLeft: head.querySelector('.nm-panel-preview-toggle').getBoundingClientRect().left,
      };
    });
    expect(Math.abs(learnCompact.h - 44)).toBeLessThanOrEqual(2);
    expect(learnCompact.titleText).toBe('Studia la mappa');
    expect(Math.abs(learnCompact.titleLeft - learnGeom.titleLeft)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(learnCompact.collapseLeft - learnGeom.collapseLeft)).toBeLessThanOrEqual(1.5);
    await page.mouse.move(10, 10);
    await page.screenshot({ path: await shotPath(info, '8b-studia-compact-' + theme + '.png') });
    await learn.locator('header .nm-panel-preview-toggle').click();

    await learn.locator('[data-studio-tool="schedule"]').click();
    await expect(kn).toBeVisible();
    await expect(kn.locator('.nm-kn-header strong')).toHaveText('Scadenze dei ripassi');
    await expect(kn.locator('#nm-kn-back-study')).toBeVisible();
    const knHeadBefore = await kn.locator('.nm-kn-header').evaluate((h) => ({
      titleLeft: h.querySelector('strong').getBoundingClientRect().left,
      collapseLeft: h.querySelector('.nm-panel-preview-toggle').getBoundingClientRect().left,
    }));
    await kn.locator('.nm-kn-header .nm-panel-preview-toggle').click();
    await expect(kn).toHaveClass(/nm-panel-compact/);
    await expect(kn.locator('.nm-kn-header strong')).toBeVisible();
    const knHeadAfter = await kn.evaluate((el) => {
      const h = el.querySelector('.nm-kn-header');
      return {
        boxH: el.getBoundingClientRect().height,
        titleLeft: h.querySelector('strong').getBoundingClientRect().left,
        titleW: h.querySelector('strong').getBoundingClientRect().width,
        collapseLeft: h.querySelector('.nm-panel-preview-toggle').getBoundingClientRect().left,
      };
    });
    expect(Math.abs(knHeadAfter.boxH - 44)).toBeLessThanOrEqual(2);
    expect(knHeadAfter.titleW).toBeGreaterThan(40);
    expect(Math.abs(knHeadAfter.titleLeft - knHeadBefore.titleLeft)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(knHeadAfter.collapseLeft - knHeadBefore.collapseLeft)).toBeLessThanOrEqual(1.5);
    await page.mouse.move(10, 10);
    await page.screenshot({ path: await shotPath(info, '9-knowledge-compact-' + theme + '.png') });
    await kn.locator('.nm-kn-header .nm-panel-preview-toggle').click();

    await kn.locator('#nm-kn-tool-picker > summary').click();
    await expect(kn.locator('#nm-kn-tool-picker')).toHaveAttribute('open', '');
    await expect(kn.locator('.nm-kn-picker-extra button')).toHaveCount(2);
    const pickerGeom = await kn.locator('#nm-kn-tool-picker').evaluate((det) => {
      const panelRect = document.getElementById('nm-knowledge-panel').getBoundingClientRect();
      const tabs = Array.from(det.querySelectorAll('.nm-kn-tabs button'));
      const maxTabH = Math.max(...tabs.map((b) => b.getBoundingClientRect().height));
      const overflowX = det.getBoundingClientRect().right > panelRect.right + 1;
      return { count: tabs.length, maxTabH, overflowX };
    });
    expect(pickerGeom.count).toBeGreaterThanOrEqual(6);
    expect(pickerGeom.maxTabH).toBeLessThanOrEqual(58);
    expect(pickerGeom.overflowX).toBe(false);
    await page.mouse.move(10, 10);
    await page.screenshot({ path: await shotPath(info, '10-cambia-strumento-' + theme + '.png') });

    await kn.locator('#nm-kn-back-study').click();
    await expect(kn).toBeHidden();
    await expect(learn).toBeVisible();
    await learn.locator('header .nm-panel-header-actions button').last().click();

    // 6. Condividi o trasferisci mappa (file export, PC <-> Telefono, I miei dispositivi)
    await page.evaluate(() => document.getElementById('nm-map-share-open').click());
    const share = page.locator('#nm-map-share');
    await expect(share).toBeVisible();
    await expect(share.locator('#nm-map-share-title')).toHaveText(/Condividi o trasferisci mappa/);
    await expect(share).not.toContainText(/Invita persone|In preparazione/i);
    await page.mouse.move(10, 10);
    await page.screenshot({ path: await shotPath(info, '11-condividi-file-' + theme + '.png') });

    await share.locator('#nm-map-share-device').click();
    await expect(share.locator('#nm-map-share-device-result')).toBeVisible();
    await expect(share.locator('#nm-map-share-device-result .nm-share-step')).toHaveCount(3);
    await page.mouse.move(10, 10);
    await page.screenshot({ path: await shotPath(info, '11b-condividi-dispositivo-' + theme + '.png') });

    await share.locator('#nm-map-share-sync').click();
    const devInput = share.locator('.nm-share-device-row input');
    await expect(devInput).toBeVisible();
    await devInput.fill('PC Studio Casa');
    await devInput.dispatchEvent('change');
    expect(await page.evaluate(() => localStorage.getItem('glauka.f11.deviceName'))).toBe('PC Studio Casa');
    await page.mouse.move(10, 10);
    await page.screenshot({ path: await shotPath(info, '11c-condividi-dispositivi-' + theme + '.png') });
    await share.locator('.nm-share-close').click();
  });
}

for (const theme of ['prisma', 'slate']) {
  test(`OCR studio renders real non-blank PDF page and docks footer below panes (${theme})`, async ({ page }, info) => {
    await boot(page, theme);
    const pdf = await fixture(page);
    await page.evaluate(() => neuroMapApp._nmOCR.open());
    await page.locator('#nm-ocr-file').setInputFiles({ name: 'university.pdf', mimeType: 'application/pdf', buffer: pdf });
    await page.locator('#nm-ocr-pages').fill('1');
    await page.locator('#nm-ocr-run').click();
    await expect(page.locator('#nm-ocr-text')).toHaveValue(/CUORE/, { timeout: 60000 });
    const layout = await page.evaluate(() => {
      const img = document.querySelector('#nm-ocr .ocr-image img');
      const review = document.querySelector('#nm-ocr .ocr-review').getBoundingClientRect();
      const ws = document.querySelector('#nm-ocr .ocr-workspace').getBoundingClientRect();
      const footer = document.querySelector('#nm-ocr .ocr-footer').getBoundingClientRect();
      const c = document.createElement('canvas');
      c.width = 40; c.height = 40;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 40, 40);
      const data = ctx.getImageData(0, 0, 40, 40).data;
      let nonWhite = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) nonWhite++;
      return {
        naturalW: img.naturalWidth,
        nonWhite,
        wsBottom: ws.bottom,
        footerTop: footer.top,
        reviewTop: review.top,
      };
    });
    expect(layout.naturalW).toBeGreaterThan(200);
    expect(layout.nonWhite).toBeGreaterThan(20);
    expect(layout.wsBottom).toBeLessThanOrEqual(layout.footerTop + 1);
    await page.mouse.move(10, 10);
    await page.screenshot({ path: await shotPath(info, '7-ocr-studio-' + theme + '.png') });
  });
}
