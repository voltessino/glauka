const { test, expect } = require("@playwright/test");

async function chooseView(page, mode) {
  const linked = await page.locator("#nm-view-overlay").isVisible();
  const id = linked ? "nm-view-overlay-picker" : "nm-view-picker";
  if (!linked && !(await page.locator("#" + id + "-trigger").isVisible()))
    await page.locator("#v6-show-layout").click();
  await page.locator("#" + id + "-trigger").click();
  await page.locator("#" + id + '-gallery [data-view="' + mode + '"]').click();
}
test.describe("Universal workspace desktop", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto((process.env.GLAUKA_DESKTOP_TEST_URL || (process.env.GLAUKA_DESKTOP_TEST_URL || 'http://127.0.0.1:5174/index.html')));
    await page.waitForFunction(
      () =>
        window.neuroMapApp && window.NeuroMapHome && window.NeuroMapLinkedViews,
    );
    await page.evaluate(() => {
      localStorage.removeItem("nm6_welcome_seen");
      window.NeuroMapHome.open();
      document.getElementById("nm-home-new")?.click();
    });
  });

  test("Home filters view types and previews actual blank versus guided diagrams without creating", async ({
    page,
  }) => {
    const previous = await page.evaluate(() => ({
      ids: neuroMapApp.state.root.children.map((n) => n.id),
      title: neuroMapApp.state.root.text,
      tabs: neuroMapApp.tabs.length,
    }));
    await expect(page.locator("#nm-home-gallery .nm-home-choice")).toHaveCount(
      7,
    );
    await page
      .locator('#nm-home-categories [data-category="planning"]')
      .click();
    await expect(page.locator("#nm-home-gallery .nm-home-choice")).toHaveCount(
      3,
    );
    await page
      .locator(
        '#nm-home-gallery .nm-home-choice-wrap[data-view="timeline"] .nm-home-peek',
      )
      .click();
    await expect(page.locator("#nm-home-preview-panel")).toBeVisible();
    await expect(page.locator("#nm-home-preview-art text")).toHaveCount(0);
    expect(
      await page.evaluate(() => ({
        ids: neuroMapApp.state.root.children.map((n) => n.id),
        title: neuroMapApp.state.root.text,
        tabs: neuroMapApp.tabs.length,
      })),
    ).toEqual(previous);
    await page.locator("#nm-home-template").selectOption("guided");
    await expect(page.locator("#nm-home-preview-art text")).toHaveCount(3);
    await page.locator("#nm-home-project-name").fill("Piano attività");
    await page.locator("#nm-home-preview-create").click();
    await expect(page.locator("#nm6-welcome")).toBeHidden();
    expect(
      await page.evaluate(() => ({
        title: neuroMapApp.state.root.text,
        view: neuroMapApp.state.root.viewMode,
        children: neuroMapApp.state.root.children.length,
      })),
    ).toEqual({ title: "Piano attività", view: "timeline", children: 3 });
  });

  test("Home guide can be hidden and reopened without changing project data", async ({
    page,
  }) => {
    await page.evaluate(() => {
      localStorage.removeItem("nm.home.intro-hidden.v1");
      localStorage.removeItem("nm6_welcome_seen");
      NeuroMapHome.render();
    });
    const previous = await page.evaluate(() => ({
      tabs: neuroMapApp.tabs.length,
      id: neuroMapApp.state.root.id,
    }));
    await expect(page.locator("#nm-home-intro")).toBeVisible();
    await expect(page.locator("#nm-home-intro-steps li")).toHaveCount(3);
    await page.locator("#nm-home-intro-hide").click();
    await expect(page.locator("#nm-home-intro")).toBeHidden();
    await expect(page.locator("#nm-home-intro-show")).toBeVisible();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("nm.home.intro-hidden.v1"),
      ),
    ).toBe("1");
    await page.locator("#nm-home-intro-show").click();
    await expect(page.locator("#nm-home-intro")).toBeVisible();
    expect(
      await page.evaluate(() => ({
        tabs: neuroMapApp.tabs.length,
        id: neuroMapApp.state.root.id,
      })),
    ).toEqual(previous);
  });

  test("Home previews update their language without creating new tabs", async ({
    page,
  }) => {
    await page
      .locator(
        '#nm-home-gallery .nm-home-choice-wrap[data-view="kanban"] .nm-home-peek',
      )
      .click();
    await page.locator("#nm-home-template").selectOption("guided");
    const before = await page.evaluate(() => neuroMapApp.tabs.length);
    await page.evaluate(async () => {
      await GlaukaI18n.setLanguage("en");
    });
    await expect(page.locator("#nm-home-preview-title")).toHaveText(
      "Kanban board",
    );
    const preview = page.locator("#nm-home-preview-art");
    for (const label of ["Unassigned", "To do", "Doing", "Done"])
      await expect(preview).toContainText(label);
    expect(await page.evaluate(() => neuroMapApp.tabs.length)).toBe(before);
    await expect(page.locator("#nm-home-preview-create")).toHaveText(
      "Create this project",
    );
  });

  test("native mind map retains Enter and Tab and gains Insert plus keyboard context menu", async ({
    page,
  }) => {
    await page.locator("#nm-home-template").selectOption("guided");
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="mindmap"]')
      .click();
    const target = await page.evaluate(() => {
      const app = neuroMapApp,
        id = app.state.root.children[0].id;
      app.selectNode(id);
      return id;
    });
    await page.evaluate(() => {
      neuroMapApp.canvas.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Insert",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect
      .poll(() =>
        page.evaluate(
          (id) => neuroMapApp.state.findNode(id)?.children.length,
          target,
        ),
      )
      .toBeGreaterThan(2);
    await page.evaluate((id) => {
      const app = neuroMapApp;
      app.closeEditor?.(true);
      app.selectNode(id);
      app.canvas.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "F10",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, target);
    await expect(page.locator("#context-menu")).toBeVisible();
  });

  test("linked views share contextual actions and keyboard shortcuts without browser interference", async ({
    page,
  }) => {
    await page.locator("#nm-home-template").selectOption("guided");
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="orgchart"]')
      .click();
    const initial = await page.evaluate(() => ({
      history: neuroMapApp.state.undoStack.length,
      first: neuroMapApp.state.root.children[0].id,
      count: neuroMapApp.state.root.children.length,
    }));
    let card = page.locator(
      '#nm-view-stage .nm-view-card[data-node-id="' + initial.first + '"]',
    );
    await card.focus();
    await card.press("F2");
    await expect(card.locator("input.nm-view-edit")).toBeVisible();
    await card.locator("input.nm-view-edit").fill("Ramo aggiornato");
    await card.locator("input.nm-view-edit").press("Enter");
    card = page.locator(
      '#nm-view-stage .nm-view-card[data-node-id="' + initial.first + '"]',
    );
    await expect(card).toContainText("Ramo aggiornato");
    await card.click({ button: "right" });
    await expect(page.locator("#nm-view-context")).toBeVisible();
    await expect(
      page.locator('#nm-view-context [data-action="rename"]'),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#nm-view-context")).toBeHidden();
    await expect(page.locator("#nm-view-overlay")).toBeVisible();
    await card.focus();
    await card.press("Insert");
    await expect
      .poll(() =>
        page.evaluate(
          (id) => neuroMapApp.state.findNode(id)?.children.length,
          initial.first,
        ),
      )
      .toBeGreaterThan(0);
    expect(
      await page.evaluate(() => neuroMapApp.state.root.children.length),
    ).toBe(initial.count);
  });

  test("Timeline and secondary tree use the same rename and collapse actions", async ({
    page,
  }) => {
    await page.locator("#nm-home-template").selectOption("guided");
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="orgchart"]')
      .click();
    const rootId = await page.evaluate(
      () => neuroMapApp.state.root.children.find((n) => n.children.length)?.id,
    );
    await page.locator("#nm-view-split").click();
    await page.locator("#nm-dual-picker").selectOption("concept-tree");
    const card = page.locator(
      '#nm-dual-stage .nm-view-card[data-node-id="' + rootId + '"]',
    );
    await expect(card.locator(".nm-view-collapse")).toBeVisible();
    await card.locator(".nm-view-collapse").click();
    await expect(card.locator(".nm-view-collapse")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await page.evaluate(() => {
      const app = neuroMapApp,
        node = app.state.root.children[0];
      app.state.setNodeWorkMetadata(node.id, {
        startDate: "2026-11-01",
        dueDate: "2026-11-03",
      });
      window.NeuroMapLinkedViews.setMode(app, "timeline");
    });
    const dateId = await page.evaluate(
      () => neuroMapApp.state.root.children[0].id,
    );
    const task = page.locator(
      '#nm-view-stage .nm-timeline-card[data-node-id="' + dateId + '"]',
    );
    await expect(task).toBeVisible();
    await task.dblclick();
    await expect(task.locator("input.nm-view-edit")).toBeVisible();
  });

  test("Home offers seven actual document views without creating a second starter tab", async ({
    page,
  }) => {
    await expect(page.locator("#nm-home-gallery .nm-home-choice")).toHaveCount(
      7,
    );
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="orgchart"]')
      .click();
    await expect(page.locator("#nm6-welcome")).toBeHidden();
    await expect(page.locator("#nm-view-overlay")).toBeVisible();
    const actual = await page.evaluate(() => ({
      mode: neuroMapApp.state.root.viewMode,
      tabs: neuroMapApp.tabs.length,
      title: neuroMapApp.state.root.text,
    }));
    expect(actual).toEqual({
      mode: "orgchart",
      tabs: 1,
      title: "Organigramma",
    });
    await page.locator("#nm-home-open").click();
    await expect(page.locator("#nm-home-open-tabs button")).toHaveCount(1);
    await page.locator("#nm-home-new").click();
    const timeline = page.locator(
      '#nm-home-gallery .nm-home-choice[data-view="timeline"]',
    );
    await timeline.scrollIntoViewIfNeeded();
    await timeline.click();
    await expect(page.locator("#nm-view-overlay")).toBeVisible();
    expect(await page.evaluate(() => neuroMapApp.state.root.viewMode)).toBe(
      "timeline",
    );
    expect(await page.evaluate(() => neuroMapApp.tabs.length)).toBe(2);
  });

  test("an imported document named Mappa Centrale is preserved as a separate tab", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const app = window.neuroMapApp;
      app._nmHomePlaceholder = false;
      app.state.root.text = "Mappa Centrale";
      app.state.isDirty = false;
      app._desktopUserEdited = false;
      window.NeuroMapHome.render();
    });
    const before = await page.evaluate(
      () => window.neuroMapApp.tabs[0].state.root.id,
    );
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="flowchart"]')
      .click();
    const after = await page.evaluate(() => ({
      oldId: neuroMapApp.tabs[0].state.root.id,
      tabs: neuroMapApp.tabs.length,
      current: neuroMapApp.state.root.viewMode,
    }));
    expect(after).toEqual({ oldId: before, tabs: 2, current: "flowchart" });
  });

  test("Home creates a named project with the chosen template and view", async ({
    page,
  }) => {
    await page.locator("#nm-home-project-name").fill("Studio anatomia");
    await page.locator("#nm-home-template").selectOption("guided");
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="concept-tree"]')
      .click();
    expect(
      await page.evaluate(() => ({
        title: neuroMapApp.state.root.text,
        mode: neuroMapApp.state.root.viewMode,
        count: neuroMapApp.state.root.children.length,
      })),
    ).toEqual({ title: "Studio anatomia", mode: "concept-tree", count: 4 });
    await page.locator("#nm-home-open").click();
    await expect(page.locator("#nm-home-open-tabs")).toContainText(
      "Studio anatomia",
    );
    await expect(page.locator("#nm-home-project-name")).toHaveValue("");
  });

  test("illustrated view picker switches presentations without copying or deleting project nodes", async ({
    page,
  }) => {
    await page.locator("#nm-home-template").selectOption("guided");
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="mindmap"]')
      .click();
    const original = await page.evaluate(() =>
      neuroMapApp.state.root.children.map((n) => n.id),
    );
    await expect(page.locator("#nm-project-views")).toHaveCount(0);
    await chooseView(page, "orgchart");
    await expect(page.locator("#nm-view-overlay")).toBeVisible();
    await expect(page.locator("#nm-view-overlay-picker")).toHaveValue(
      "orgchart",
    );
    await chooseView(page, "concept-tree");
    expect(await page.evaluate(() => neuroMapApp.state.root.viewMode)).toBe(
      "concept-tree",
    );
    await chooseView(page, "mindmap");
    await expect(page.locator("#nm-view-overlay")).toBeHidden();
    expect(
      await page.evaluate(() =>
        neuroMapApp.state.root.children.map((n) => n.id),
      ),
    ).toEqual(original);
  });

  test("Kanban plus Timeline edits the same task and restores both views after reload", async ({
    page,
  }) => {
    await page.locator("#nm-home-template").selectOption("guided");
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="kanban"]')
      .click();
    await page.locator("#nm-view-split").click();
    await expect(page.locator("#nm-dual-pane")).toBeVisible();
    await expect(page.locator("#nm-dual-picker")).toHaveValue("timeline");
    const id = await page.evaluate(() => neuroMapApp.state.root.children[0].id);
    await page.locator("#nm-dual-task").selectOption(id);
    await page.locator("#nm-dual-start").fill("2026-11-03");
    await page.locator("#nm-dual-due").fill("2026-11-12");
    await page.locator("#nm-dual-apply-dates").click();
    await expect
      .poll(() =>
        page.evaluate((id) => neuroMapApp.state.findNode(id)?.dueDate, id),
      )
      .toBe("2026-11-12");
    await page
      .locator("#nm-project-view-options")
      .evaluate((el) => (el.open = true));
    await page.locator("#nm-workspace-layout-name").fill("Attività e scadenze");
    await page.locator("#nm-workspace-save").click();
    await page.evaluate(() => neuroMapApp.persistWorkspace());
    await page.reload();
    await page.waitForFunction(
      () => window.neuroMapApp && window.NeuroMapLinkedViews,
    );
    await expect(page.locator("#nm-dual-pane")).toBeVisible();
    await expect(page.locator("#nm-dual-picker")).toHaveValue("timeline");
    expect(
      await page.evaluate(
        (id) => ({
          view: neuroMapApp.state.root.viewMode,
          date: neuroMapApp.state.findNode(id)?.dueDate,
          count: neuroMapApp.state.root.children.length,
          layouts: neuroMapApp.tabs.find(
            (t) => t.id === neuroMapApp.activeTabId,
          )?.viewWorkspace.layouts.length,
        }),
        id,
      ),
    ).toMatchObject({ view: "kanban", date: "2026-11-12", layouts: 1 });
  });

  test("Concept network and org chart share edits without cloning node IDs", async ({
    page,
  }) => {
    await page.locator("#nm-home-template").selectOption("guided");
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="concept-network"]')
      .click();
    const ids = await page.evaluate(() =>
      neuroMapApp.state.root.children.map((n) => n.id),
    );
    await page.locator("#nm-view-split").click();
    await page.locator("#nm-dual-picker").selectOption("orgchart");
    await expect(page.locator("#nm-dual-pane")).toBeVisible();
    const target = ids[0];
    await page
      .locator('#nm-dual-stage .nm-view-card[data-node-id="' + target + '"]')
      .dblclick();
    const editor = page.locator("#nm-dual-stage input.nm-view-edit");
    await editor.fill("Nodo aggiornato in entrambe le viste");
    await editor.press("Enter");
    await expect
      .poll(() =>
        page.evaluate((id) => neuroMapApp.state.findNode(id)?.text, target),
      )
      .toBe("Nodo aggiornato in entrambe le viste");
    await expect(
      page.locator(
        '#nm-view-stage .nm-view-card[data-node-id="' + target + '"]',
      ),
    ).toContainText("Nodo aggiornato in entrambe le viste");
    expect(
      await page.evaluate(() =>
        neuroMapApp.state.root.children.map((n) => n.id),
      ),
    ).toEqual(ids);
  });

  test("saved workspace layouts restore split view and width after reloading session", async ({
    page,
  }) => {
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="mindmap"]')
      .click();
    await page
      .locator("#nm-project-view-options")
      .evaluate((el) => (el.open = true));
    if (!(await page.locator("#nm-workspace-layouts").isVisible()))
      await page.locator("#v6-show-layout").click();
    await page.locator("#nm-workspace-layouts").selectOption("builtin:kanban");
    await expect(page.locator("#nm-view-overlay")).toHaveClass(/nm-side-panel/);
    await page.locator("#nm-workspace-width").evaluate((input) => {
      input.value = "62";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page
      .locator("#nm-project-view-options")
      .evaluate((el) => (el.open = true));
    await page.locator("#nm-workspace-layout-name").fill("Studio + attività");
    await page.locator("#nm-workspace-save").click();
    const original = await page.evaluate(() => {
      const app = neuroMapApp,
        tab = app.tabs.find((t) => t.id === app.activeTabId);
      app.persistWorkspace();
      return { id: app.state.root.id, layout: tab.viewWorkspace.layouts[0] };
    });
    expect(original.layout).toMatchObject({
      name: "Studio + attività",
      primaryMode: "mindmap",
      sideMode: "kanban",
      width: 62,
    });
    await page.reload();
    await page.waitForFunction(
      () => window.NeuroMapLinkedViews && window.neuroMapApp,
    );
    await expect(page.locator("#nm-view-overlay")).toHaveClass(/nm-side-panel/);
    await expect(page.locator("#nm-view-overlay-picker")).toHaveValue("kanban");
    await expect(page.locator("#nm-workspace-width")).toHaveValue("62");
    expect(await page.evaluate(() => neuroMapApp.state.root.id)).toBe(
      original.id,
    );
  });

  test("file-associated workspace layout is applied to a reopened project tab", async ({
    page,
  }) => {
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="mindmap"]')
      .click();
    const result = await page.evaluate(() => {
      const app = neuroMapApp;
      const location = "C:\\\\Study\\\\Example.neuromap";
      app._nmViewWorkspaceArchive = [
        {
          filePath: location,
          originSheetIndex: 0,
          updatedAt: Date.now(),
          viewWorkspace: {
            sideMode: "timeline",
            width: 59,
            activeName: "Timeline studio",
            layouts: [
              {
                name: "Timeline studio",
                primaryMode: "mindmap",
                sideMode: "timeline",
                width: 59,
              },
            ],
          },
        },
      ];
      const previous = new Set(app.tabs.map((t) => t.id));
      app.addTab(app.newState("Reopened"), "Reopened");
      const tab = app.tabs.find((t) => t.id === app.activeTabId);
      app.v6SetOrigin(
        { path: location, filename: "Example.neuromap" },
        previous,
      );
      return {
        name: tab.viewWorkspace.layouts[0]?.name,
        side: tab.viewWorkspace.sideMode,
        count: app.tabs.length,
      };
    });
    expect(result).toMatchObject({
      name: "Timeline studio",
      side: "timeline",
      count: 2,
    });
    await expect(page.locator("#nm-view-overlay-picker")).toHaveValue(
      "timeline",
    );
  });

  test("Home search filters open projects and saved recents and pins saved files locally", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const app = neuroMapApp,
        record = (path, title, updatedAt) => ({
          filePath: path,
          originSheetIndex: 0,
          title,
          updatedAt,
          tabId: title,
          nodes: [{ id: title, text: title, depth: 0 }],
        });
      window.neuromapDesktop = {
        openProject: async () => ({ cancelled: true }),
      };
      app._nmAtlasArchive = [
        record("C:\\\\Maps\\\\Alpha.neuromap", "Alpha", 10),
        record("C:\\\\Maps\\\\Beta.neuromap", "Beta", 20),
      ];
      window.NeuroMapHome.render();
    });
    await page.locator("#nm-home-back").click();
    await expect(
      page.locator('#nm-home-recent button[data-action="open"]'),
    ).toHaveCount(2);
    await page.locator("#nm-home-search").fill("Alpha");
    await expect(
      page.locator('#nm-home-recent button[data-action="open"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('#nm-home-recent button[data-action="open"]'),
    ).toContainText("Alpha");
    await page.locator('#nm-home-recent button[data-action="pin"]').click();
    await page.locator("#nm-home-search").fill("");
    await expect(
      page.locator('#nm-home-recent button[data-action="open"]').first(),
    ).toContainText("Alpha");
    await expect(
      page.locator('#nm-home-recent button[data-action="pin"]').first(),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("zoom controls have accessible Italian action names", async ({
    page,
  }) => {
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="orgchart"]')
      .click();
    await expect(page.locator("#nm-view-zoom-in")).toHaveAttribute(
      "aria-label",
      "Aumenta zoom",
    );
    await expect(page.locator("#nm-view-zoom-out")).toHaveAttribute(
      "aria-label",
      "Riduci zoom",
    );
  });

  test("guided flowchart creates editable nodes and explicit Yes/No edges", async ({
    page,
  }) => {
    await page.locator("#nm-home-template").selectOption("guided");
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="flowchart"]')
      .click();
    const result = await page.evaluate(() => ({
      mode: neuroMapApp.state.root.viewMode,
      count: neuroMapApp.state.root.children.length,
      edges: neuroMapApp.state.relationships,
      dirty: neuroMapApp.state.isDirty,
    }));
    expect(result.mode).toBe("flowchart");
    expect(result.count).toBe(5);
    expect(result.edges).toHaveLength(5);
    expect(result.edges.map((x) => x.kind)).toEqual([
      "sequence",
      "yes",
      "no",
      "sequence",
      "sequence",
    ]);
    expect(result.dirty).toBe(true);
  });

  test("guided Kanban starts with statuses and guided timeline with editable example dates", async ({
    page,
  }) => {
    await page.locator("#nm-home-template").selectOption("guided");
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="kanban"]')
      .click();
    const statuses = await page.evaluate(() =>
      neuroMapApp.state.root.children.map((x) => x.taskStatus),
    );
    expect(statuses).toContain("todo");
    expect(statuses).toContain("doing");
    expect(statuses).toContain("done");
    await page.locator("#nm-home-open").click();
    await page.locator("#nm-home-new").click();
    const timeline = page.locator(
      '#nm-home-gallery .nm-home-choice[data-view="timeline"]',
    );
    await timeline.scrollIntoViewIfNeeded();
    await timeline.click();
    const dates = await page.evaluate(() =>
      neuroMapApp.state.root.children.map((n) => n.dueDate),
    );
    expect(dates).toHaveLength(3);
    for (const date of dates) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("saved-file recents are bounded and a wrong selected path cannot import", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const app = window.neuroMapApp;
      const original = "C:\\\\Maps\\\\Sample.neuromap";
      app._nmAtlasArchive = [
        {
          filePath: original,
          originSheetIndex: 0,
          title: "Sample map",
          updatedAt: Date.now(),
          tabId: "saved",
          nodes: [{ id: "sample", text: "Sample map", depth: 0 }],
        },
      ];
      window.neuromapDesktop = {
        openProject: async () => ({
          path: "C:\\\\Maps\\\\Wrong.neuromap",
          filename: "Wrong.neuromap",
          bytes: [1],
        }),
      };
      app.nmAsk = async () => "open";
      app._nmRecentTestImports = 0;
      app.v6ImportNative = async () => {
        app._nmRecentTestImports++;
      };
      window.NeuroMapHome.render();
    });
    await page.locator("#nm-home-back").click();
    await expect(
      page.locator('#nm-home-recent button[data-action="open"]'),
    ).toHaveCount(1);
    await page.locator('#nm-home-recent button[data-action="open"]').click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.getElementById("nm6-welcome").classList.contains("hidden"),
        ),
      )
      .toBe(false);
    expect(await page.evaluate(() => neuroMapApp._nmRecentTestImports)).toBe(0);
  });

  test("recent files do not appear without a native desktop opener", async ({
    page,
  }) => {
    const status = await page
      .locator("#nm-home-recent-area")
      .evaluate((el) => el.hidden);
    expect(status).toBe(true);
  });

  test("Home traps editing keys away from the document canvas", async ({
    page,
  }) => {
    const before = await page.evaluate(
      () => window.neuroMapApp.state.getAllNodes().length,
    );
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="mindmap"]')
      .focus();
    await page.keyboard.press("Tab");
    await expect(page.locator("#nm6-welcome")).toBeVisible();
    const after = await page.evaluate(
      () => window.neuroMapApp.state.getAllNodes().length,
    );
    expect(after).toBe(before);
  });

  test("Home hidden CSS does not leave an invisible blocking overlay", async ({
    page,
  }) => {
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="orgchart"]')
      .click();
    await expect(page.locator("#nm6-welcome")).toBeHidden();
    const css = await page.evaluate(
      () => getComputedStyle(document.getElementById("nm6-welcome")).display,
    );
    expect(css).toBe("none");
  });

  test("view zoom only transforms the stage, not the browser window or chrome", async ({
    page,
  }) => {
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="concept-tree"]')
      .click();
    const before = await page.evaluate(() => ({
      chrome: document.querySelector(".topbar")?.getBoundingClientRect().height,
      viewport: innerWidth,
      scale: devicePixelRatio,
    }));
    await page.locator("#nm-view-zoom-in").click();
    await expect(page.locator("#nm-view-zoom-status")).toHaveText("120%");
    let result = await page.evaluate(() => ({
      transform: document.getElementById("nm-view-stage").style.transform,
      chrome: document.querySelector(".topbar")?.getBoundingClientRect().height,
      viewport: innerWidth,
      scale: devicePixelRatio,
    }));
    expect(result.transform).toContain("1.2");
    expect(result.chrome).toBe(before.chrome);
    expect(result.viewport).toBe(before.viewport);
    expect(result.scale).toBe(before.scale);
    await page.locator("#nm-view-scroller").focus();
    await page.keyboard.press("Control+-");
    await expect(page.locator("#nm-view-zoom-status")).toHaveText("100%");
    await page.locator("#nm-view-zoom-fit").click();
    const fitted = await page.evaluate(() => ({
      width: document.getElementById("nm-view-frame").getBoundingClientRect()
        .width,
      scrollWidth: document.getElementById("nm-view-scroller").clientWidth,
      zoom: Number(
        document
          .getElementById("nm-view-zoom-status")
          .textContent.replace("%", ""),
      ),
    }));
    expect(fitted.zoom).toBeGreaterThan(0);
    expect(fitted.width).toBeLessThanOrEqual(fitted.scrollWidth + 2);
  });

  test("Ctrl-minus does not zoom the browser while editing a linked-view node", async ({
    page,
  }) => {
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="orgchart"]')
      .click();
    await page.locator("#nm-view-stage .nm-view-card").first().dblclick();
    await expect(page.locator("#nm-view-stage .nm-view-edit")).toBeVisible();
    const before = await page.evaluate(() => ({
      scale: devicePixelRatio,
      width: innerWidth,
      height: innerHeight,
    }));
    await page.locator("#nm-view-stage .nm-view-edit").press("Control+-");
    await expect(page.locator("#nm-view-zoom-status")).toHaveText("100%");
    const after = await page.evaluate(() => ({
      scale: devicePixelRatio,
      width: innerWidth,
      height: innerHeight,
    }));
    expect(after).toEqual(before);
  });

  test("trackpad-style Ctrl-wheel zooms the view without resizing browser chrome", async ({
    page,
  }) => {
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="concept-tree"]')
      .click();
    const before = await page.evaluate(() => ({
      width: innerWidth,
      dpr: devicePixelRatio,
      toolbar: document.querySelector(".topbar")?.getBoundingClientRect()
        .height,
    }));
    await page
      .locator("#nm-view-scroller")
      .hover({ position: { x: 80, y: 80 } });
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -100);
    await page.keyboard.up("Control");
    await expect
      .poll(() => page.locator("#nm-view-zoom-status").textContent())
      .not.toBe("100%");
    const after = await page.evaluate(() => ({
      width: innerWidth,
      dpr: devicePixelRatio,
      toolbar: document.querySelector(".topbar")?.getBoundingClientRect()
        .height,
    }));
    expect(after).toEqual(before);
  });

  test("Fit can display an exceptionally wide linked visualization", async ({
    page,
  }) => {
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="timeline"]')
      .click();
    await page.waitForFunction(
      () => document.getElementById("nm-view-stage")?.offsetWidth > 0,
    );
    await page.evaluate(() => {
      const stage = document.getElementById("nm-view-stage");
      stage.style.width = "20000px";
      stage.style.height = "6000px";
    });
    await page.locator("#nm-view-zoom-fit").click();
    const measures = await page.evaluate(() => ({
      frame: document.getElementById("nm-view-frame").offsetWidth,
      viewport: document.getElementById("nm-view-scroller").clientWidth,
      scale: document.getElementById("nm-view-stage").style.transform,
    }));
    expect(measures.frame).toBeLessThanOrEqual(measures.viewport + 2);
    expect(measures.scale.startsWith("scale(0.")).toBe(true);
  });

  for (const mode of [
    "orgchart",
    "concept-tree",
    "concept-network",
    "flowchart",
    "kanban",
    "timeline",
  ]) {
    test("zoom stays inside the " + mode + " viewport", async ({ page }) => {
      await page
        .locator('#nm-home-gallery .nm-home-choice[data-view="' + mode + '"]')
        .click();
      await expect(page.locator("#nm-view-overlay")).toBeVisible();
      const before = await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        chrome: document.querySelector(".topbar")?.getBoundingClientRect()
          .height,
      }));
      await page.locator("#nm-view-zoom-in").click();
      await expect(page.locator("#nm-view-zoom-status")).toHaveText("120%");
      const after = await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        chrome: document.querySelector(".topbar")?.getBoundingClientRect()
          .height,
        transform: document.getElementById("nm-view-stage").style.transform,
      }));
      expect(after.width).toBe(before.width);
      expect(after.height).toBe(before.height);
      expect(after.chrome).toBe(before.chrome);
      expect(after.transform).toContain("scale(1.2)");
    });
  }

  test("zoom camera is restored independently for each open project", async ({
    page,
  }) => {
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="orgchart"]')
      .click();
    await page.locator("#nm-view-zoom-in").click();
    await expect(page.locator("#nm-view-zoom-status")).toHaveText("120%");
    await page.locator("#nm-home-open").click();
    await page.locator("#nm-home-new").click();
    const timeline = page.locator(
      '#nm-home-gallery .nm-home-choice[data-view="timeline"]',
    );
    await timeline.scrollIntoViewIfNeeded();
    await timeline.click();
    await expect(page.locator("#nm-view-zoom-status")).toHaveText("100%");
    await page.locator("#nm-home-open").click();
    await page.locator("#nm-home-open-tabs button").first().click();
    await expect(page.locator("#nm-view-zoom-status")).toHaveText("120%");
  });

  test("all alternate-view cameras survive switching and a full workspace reload", async ({
    page,
  }) => {
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="orgchart"]')
      .click();
    await page.locator("#nm-view-zoom-in").click();
    await page.locator("#nm-view-zoom-in").click();
    const original = await page.evaluate(() => {
      const app = window.neuroMapApp,
        el = document.getElementById("nm-view-scroller");
      el.scrollLeft = 180;
      el.scrollTop = 105;
      el.dispatchEvent(new Event("scroll"));
      const camera = {
        ...app.tabs.find((t) => t.id === app.activeTabId).viewWorkspace.cameras
          .orgchart,
      };
      app.persistWorkspace();
      return camera;
    });
    await chooseView(page, "timeline");
    await chooseView(page, "orgchart");
    expect(
      await page.evaluate(() => {
        const app = neuroMapApp,
          t = app.tabs.find((t) => t.id === app.activeTabId);
        return t.viewWorkspace.cameras.orgchart;
      }),
    ).toEqual(original);
    await page.reload();
    await page.waitForFunction(
      () => window.neuroMapApp && window.NeuroMapLinkedViews,
    );
    await expect(page.locator("#nm-view-overlay")).toBeVisible();
    const recovered = await page.evaluate(() => ({
      camera: neuroMapApp.tabs.find((t) => t.id === neuroMapApp.activeTabId)
        .viewWorkspace.cameras.orgchart,
      zoom: document.getElementById("nm-view-zoom-status").textContent,
      x: document.getElementById("nm-view-scroller").scrollLeft,
      y: document.getElementById("nm-view-scroller").scrollTop,
    }));
    expect(recovered.camera.zoom).toBe(original.zoom);
    expect(recovered.zoom).toBe(Math.round(original.zoom * 100) + "%");
    expect(Math.abs(recovered.x - original.left)).toBeLessThanOrEqual(2);
    expect(Math.abs(recovered.y - original.top)).toBeLessThanOrEqual(2);
  });

  test("primary mind map camera persists after navigation without editing nodes", async ({
    page,
  }) => {
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="mindmap"]')
      .click();
    const previous = await page.evaluate(() => {
      const app = neuroMapApp;
      Object.assign(app.renderer.camera, { x: 325, y: 218, zoom: 0.72 });
      app.requestRender();
      app.persistWorkspace();
      return {
        camera: { ...app.renderer.camera },
        id: app.state.root.id,
        history: app.state.undoStack.length,
      };
    });
    await page.reload();
    await page.waitForFunction(
      () => window.neuroMapApp && window.neuroMapApp.state,
    );
    const recovered = await page.evaluate(() => ({
      camera: neuroMapApp.renderer.camera,
      id: neuroMapApp.state.root.id,
      history: neuroMapApp.state.undoStack.length,
    }));
    expect(recovered.camera).toMatchObject(previous.camera);
    expect(recovered.id).toBe(previous.id);
    expect(recovered.history).toBe(0);
  });

  test("clockwise precedes balanced and both choices have distinct saved states", async ({
    page,
  }) => {
    await page
      .locator('#nm-home-gallery .nm-home-choice[data-view="mindmap"]')
      .click();
    await expect(
      page.locator("#nm-layout-modes [data-mode]").first(),
    ).toHaveAttribute("data-mode", "clockwise");
    const initial = await page.evaluate(() => ({
      mode: neuroMapApp.state.root.layoutMode,
      enabled: neuroMapApp.state.root.layoutDistribution?.enabled,
    }));
    expect(initial).toEqual({ mode: "clockwise", enabled: true });
    await page
      .locator('#nm-layout-modes [data-mode="balanced"]')
      .evaluate((button) => button.click());
    const balanced = await page.evaluate(() => ({
      mode: neuroMapApp.state.root.layoutMode,
      enabled: neuroMapApp.state.root.layoutDistribution?.enabled,
    }));
    expect(balanced).toEqual({ mode: "balanced", enabled: false });
    await page
      .locator('#nm-layout-modes [data-mode="clockwise"]')
      .evaluate((button) => button.click());
    const clockwise = await page.evaluate(() => ({
      mode: neuroMapApp.state.root.layoutMode,
      enabled: neuroMapApp.state.root.layoutDistribution?.enabled,
    }));
    expect(clockwise).toEqual({ mode: "clockwise", enabled: true });
  });
});

for (const locale of ["it", "en"])
  for (const width of [390, 1440])
    test(
      "project Home and illustrated view selection fit " + locale + " " + width,
      async ({ page }, info) => {
        await page.addInitScript((locale) => {
          localStorage.setItem("nm6_locale", locale);
        }, locale);
        await page.setViewportSize({ width, height: 960 });
        await page.goto((process.env.GLAUKA_DESKTOP_TEST_URL || (process.env.GLAUKA_DESKTOP_TEST_URL || 'http://127.0.0.1:5174/index.html')));
        await page.waitForFunction(
          () => window.NeuroMapHome && window.neuroMapApp,
        );
        await page.evaluate(() => NeuroMapHome.open());
        await expect(
          page.locator("#nm-home-gallery .nm-home-choice"),
        ).toHaveCount(7);
        expect(
          await page
            .locator("#nm6-welcome")
            .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath("home-" + locale + "-" + width + ".png"),
        });
        await page.locator("#nm-home-new").click();
        await page
          .locator('#nm-home-gallery .nm-home-choice[data-view="mindmap"]')
          .click();
        await expect(page.locator("#nm-project-views")).toHaveCount(0);
        for (const view of ["orgchart", "kanban", "timeline", "mindmap"])
          await chooseView(page, view);
        await page.screenshot({
          path: info.outputPath("views-" + locale + "-" + width + ".png"),
        });
      },
    );
