const { test, expect } = require("@playwright/test");
const source = require("../../packages/editor-ui/locales/source.json");
const languages = source.languages.map((l) => l.code);
const fs = require("node:fs");
const auditSource = fs.readFileSync(
  require("node:path").join(__dirname, "interface-theme-audit.spec.js"),
  "utf8",
);
const start = auditSource.indexOf("const dialogs = [");
const end = auditSource.indexOf(
  "\nfor (const [name, trigger, root] of dialogs)",
  start,
);
const dialogs = Function(auditSource.slice(start, end) + ";return dialogs")();
async function boot(page) {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { plan: "pro", developer: true, perpetual: true } }),
  );
  await page.goto("http://127.0.0.1:5174/index.html");
  await page.waitForFunction(
    () =>
      window.neuroMapApp &&
      window.GlaukaI18n &&
      !document.documentElement.classList.contains("glauka-booting"),
  );
}
async function change(page, code) {
  await page.evaluate((code) => GlaukaI18n.setLanguage(code), code);
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}
async function audit(page, selector) {
  const issues = await page.locator(selector).evaluate((el) => {
    const excluded =
      'script,style,textarea,code,pre,svg,[contenteditable],input,[data-glauka-user-content],.tab-item,.tabs-list,.ctx-header-node,#status-selected-node,.v4-explain-text,#nm67-notes-preview,.flash-heading,.spotlight-main,.spotlight-path,.spotlight-tab,#inline-editor-container,#nm-home-open-tabs,#nm-home-recent [data-action="open"],.nm-view-title,.nm-view-timeline-label,.nm616-compare-label,.nm-ai-evidence-row,.nm-ai-diff-row del,.nm-ai-diff-row>div,.flash-breadcrumb,#nm67-notes-title,.nm-kn-text,.nm-kn-name,.nm-kn-authored,.nm75-preview,.nm-di-preview,.nm-ai-evidence-answer,.nm-theme-content';
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT),
      issues = [];
    while (walk.nextNode()) {
      const n = walk.currentNode,
        p = n.parentElement,
        raw = n.nodeValue;
      if (
        !p ||
        p.closest(excluded) ||
        !p.getClientRects().length ||
        getComputedStyle(p).visibility === "hidden"
      )
        continue;
      const translated = p.hasAttribute("data-glauka-ui-pair") && p.dataset.it != null
        ? GlaukaI18n.pair(p.dataset.it,p.dataset.en) : GlaukaI18n.translate(raw);
      if (raw !== translated)
        issues.push({
          text: raw.trim(),
          expected: translated.trim(),
          element: p.id || p.className,
        });
    }
    for (const p of el.querySelectorAll("[title],[placeholder],[aria-label]")) {
      if (
        p.closest(excluded.replace("textarea,", "").replace("input,", "")) ||
        !p.getClientRects().length
      )
        continue;
      for (const attr of ["title", "placeholder", "aria-label"]) {
        const raw = p.getAttribute(attr);
        const expected = attr === "aria-label" && p.hasAttribute("data-glauka-ui-pair")
          ? GlaukaI18n.pair(p.dataset.itLabel,p.dataset.enLabel) : GlaukaI18n.translate(raw);
        if (raw && expected !== raw)
          issues.push({
            text: raw,
            expected,
            attr,
            element: p.id || p.className,
          });
      }
    }
    return issues;
  });
  expect(issues, selector + " has untranslated owned UI").toEqual([]);
}
test.describe("desktop interface languages", () => {
  for (const code of languages)
    test(`${code}: language is in Tools, Home translates, preference survives reload and project content is unchanged`, async ({
      page,
    }, info) => {
      await boot(page);
      await expect(page.locator(".top-chrome #nm6-locale-button")).toHaveCount(
        0,
      );
      await expect(page.locator("#dropdown-tools #glauka-language-select")).toHaveCount(0);
      await page.evaluate(() => NeuroMapSettingsCenter.open());
      await expect(page.locator("#gl-settings-language option")).toHaveCount(8);
      await expect(page.locator("#gl-settings-language option")).toHaveText([
        "Italiano",
        /English|Inglese/,
        "Deutsch",
        "Español",
        "Français",
        "Português",
        "العربية",
        "简体中文",
      ]);
      const before = await page.evaluate(() => {
        const a = neuroMapApp;
        a.state.root.text = "Save";
        a.state.root.notes = "Close";
        return JSON.stringify(a.state.createSnapshot());
      });
      await change(page, code);
      await audit(page, "#nm6-welcome");
      await expect(page.locator("#gl-settings-language option")).toHaveText([
        "Italiano",
        /English|Inglese/,
        "Deutsch",
        "Español",
        "Français",
        "Português",
        "العربية",
        "简体中文",
      ]);
      await expect(page.locator("#btn-menu-file")).toHaveText(
        {
          it: "File",
          en: "File",
          de: "Datei",
          es: "Archivo",
          fr: "Fichier",
          pt: "Ficheiro",
          ar: "ملف",
          "zh-CN": "文件",
        }[code],
      );
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        code === "ar" ? "rtl" : "ltr",
      );
      expect(
        await page.evaluate(() =>
          JSON.stringify(neuroMapApp.state.createSnapshot()),
        ),
      ).toBe(before);
      for (const name of ["file", "edit", "insert", "view", "tools", "help"]) {
        await page.locator("#btn-menu-" + name).evaluate((e) => e.click());
        await audit(page, "#dropdown-" + name);
        await page.evaluate(() => neuroMapApp.hideMenus());
      }
      if (code === "ar" || code === "zh-CN" || code === "de")
        await page.screenshot({
          path: info.outputPath("home-" + code + ".png"),
        });
      await page.reload();
      await page.waitForFunction(
        () =>
          window.neuroMapApp &&
          !document.documentElement.classList.contains("glauka-booting"),
      );
      await expect(page.locator("html")).toHaveAttribute("lang", code);
      await audit(page, "#nm6-welcome");
      expect(
        await page.evaluate(() => GlaukaI18n.inspect().loadedCatalogs.length),
      ).toBeLessThanOrEqual(3);
    });
  for (const [name, trigger, selector] of dialogs)
    test(`${name}: open window translates in every supported language`, async ({
      page,
    }) => {
      test.setTimeout(90000);
      await boot(page);
      await page.evaluate(() =>
        document
          .querySelectorAll(".nm6-shade")
          .forEach((e) => e.classList.add("hidden")),
      );
      if(name === "AI assistant")await page.evaluate(()=>{nmProduct.isPro=()=>true;});
      await page.locator(trigger).evaluate((e) => e.click());
      await expect(page.locator(selector)).toBeVisible();
      for (const code of languages) {
        await change(page, code);
        await audit(page, selector);
      }
    });
  test("authored labels, notes and filenames remain literal in linked views and note previews", async ({
    page,
  }) => {
    await boot(page);
    await page.evaluate(() => {
      document
        .querySelectorAll(".nm6-shade")
        .forEach((e) => e.classList.add("hidden"));
      neuroMapApp.importHierarchy(
        {
          text: "Save",
          notes: "Close",
          children: [{ text: "Apply", notes: "File", children: [] }],
        },
        { newTab: true },
      );
      NeuroMapLinkedViews.setMode(neuroMapApp, "orgchart");
    });
    await expect(
      page
        .locator("#nm-view-stage .nm-view-title")
        .filter({ hasText: /^Save$/ }),
    ).toBeVisible();
    const before = await page.evaluate(() =>
      JSON.stringify(neuroMapApp.state.createSnapshot()),
    );
    for (const code of ["de", "es", "fr", "pt", "ar", "zh-CN", "en", "it"]) {
      await change(page, code);
      await expect(
        page
          .locator("#nm-view-stage .nm-view-title")
          .filter({ hasText: /^Save$/ }),
      ).toBeVisible();
      await expect(
        page
          .locator("#nm-view-stage .nm-view-title")
          .filter({ hasText: /^Apply$/ }),
      ).toBeVisible();
      expect(
        await page.evaluate(() =>
          JSON.stringify(neuroMapApp.state.createSnapshot()),
        ),
      ).toBe(before);
    }
  });
  test("composed note headings switch language while the node name and note remain authored text", async ({
    page,
  }) => {
    await boot(page);
    await page.evaluate(() => {
      document
        .querySelectorAll(".nm6-shade")
        .forEach((e) => e.classList.add("hidden"));
      neuroMapApp.importHierarchy(
        { text: "Save", notes: "Close", children: [] },
        { newTab: true },
      );
      neuroMapApp.selectNode(neuroMapApp.state.root.id);
      document.getElementById("nm-tool-links").click();
    });
    for (const code of languages) {
      await change(page, code);
      const expected = await page.evaluate(
        () =>
          GlaukaI18n.pair("Note e collegamenti · ", "Notes and links · ") +
          "Save",
      );
      await expect(
        page.locator("#nm75-overlay .nm75-panel>strong").first(),
      ).toHaveText(expected);
      await expect(
        page.locator("#nm75-overlay .nm75-preview p").first(),
      ).toHaveText("Close");
    }
  });
  test("offline quiz prompts translate live while quoted concepts and answers stay literal", async ({
    page,
  }) => {
    await boot(page);
    await page.evaluate(() => {
      document
        .querySelectorAll(".nm6-shade")
        .forEach((e) => e.classList.add("hidden"));
      neuroMapApp.importHierarchy(
        { text: "Save $&", notes: "Close $&", children: [] },
        { newTab: true },
      );
      document.getElementById("nm-learn-open").click();
    });
    await page.locator("#nm-learn-panel .nm-learn-tabs button").nth(1).click();
    await page
      .locator("#nm-learn-panel")
      .getByRole("button", { name: "Inizia quiz", exact: true })
      .click();
    const original = "Cosa riportano gli appunti di «Save $&»?";
    for (const code of languages) {
      await change(page, code);
      const expected = await page.evaluate(
        (original) => GlaukaI18n.translate(original),
        original,
      );
      if (code !== "it") expect(expected).not.toBe(original);
      expect(expected).toContain("Save $&");
      await expect(page.locator(".nm-learn-question")).toHaveText(expected);
      await expect(page.locator(".nm-learn-answer")).toHaveText("Close $&");
      expect(
        await page.evaluate(() => neuroMapApp.learningAttempts?.length || 0),
      ).toBe(0);
    }
  });
  test("new document and branch defaults follow the active language without renaming existing concepts", async ({
    page,
  }) => {
    await boot(page);
    await change(page, "zh-CN");
    await page.evaluate(() => {
      document
        .querySelectorAll(".nm6-shade")
        .forEach((e) => e.classList.add("hidden"));
      neuroMapApp.createNewTab();
      neuroMapApp.addChild();
      neuroMapApp.closeEditor(true);
    });
    const before = await page.evaluate(() => {
      const a = neuroMapApp;
      return {
        root: a.state.root.text,
        child: a.state.findNode(a.state.selectedNodeId).text,
        id: a.state.selectedNodeId,
      };
    });
    expect(before.root).toBe("新导图");
    expect(before.child).toBe("新节点");
    await change(page, "de");
    expect(
      await page.evaluate(
        (id) => neuroMapApp.state.findNode(id).text,
        before.id,
      ),
    ).toBe("新节点");
    await page.evaluate(() => {
      neuroMapApp.addChild();
      neuroMapApp.closeEditor(true);
    });
    expect(
      await page.evaluate(
        () => neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).text,
      ),
    ).toBe("Neuer Knoten");
    expect(await page.evaluate(() => neuroMapApp.state.root.text)).toBe(
      "新导图",
    );
  });
});
