/* @neuromap-export-hub-ui-panel-preview */
/* @neuromap-export-hub-ui-panel-chrome */
    function json(tab) {
      // Reuse the normal save serializer against this tab without activating it.
      // This retains learning history/plans, captions and future project fields.
      const facade = Object.create(app);
      facade.state = tab.state;
      facade.activeTabId = tab.id;
      const io = Object.create(app.io);
      io.app = facade;
      return io.buildSerializedProjectPayload();
    }
    run.addEventListener("click", async () => {
      if (busy) return;
      lastError = "";
      busy = true;
      run.disabled = cancel.disabled = close.disabled = true;
      status.setAttribute("role", "status");
      status.style.color = "";
      status.textContent = t("Esportazione in corso…", "Exporting…");
      for (const control of panel.querySelectorAll("select,input"))
        control.disabled = true;
      try {
        app.closeEditor?.(true);
        app._nmCaptionEditor?.finish(true);
        app._nmCaptionPanel?.flush(true);
        app.saveActiveTabSnapshot?.();
        const maps = chosen(),
          type = format.value,
          n = maps.length;
        if (type === "svg" || type === "png" || type === "pdf-graphic") {
          if (scope !== "current")
            throw Error(
              t(
                "Esporta prima la scheda corrente.",
                "Export the current map first.",
              ),
            );
          const alternate =
            type === "svg" &&
            host.NeuroMapViewCore?.mode(app.state.root.viewMode) !==
              "mindmap" &&
            host.NeuroMapLinkedViews?.exportSVG;
          const result = alternate
            ? await host.NeuroMapLinkedViews.exportSVG(app)
            : await (
                type === "svg"
                  ? app.io.exportSVG
                  : type === "png"
                    ? app.io.exportPNG
                    : app.io.exportPDF
              ).call(app.io, visualOptions());
          if (result === false)
            throw Error(
              t(
                "Salvataggio annullato o non riuscito.",
                "Save cancelled or failed.",
              ),
            );
        } else {
          const options = {
            separate: separate && n > 1,
            serializeMarkdown: (node) =>
              host.NeuroMapCore.serializeMarkdown(node),
            serializeJSON: json,
          };
          const result =
            type === "pdf"
              ? await Core.pdf(maps, options)
              : Core.render(maps, type, options);
          const saved = await app.io.triggerDownload(
            new Blob([result.data], { type: result.mime }),
            result.name,
          );
          if (saved === false)
            throw Error(
              t(
                "Salvataggio annullato o non riuscito.",
                "Save cancelled or failed.",
              ),
            );
        }
        app.showToast?.(
          t("Esportate ", "Exported ") +
            n +
            t(" schede · ", " maps · ") +
            type.toUpperCase(),
          "EXPORT",
        );
        shade.hidden = true;
        document.removeEventListener("keydown", keys, true);
        oldFocus?.getClientRects?.().length
          ? oldFocus.focus()
          : document.getElementById("btn-menu-file")?.focus();
      } catch (error) {
        lastError = String(error?.message || error);
        status.setAttribute("role", "alert");
        status.textContent = lastError;
        status.style.color = "var(--error,#fb7185)";
      } finally {
        busy = false;
        for (const control of panel.querySelectorAll("select,input"))
          control.disabled = false;
        cancel.disabled = close.disabled = false;
        update();
      }
    });
    const button = el(
      "button",
      "dropdown-item nm-export-launch",
      t("Esporta…", "Export…"),
    );
    button.id = "nm-export-launch";
    button.type = "button";
    button.title = t(
      "Esporta una, alcune o tutte le schede",
      "Export current, selected or all maps",
    );
    button.addEventListener("click", () => {
      app.hideMenus?.();
      open();
    });
    const grid = menu.querySelector(".export-subgrid"),
      batch = menu.querySelector(".nm-ux-workspace-grid");
    if (grid) {
      grid.before(button);
      grid.hidden = true;
      grid.style.display = "none";
      if (document.getElementById("nm-share-export-open"))
        button.after(document.getElementById("nm-share-export-open"));
      const mapShare = document.getElementById("nm-map-share-open");
      const share = document.getElementById("nm-share-export-open");
      if (mapShare && share && share.parentElement === menu) share.after(mapShare);
    } else menu.append(button);
    if (batch) {
      batch.hidden = true;
      batch.style.display = "none";
    }
    for (const node of menu.querySelectorAll(".dropdown-section-title")) {
      if (
        /^(Esporta scheda|Esporta workspace|Esporta la mappa|Export tab|Export workspace)/.test(
          node.textContent.trim(),
        )
      ) {
        node.hidden = true;
        node.style.display = "none";
      }
    }
    for (const b of menu.querySelectorAll(
      '[data-export="batch-workspace-json"],[data-export="batch-md"]',
    ))
      b.style.display = "none";

    // Complementary import support: multi-map TXT/OPML and FreeMind .mm.
    // The existing native and XMind imports are otherwise left untouched.
    const originalImport = app.importFile.bind(app);
    app.importFile = async function (file, options = {}) {
      const ext = (
        String(file?.name || "")
          .split(".")
          .pop() || ""
      ).toLowerCase();
      if (ext === "mm") {
        const tree = Core.parseFreeMind(await file.text());
        return app.importHierarchy(tree, { newTab: options.newTab !== false });
      }
      if (["txt", "text"].includes(ext)) {
        const source = await file.text(),
          roots = Core.parseTxtBatch(source);
        if (roots) {
          const workspace = {
            schema: "NeuroMapArchitect-WorkspaceBatch-v6",
            tabs: roots.map((root) => ({ root })),
          };
          return originalImport(
            new File([JSON.stringify(workspace)], "neuromap-text-batch.json", {
              type: "application/json",
            }),
            options,
          );
        }
      }
      if (ext === "opml" || ext === "xml") {
        const source = await file.text(),
          doc = new DOMParser().parseFromString(source, "application/xml");
        if (
          !doc.querySelector("parsererror") &&
          doc.documentElement?.localName === "opml"
        ) {
          const outlines = [...doc.querySelectorAll("body > outline")];
          if (outlines.length) {
            let count = 0;
            const preflight = outlines.map((el) => ({ el, depth: 0 }));
            while (preflight.length) {
              const { el, depth } = preflight.pop();
              if (++count > 3500 || depth > 100)
                throw Error(
                  t(
                    "OPML troppo grande: massimo 3500 nodi e 100 livelli.",
                    "OPML too large: maximum 3500 nodes and 100 levels.",
                  ),
                );
              for (const child of el.children)
                if (child.localName === "outline")
                  preflight.push({ el: child, depth: depth + 1 });
            }
            const convert = (el) => ({
              text:
                el.getAttribute("text") || el.getAttribute("title") || "Nodo",
              notes: el.getAttribute("_note") || undefined,
              children: [...el.children]
                .filter((c) => c.localName === "outline")
                .map(convert),
            });
            const structured =
              outlines.length === 1
                ? {
                    schema: "NeuroMapArchitect-SingleTab-v6",
                    root: convert(outlines[0]),
                  }
                : {
                    schema: "NeuroMapArchitect-WorkspaceBatch-v6",
                    tabs: outlines.map((n) => ({ root: convert(n) })),
                  };
            return originalImport(
              new File(
                [JSON.stringify(structured)],
                "neuromap-opml-import.json",
                { type: "application/json" },
              ),
              options,
            );
          }
        }
      }
      return originalImport(file, options);
    };
    app._nmExportHub = { open, hide, element: shade };
    new MutationObserver(localize).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
  }
