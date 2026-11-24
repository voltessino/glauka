  function mount(app) {
    bindShapeDrop(app);
    const side=document.getElementById("inspector-sidebar");
    root.NeuroMapCreativeModules.ui.makeCollapsible(side,side,side?.querySelector(".inspector-header"));
    root.NeuroMapCreativeModules.help.install();
    if (document.getElementById("nm-creative-launcher")) return;
    const style = document.createElement("style");
    style.textContent = /* @neuromap-creative-styles */ "";
    document.head.append(style);
    document.getElementById("nm615-edit-boundary")?.remove();
    document.getElementById("nm-android-boundary")?.remove();
    const sidebar = document.getElementById("inspector-sidebar"),
      launcher = document.createElement("details");
    launcher.id = "nm-creative-launcher";
    launcher.className = "nm6-skiptranslate";
    const launchTitle = document.createElement("summary");
    launchTitle.dataset.it = "Inserisci e disegna";
    launchTitle.dataset.en = "Insert and draw";
    launchTitle.textContent = tr(
      launchTitle.dataset.it,
      launchTitle.dataset.en,
    );
    launcher.append(launchTitle);
    const launchActions = document.createElement("div");
    launchActions.className = "nm-creative-actions";
    launchActions.append(
      button("nm-insert-symbols", "Libreria creativa", "Creative library", () =>
        creativeLibraryDialog(app,"symbols"),
      ),
      button("nm-object-art-open", "Illustrazioni", "Illustrations", () =>
        creativeLibraryDialog(app,"svg"),
      ),
      button("nm-insert-formula", "Formule", "Formulas", () =>
        formulaDialog(app),
      ),
      button("nm-drawing-open", "Disegna", "Draw", () => drawingToolbar(app)),
      button("nm-creative-library", "I miei elementi", "My items", () =>
        creativeLibraryDialog(app,"personal"),
      ),
    );
    for (const action of launchActions.children) {
      action.dataset.toolLabel = "";
      action.setAttribute("aria-label", action.textContent);
    }
    launcher.append(launchActions);
    (
      sidebar?.querySelector(".inspector-header") || sidebar?.firstElementChild
    )?.after(launcher);
    const insertMenu = document.getElementById("dropdown-insert");
    if (insertMenu)
      for (const [id, it, en, action] of [
        [
          "symbols",
          "Inserisci simbolo...",
          "Insert symbol...",
          () => creativeLibraryDialog(app,"symbols"),
        ],
        [
          "formula",
          "Inserisci formula...",
          "Insert formula...",
          () => formulaDialog(app),
        ],
        [
          "drawing",
          "Disegna sulla mappa",
          "Draw on map",
          () => drawingToolbar(app),
        ],
        [
          "library",
          "Apri libreria...",
          "Open library...",
          () => creativeLibraryDialog(app,"personal"),
        ],
      ]) {
        const entry = button("nm-menu-" + id, it, en, () => {
          app.hideMenus();
          action();
        });
        entry.className = "dropdown-item nm6-skiptranslate";
        insertMenu.append(entry);
      }
    const boundary = document.createElement("section");
    boundary.id = "nm-boundary-controls";
    boundary.className = "nm6-skiptranslate";
    boundary.hidden = true;
    const strong = document.createElement("strong");
    strong.dataset.it = "Recinto selezionato";
    strong.dataset.en = "Selected boundary";
    boundary.append(
      strong,
      button(
        "nm-boundary-edit",
        "✎ Titolo del recinto",
        "✎ Boundary title",
        () => boundaryDialog(app, app.state.findNode(app.state.selectedNodeId)),
      ),
    );
    sidebar?.prepend(boundary);
    inspector.mount(app, sidebar);
    const ctx = document.getElementById("ctx-group-node"),
      container = ctx?.querySelector(".nm70-menu-items") || ctx;
    if (container) {
      const link = button(
        "nm-ctx-link-open",
        "↗ Apri collegamento",
        "↗ Open hyperlink",
        () => {
          app.hideMenus();
          openURL(nodeURL(app.state.findNode(app.state.selectedNodeId)));
        },
      );
      link.className = "ctx-item nm6-skiptranslate";
      const title = button(
        "nm-ctx-boundary-title",
        "✎ Titolo del recinto",
        "✎ Boundary title",
        () => {
          app.hideMenus();
          boundaryDialog(app, app.state.findNode(app.state.selectedNodeId));
        },
      );
      title.className = "ctx-item nm6-skiptranslate";
      container.append(link, title);
    }
    const imageMenu = document.getElementById("ctx-group-image");
    if (imageMenu) {
      const edit = button(
        "nm-graphic-edit",
        "✎ Modifica elemento",
        "✎ Edit object",
        () => {
          app.hideMenus();
          editGraphic(app);
        },
      );
      edit.className = "ctx-item nm6-skiptranslate";
      const save = button(
        "nm-graphic-library-save",
        "☆ Salva nella libreria",
        "☆ Save to library",
        () => {
          app.hideMenus();
          libraryDialog(app);
        },
      );
      save.className = "ctx-item nm6-skiptranslate";
      imageMenu.append(edit, save);
    }
    const hud = document.querySelector(".hud-bottom-left");
    if (hud) {
      const modes = document.createElement("section");
      modes.id = "nm-layout-modes";
      modes.className = "nm6-skiptranslate";
      modes.setAttribute("role", "group");
      modes.setAttribute(
        "aria-label",
        tr("Modalità di disposizione", "Layout mode"),
      );
      // The three most frequently understood layouts stay visible; the others
      // remain accessible without filling the narrow side inspector.
      const additional = document.createElement("details");
      additional.id = "nm-layout-other";
      additional.className = "nm-layout-other";
      const moreTitle = document.createElement("summary");
      moreTitle.dataset.it = "Altre disposizioni";
      moreTitle.dataset.en = "More layouts";
      moreTitle.textContent = tr(moreTitle.dataset.it, moreTitle.dataset.en);
      const moreGrid = document.createElement("div");
      moreGrid.className = "nm-layout-more-grid";
      additional.append(moreTitle, moreGrid);
      for (const [id, icon, it, en] of BUTTONS) {
        const b = button("nm-mode-" + id, it, en, () => chooseMode(app, id));
        b.dataset.mode = id;
        const tooltips = {
          clockwise: ["Mantiene la sequenza: prima i rami a destra, poi a sinistra risalendo. Il limite verticale è regolabile.", "Preserves the sequence: right side first, then up the left side. Adjustable vertical limit."],
          balanced: ["Assegna ogni ramo al lato meno occupato. Non segue un percorso orario; rispetta i lati fissati.", "Places each branch on the shorter side. Not a clockwise reading order; respects pinned sides."],
          fluid: ["Parte da destra, poi sceglie progressivamente il lato meno pieno. Puoi trascinare e fissare i rami.", "Starts on the right, then progressively fills the shorter side. Drag and pin branches."],
          columns: ["Dispone due colonne con lettura dall'alto verso il basso su entrambi i lati.", "Two columns, reading top to bottom on both sides."],
          right: ["Mette a destra i rami automatici, ma rispetta quelli fissati a sinistra.", "Places automatic branches on the right but respects left-pinned branches."],
          left: ["Mette a sinistra i rami automatici, ma rispetta quelli fissati a destra.", "Places automatic branches on the left but respects right-pinned branches."]
        };
        if(tooltips[id]) { b.dataset.titleIt=tooltips[id][0];b.dataset.titleEn=tooltips[id][1];b.title=tr(...tooltips[id]); }
        const symbol = document.createElement("span");
        symbol.className = "nm-mode-icon";
        symbol.setAttribute("aria-hidden", "true");
        symbol.innerHTML = modeIcon(id);
        const text = document.createElement("span");
        text.dataset.it = it;
        text.dataset.en = en;
        text.textContent = tr(it, en);
        delete b.dataset.it;
        delete b.dataset.en;
        b.replaceChildren(symbol, text);
        (['columns','right','left'].includes(id) ? moreGrid : modes).append(b);
      }
      modes.append(additional);
      const modeHint=document.createElement("p");
      modeHint.id="nm-fluid-mode-hint";
      modeHint.className="nm-layout-hint";
      modeHint.setAttribute("aria-live","polite");
      modes.append(modeHint);
      const mini = document.createElement("section");
      mini.id = "nm-layout-mini-preview";
      mini.className = "nm-layout-mini-preview";
      const miniTitle = document.createElement("strong");
      miniTitle.dataset.it = "Miniatura della mappa attuale";
      miniTitle.dataset.en = "Current map miniature";
      miniTitle.textContent = tr(miniTitle.dataset.it, miniTitle.dataset.en);
      const miniSvg = document.createElementNS("http://www.w3.org/2000/svg","svg");
      miniSvg.setAttribute("viewBox","0 0 320 116");
      miniSvg.setAttribute("role","img");
      const miniNote = document.createElement("small");
      miniNote.dataset.it = "Anteprima reale · sola lettura";
      miniNote.dataset.en = "Live preview · read-only";
      miniNote.textContent = tr(miniNote.dataset.it,miniNote.dataset.en);
      mini.append(miniTitle,miniSvg,miniNote);
      modes.append(mini);
      (hud.querySelector(".hud-header") || hud.firstElementChild)?.after(modes);
    }
    app.canvas.addEventListener(
      "click",
      (e) => {
        const hit = app.findHit(e.clientX, e.clientY);
        if (hit?.type === "node" && nodeURL(hit.item)) {
          const p = app.renderer.screenToWorld(e.clientX, e.clientY),
            m = app.layout.getLayout(hit.viewId || hit.item.id);
          if (
            e.ctrlKey ||
            e.metaKey ||
            (m && p.x > m.x + m.width / 2 - 24 && p.y < m.y - m.height / 2 + 24)
          ) {
            e.preventDefault();
            e.stopImmediatePropagation();
            openURL(nodeURL(hit.item));
          }
        }
      },
      true,
    );
    app.canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (app._nmDraw?.active) return;
        const hit = app.findHit(e.clientX, e.clientY);
        if (hit) return;
        const boundary = boundaryHit(app, e.clientX, e.clientY);
        if (boundary?.node) {
          e.preventDefault();
          e.stopImmediatePropagation();
          inspector.selectBoundary(app, boundary);
        }
      },
      true,
    );
    app.canvas.addEventListener(
      "dblclick",
      (e) => {
        const hit = app.findHit(e.clientX, e.clientY);
        if (
          (hit?.type === "image" || hit?.type === "image-handle") &&
          hit.item.graphic
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
          app.selectImage(hit.item.id);
          editGraphic(app);
          return;
        }
        if (!hit) {
          const found = boundaryHit(app, e.clientX, e.clientY);
          if (found?.node) {
            e.preventDefault();
            e.stopImmediatePropagation();
            inspector.selectBoundary(app, found);
            boundaryDialog(app, found.node);
          }
        }
      },
      true,
    );
    app.canvas.addEventListener("pointerleave", () => {
      if (app.renderer.hoveredBoundaryId) {
        app.renderer.hoveredBoundaryId = null;
        app.requestRender();
      }
    });
    app.canvas.addEventListener("pointermove", (e) => {
      if (app._nmDraw?.active) return;
      const hovered =
        !app.findHit(e.clientX, e.clientY) &&
        boundaryHit(app, e.clientX, e.clientY);
      const boundaryId = hovered?.node?.id || null;
      if (app.renderer.hoveredBoundaryId !== boundaryId) {
        app.renderer.hoveredBoundaryId = boundaryId;
        app.requestRender();
      }
      if (hovered) app.canvas.style.cursor = "text";
      const h = app.findHit(e.clientX, e.clientY);
      app.canvas.title =
        h?.type === "node" && nodeURL(h.item)
          ? (root.GlaukaTouchGuidance?.text("link") ?? tr(
              "Apri con ↗ o Ctrl/Cmd + clic. Modifica con doppio clic.",
              "Open with ↗ or Ctrl/Cmd + click. Double-click to edit.",
            ))
          : boundaryHit(app, e.clientX, e.clientY)
            ? (root.GlaukaTouchGuidance?.text("boundary") ?? tr(
                "Seleziona il recinto. Doppio clic per il titolo.",
                "Select boundary. Double-click for title.",
              ))
            : "";
    });
    const observer = new MutationObserver(() => {
      for (const el of [
        launcher,
        boundary,
        container,
        imageMenu,
        document.getElementById("nm-layout-modes"),
        document.getElementById("nm-drawing-toolbar"),
        ...document.querySelectorAll(".nm-creative-dialog"),
      ])
        if (el) locale(el);
      sync(app);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    locale(boundary);
    sync(app);
  }
