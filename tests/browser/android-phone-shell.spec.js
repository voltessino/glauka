const { test, expect } = require("@playwright/test");
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("nm6_welcome_seen", "1");
    localStorage.setItem("nm_android_orbit_ui_enabled_v1", "1");
  });
});
async function boot(page) {
  await page.goto("/app/index.html");
  await page.waitForFunction(
    () =>
      window.neuroMapApp &&
      document.body.classList.contains("glauka-mobile-app"),
  );
}
for (const viewport of [
  { width: 320, height: 568 },
  { width: 393, height: 852 },
  { width: 852, height: 393 },
  { width: 1024, height: 600 },
]) {
  test(
    "app chrome and transient feedback fit " +
      viewport.width +
      "x" +
      viewport.height,
    async ({ page }, info) => {
      await page.setViewportSize(viewport);
      if(viewport.width===393)await page.addInitScript(()=>localStorage.setItem('nm615.canvas.theme','night'));
      await boot(page);
      await expect(page.locator(".top-chrome")).toBeHidden();
      await expect(page.locator("#mobile-dock")).toBeHidden();
      await expect(page.locator("#glauka-app-dock")).toBeVisible();
      await expect(page.locator("#nm74-launch")).toBeVisible();
      const top = await page.locator("#glauka-app-header").boundingBox();
      expect(top.height).toBeLessThan(80);
      await page.evaluate(() =>
        neuroMapApp.showToast("Ramo 2/6 · Architettura Prodotto", "ANDROID"),
      );
      const toast = await page.locator("#toast-notification").boundingBox();
      expect(toast.height).toBeLessThan(100);
      expect(toast.y).toBeGreaterThan(viewport.height / 2);
      expect(toast.x).toBeGreaterThanOrEqual(0);
      expect(toast.x + toast.width).toBeLessThanOrEqual(viewport.width + 1);
      await page.screenshot({ path: info.outputPath("map-app.png") });
      await page.locator("#glauka-add-open").click();
      await expect(page.locator("#glauka-app-sheet")).toBeVisible();
      const panel = await page.locator(".glauka-sheet-panel").boundingBox();
      expect(panel.y).toBeGreaterThan(10);
      expect(panel.x + panel.width).toBeLessThanOrEqual(viewport.width);
      await expect(page.locator(".dropdown-panel:visible")).toHaveCount(0);
      await page.screenshot({ path: info.outputPath("add-sheet.png") });
      await page.keyboard.press("Escape");
      await expect(page.locator("#glauka-app-sheet")).toBeHidden();
    },
  );
}

test("Android export menu clearly explains manual backups before reinstalling", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page);
  await page.locator("#glauka-options-open").click();
  await page.getByRole("button", { name: "Esporta e condividi", exact: true }).click();
  await expect(page.locator(".glauka-backup-hint")).toContainText(
    "Prima di disinstallare o cambiare telefono"
  );
  await expect(
    page.getByRole("button", { name: "Backup completo (prima di reinstallare)", exact: true })
  ).toBeVisible();
  await expect(page.locator(".glauka-backup-hint")).toBeInViewport();
});

test("phone actions create/edit branches, undo and retain useful commands without desktop dropdowns", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page);
  const count = await page.evaluate(
    () => neuroMapApp.state.getAllNodes().length,
  );
  await page.locator("#glauka-add-open").click();
  await page.getByRole("button", { name: "Ramo figlio", exact: true }).click();
  expect(
    await page.evaluate(() => neuroMapApp.state.getAllNodes().length),
  ).toBe(count + 1);
  await page.locator("#glauka-undo").click();
  expect(
    await page.evaluate(() => neuroMapApp.state.getAllNodes().length),
  ).toBe(count);
  await page.locator("#glauka-options-open").click();
  await page
    .getByRole("button", { name: "Tutti i comandi", exact: true })
    .click();
  await expect(page.locator("#nm-android-command-overlay")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("#glauka-style-open").click();
  await expect(page.locator("#inspector-sidebar")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#inspector-sidebar")).toBeHidden();
  await page.locator("#glauka-options-open").click();
  await page
    .getByRole("button", { name: "Disposizione dei rami", exact: true })
    .click();
  await expect(
    page.locator("#glauka-sheet-content .hud-bottom-left"),
  ).toBeVisible();
  expect(await page.evaluate(() => GlaukaMobileShell.back())).toBe(true);
  await expect(page.locator("#glauka-app-sheet")).toBeHidden();
  await page.locator("#glauka-options-open").click();
  await page
    .getByRole("button", { name: "Cerca nella mappa", exact: true })
    .click();
  await expect(page.locator("#find-overlay")).toBeVisible();
  expect(await page.evaluate(() => GlaukaMobileShell.back())).toBe(true);
  await expect(page.locator("#find-overlay")).toBeHidden();
  await page.setViewportSize({ width: 852, height: 393 });
  await expect(page.locator("#nm74-launch")).toBeVisible();
  expect(
    await page.locator("#nm74-launch").evaluate((e) => e.parentElement.id),
  ).toBe("glauka-app-dock");
});
test("Style groups background controls and closes without a blank minimized strip", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page);
  await expect(page.locator("#glauka-add-open")).toHaveAttribute("aria-expanded", "false");
  await page.locator("#glauka-style-open").click();
  const inspector = page.locator("#inspector-sidebar");
  await expect(inspector).toBeVisible();
  const background = inspector.locator(".glauka-map-background");
  await expect(background).toHaveCount(1);
  await expect(background.locator("#nm-map-refinements")).toHaveCount(1);
  await background.locator(":scope > summary").click();
  await expect(background.locator("#nm-pattern-intensity")).toBeVisible();
  await expect(background.locator("#nm-pattern-intensity")).toHaveAttribute("max", "30");
  await inspector.getByText("Rami e collegamenti", { exact: true }).click();
  await expect(inspector.locator('[data-style="radial"]')).toHaveCount(0);
  await expect(inspector.locator('#nm54-style-grid [data-style="elbow"]')).toHaveCount(1);
  await expect(inspector.locator(".nm54-hint").filter({ hasText: "Qui scegli il percorso dei collegamenti" })).toBeVisible();
  await inspector.locator("#btn-close-inspector").click();
  await expect(inspector).toBeHidden();
  await expect(inspector).not.toHaveClass(/nm-panel-minimized|nm-panel-compact/);
  await expect(page.locator("#glauka-style-open")).toHaveAttribute("aria-expanded", "false");
  await page.locator("#glauka-style-open").click();
  await expect(inspector).toBeVisible();
});

test("Add selection and map camera respect active phone controls", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page);
  await page.locator("#glauka-add-open").click();
  await expect(page.locator("#glauka-add-open")).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator("#glauka-add-open")).toHaveAttribute("aria-expanded", "false");
  const fit = await page.evaluate(() => {
    const a=neuroMapApp;
    a.fitToScreen();
    const box=a.layout.computeBoundingBox(a.state.images);
    const cam=a.renderer.camera;
    const center=(box.minY+box.maxY)/2*cam.zoom+cam.y;
    const top=document.getElementById("glauka-app-header").getBoundingClientRect().bottom;
    const bottom=document.getElementById("glauka-app-dock").getBoundingClientRect().top;
    return {center, expected:(top+bottom)/2};
  });
  expect(Math.abs(fit.center-fit.expected)).toBeLessThan(2);
  await page.locator("#glauka-options-open").click();
  await page.getByRole("button", { name: "Centra e ingrandisci il concetto", exact: true }).click();
  const focus = await page.evaluate(() => {
    const a=neuroMapApp;
    const node=a.state.findNode(a.state.selectedNodeId)||a.state.root;
    const metric=a.layout.getLayout(node.id);
    const cam=a.renderer.camera;
    const top=document.getElementById("glauka-app-header").getBoundingClientRect().bottom;
    const bottom=document.getElementById("glauka-app-dock").getBoundingClientRect().top;
    return {x:metric.x*cam.zoom+cam.x,y:metric.y*cam.zoom+cam.y,zoom:cam.zoom,
      width:innerWidth,middle:(top+bottom)/2};
  });
  expect(focus.zoom).toBeGreaterThanOrEqual(0.9);
  expect(Math.abs(focus.x-focus.width/2)).toBeLessThan(2);
  expect(Math.abs(focus.y-focus.middle)).toBeLessThan(2);
});

test("real multi-touch pinch stays anchored and never jumps when one finger remains", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "CDP multi-touch");
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page);
  const session = await page.context().newCDPSession(page);
  const initial = await page.evaluate(() => ({
    camera: { ...neuroMapApp.renderer.camera },
    tree: neuroMapApp.state
      .getAllNodes()
      .map((n) => [n.id, n.text, n.parentId, n.manualX, n.manualY]),
  }));
  const touch = (type, points) =>
    session.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points.map((p) => ({
        x: p[0],
        y: p[1],
        id: p[2],
        radiusX: 2,
        radiusY: 2,
      })),
    });
  await touch("touchStart", [
    [90, 300, 1],
    [210, 300, 2],
  ]);
  for (let i = 1; i <= 12; i++)
    await touch("touchMove", [
      [90 - i * 2, 300, 1],
      [210 + i * 2, 300, 2],
    ]);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const camera = await page.evaluate(() => ({
    ...neuroMapApp.renderer.camera,
  }));
  expect(camera.zoom).toBeCloseTo(initial.camera.zoom * 1.4, 3);
  const worldX = (150 - initial.camera.x) / initial.camera.zoom,
    worldY = (300 - initial.camera.y) / initial.camera.zoom;
  expect(camera.x + worldX * camera.zoom).toBeCloseTo(150, 1);
  expect(camera.y + worldY * camera.zoom).toBeCloseTo(300, 1);
  await touch("touchEnd", [[234, 300, 2]]);
  const held = await page.evaluate(() => ({ ...neuroMapApp.renderer.camera }));
  await touch("touchMove", [[280, 390, 2]]);
  await touch("touchEnd", []);
  await page.waitForTimeout(100);
  expect(
    await page.evaluate(() => ({ ...neuroMapApp.renderer.camera })),
  ).toEqual(held);
  expect(
    await page.evaluate(() =>
      neuroMapApp.state
        .getAllNodes()
        .map((n) => [n.id, n.text, n.parentId, n.manualX, n.manualY]),
    ),
  ).toEqual(initial.tree);
  expect(await page.evaluate(() => visualViewport.scale)).toBe(1);
});

test("project picker opens an actual file and app export produces a readable project", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page);
  await page.locator("#glauka-projects-open").click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Apri da Google Drive / File…", exact: true })
    .click();
  const input = await chooser;
  await input.setFiles({
    name: "phone-notes.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Prova telefono\n## Un concetto\n"),
  });
  await expect(page.locator("#nm-android-root-preview")).toBeVisible();
  await page.locator('#nm-android-root-preview [data-action="create"]').click();
  await expect
    .poll(() => page.evaluate(() => neuroMapApp.state.root.text))
    .toBe("phone-notes");
  await expect(page.locator("#glauka-projects-open strong")).toHaveText(
    "phone-notes",
  );
  await page.locator("#glauka-options-open").click();
  await page
    .getByRole("button", { name: "Esporta e condividi", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Progetto JSON", exact: true })
    .click();
  const file = await download;
  const path = info.outputPath("exported-project.json");
  await file.saveAs(path);
  const payload = JSON.parse(require("node:fs").readFileSync(path, "utf8"));
  expect(payload.root.text).toBe("phone-notes");
});

async function saveAndroidShot(page, name) {
  const dir = process.env.GLAUKA_ANDROID_SHOTS_DIR;
  if (!dir) return;
  const fs = require("node:fs");
  const path = require("node:path");
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, name) });
}

test("Projects sheet shows Drive/SAF link, recent files, and direct overwrite", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page);
  await page.evaluate(() => {
    window.__overwritten = [];
    window.NMAndroid = {
      saveProject: () => true,
      pickProjectDocument: () => true,
      reopenDocument: () => true,
      overwriteProject: (docId, dataUri, filename, reqId) => {
        window.__overwritten.push({ docId, filename, reqId, ok: !!dataUri });
        return true;
      },
    };
    const sampleDoc = {
      format: "glauka",
      version: 1,
      root: {
        id: "r-drive",
        text: "Ripasso Biologia",
        children: [{ id: "c1", text: "Mitocondri", children: [] }],
      },
      images: [],
      relationships: [],
    };
    const json = JSON.stringify(sampleDoc);
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    window.NeuroMapLifecycle.androidOpenedProject({
      ok: true,
      docId: "drive-doc-1",
      filename: "Ripasso Biologia.gk",
      writable: true,
      persistent: true,
      base64: b64,
    });
  });
  await expect
    .poll(() => page.evaluate(() => neuroMapApp.state.root.text))
    .toBe("Ripasso Biologia");
  await page.locator("#glauka-projects-open").click();
  await expect(
    page.getByRole("button", { name: "Apri da Google Drive / File…", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Condividi o trasferisci mappa…", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Salva su Drive / File collegato", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("File recenti (Drive / Dispositivo)")).toBeVisible();
  await expect(page.locator(".glauka-recent-file", { hasText: "Ripasso Biologia.gk" })).toBeVisible();
  await saveAndroidShot(page, "01-projects-recent-drive.png");
  await page
    .getByRole("button", { name: "Salva su Drive / File collegato", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__overwritten.length))
    .toBeGreaterThan(0);
  const call = await page.evaluate(() => window.__overwritten[0]);
  expect(call.docId).toBe("drive-doc-1");
  expect(call.filename).toBe("Ripasso Biologia.gk");
  expect(call.ok).toBe(true);
});

test("Condividi o trasferisci mappa and Dark theme work cleanly on 393x852", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page);
  await page.locator("#glauka-options-open").click();
  await page
    .getByRole("button", { name: "Condividi o trasferisci mappa…", exact: true })
    .click();
  const shareModal = page.locator("#nm-map-share");
  await expect(shareModal).toBeVisible();
  const lightBox = await shareModal.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      scrollWidth: document.documentElement.scrollWidth,
      overflowX: el.scrollWidth - el.clientWidth,
    };
  });
  expect(lightBox.left).toBeGreaterThanOrEqual(-1);
  expect(lightBox.right).toBeLessThanOrEqual(394);
  expect(lightBox.scrollWidth).toBeLessThanOrEqual(394);
  await saveAndroidShot(page, "02-map-share-light.png");

  for (const stageBtn of ["Su un altro dispositivo", "I miei dispositivi", "Salva o esporta una copia"]) {
    const btn = shareModal.locator("button", { hasText: stageBtn }).first();
    if (await btn.count()) {
      await btn.click();
      const stageWidth = await shareModal.evaluate((el) => el.getBoundingClientRect().right);
      expect(stageWidth).toBeLessThanOrEqual(394);
    }
  }
  await page.keyboard.press("Escape");
  await expect(shareModal).toBeHidden();

  await page.locator("#glauka-options-open").click();
  await page
    .getByRole("button", { name: "Aspetto dell’interfaccia", exact: true })
    .click();
  const styleOverlay = page.locator("#gl-android-style-overlay");
  await expect(styleOverlay).toBeVisible();
  await styleOverlay
    .getByRole("combobox", { name: "Tema", exact: true })
    .selectOption("dark");
  await expect
    .poll(() => page.evaluate(() => document.body.dataset.glAndroidTheme))
    .toBe("dark");
  const darkHeaderBg = await page
    .locator("#glauka-app-header")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(darkHeaderBg).not.toBe("rgb(255, 255, 255)");
  await styleOverlay.locator(".gl-android-style-close").click();
  await expect(styleOverlay).toBeHidden();

  await page.locator("#glauka-options-open").click();
  await saveAndroidShot(page, "03-dark-options.png");
  await page
    .getByRole("button", { name: "Condividi o trasferisci mappa…", exact: true })
    .click();
  await expect(shareModal).toBeVisible();
  const darkShareBg = await shareModal.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(darkShareBg).not.toBe("rgb(255, 255, 255)");
  await saveAndroidShot(page, "04-map-share-dark.png");
});

test("Studio & Strumenti shows SVG tool icons, SR KPI cards, and share bridge", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page);
  await page.locator("#nm74-launch").click();
  const overlay = page.locator("#nm74-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.locator(".nm74-tab .nm74-tool-icon svg")).toHaveCount(14);
  await saveAndroidShot(page, "05-studio-catalog.png");

  await overlay.locator('[data-section="cards"]').click();
  await expect(overlay.locator(".nm74-kpi-grid .nm74-kpi-card")).toHaveCount(4);
  await expect(
    overlay.getByRole("button", { name: "Ripassa / Quiz adesso", exact: true }),
  ).toBeVisible();
  await saveAndroidShot(page, "06-studio-flashcards-kpi.png");

  await overlay.locator("#nm74-tools-back").click();
  const expGroup = overlay.locator(".nm74-experimental");
  if ((await expGroup.count()) && !(await expGroup.evaluate((e) => e.open))) {
    await expGroup.locator("summary").first().click();
  }
  await overlay.locator('[data-section="share"]').click();
  const openShareBtn = overlay.getByRole("button", {
    name: /Condividi \/ Trasferisci mappa/,
  });
  await expect(openShareBtn).toBeVisible();
  await openShareBtn.click();
  await expect(overlay).toBeHidden();
  await expect(page.locator("#nm-map-share")).toBeVisible();
});
