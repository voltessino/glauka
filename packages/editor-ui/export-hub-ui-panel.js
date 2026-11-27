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
    async function withTab(tab, fn) {
      if (!tab || tab.id === app.activeTabId) return await fn();
      const prevTabId = app.activeTabId;
      const prevCam = app.renderer?.camera ? { ...app.renderer.camera } : null;
      const prevScheduleSave = app.scheduleSave;
      app.scheduleSave = () => {};
      try {
        app.activateTab?.(tab.id, false);
        return await fn();
      } finally {
        app.activateTab?.(prevTabId, false);
        if (prevCam && app.renderer?.camera)
          Object.assign(app.renderer.camera, prevCam);
        app.recalculateAndRender?.();
        app.renderTabBar?.();
        app.scheduleSave = prevScheduleSave;
      }
    }
    async function runSingleVisual(tab, type, visOpts) {
      return await withTab(tab, async () => {
        const mode = host.NeuroMapViewCore?.mode(app.state?.root?.viewMode) || "mindmap";
        if (mode !== "mindmap" && host.NeuroMapLinkedViews) {
          if (type === "svg" && host.NeuroMapLinkedViews.exportSVG)
            return await host.NeuroMapLinkedViews.exportSVG(app, { awaitResult: true });
          if (type === "png" && host.NeuroMapLinkedViews.exportPNG)
            return await host.NeuroMapLinkedViews.exportPNG(app, visOpts.scale, { awaitResult: true });
          if (type === "pdf-graphic" && host.NeuroMapLinkedViews.exportPDF)
            return await host.NeuroMapLinkedViews.exportPDF(app, { awaitResult: true });
        }
        return await (
          type === "svg"
            ? app.io.exportSVG
            : type === "png"
              ? app.io.exportPNG
              : app.io.exportPDF
        ).call(app.io, visOpts);
      });
    }
    async function captureVisualTab(tab, type, visOpts) {
      return await withTab(tab, async () => {
        const mode = host.NeuroMapViewCore?.mode(app.state?.root?.viewMode) || "mindmap";
        if (mode !== "mindmap" && host.NeuroMapLinkedViews) {
          if (type === "svg" && host.NeuroMapLinkedViews.exportSVG)
            return await host.NeuroMapLinkedViews.exportSVG(app, { captureOnly: true });
          if (type === "png" && host.NeuroMapLinkedViews.exportPNG)
            return await host.NeuroMapLinkedViews.exportPNG(app, visOpts.scale, { captureOnly: true });
          if (type === "pdf-graphic" && host.NeuroMapLinkedViews.exportPDF)
            return await host.NeuroMapLinkedViews.exportPDF(app, { captureOnly: true });
        }
        const opts = { ...visOpts, captureOnly: true, silent: true };
        return await (
          type === "svg"
            ? app.io.exportSVG
            : type === "png"
              ? app.io.exportPNG
              : app.io.exportPDF
        ).call(app.io, opts);
      });
    }
    async function captureVisualPdfPages(tab, visOpts) {
      return await withTab(tab, async () => {
        const mode = host.NeuroMapViewCore?.mode(app.state?.root?.viewMode) || "mindmap";
        if (mode !== "mindmap" && host.NeuroMapLinkedViews?.exportPDFPage) {
          const pg = await host.NeuroMapLinkedViews.exportPDFPage(app);
          const landscape = pg.width >= pg.height;
          const pageW = visOpts.paper === "a4" ? (landscape ? 841.89 : 595.28) : (landscape ? 1190.55 : 841.89);
          const pageH = visOpts.paper === "a4" ? (landscape ? 595.28 : 841.89) : (landscape ? 841.89 : 1190.55);
          const margin = 28, maxW = pageW - margin * 2, maxH = pageH - margin * 2;
          const fitScale = Math.min(maxW / pg.width, maxH / pg.height);
          const innerW = pg.width * fitScale, innerH = pg.height * fitScale;
          return [{ data: pg.jpeg, width: pg.width, height: pg.height, pageW, pageH, margin, innerW, innerH }];
        }
        if (typeof app.io.renderGraphicalPDFPages === "function")
          return await app.io.renderGraphicalPDFPages({ ...visOpts, silent: true });
        const captured = await app.io.exportPDF({ ...visOpts, captureOnly: true, silent: true });
        return captured.pages || [];
      });
    }
    async function saveFolderFiles(subdir, files) {
      const encoded = files.map((f) => ({
        name: f.name,
        bytes:
          typeof f.data === "string"
            ? new TextEncoder().encode(f.data)
            : f.data instanceof Uint8Array
              ? f.data
              : new Uint8Array(f.data),
      }));
      if (typeof host.neuromapDesktop?.saveExportFolder === "function") {
        const res = await host.neuromapDesktop.saveExportFolder({
          subdir,
          files: encoded,
        });
        return !!(res && !res.cancelled);
      }
      if (typeof host.showDirectoryPicker === "function") {
        try {
          const dir = await host.showDirectoryPicker({ mode: "readwrite" });
          const sub = await dir.getDirectoryHandle(subdir, { create: true });
          for (const item of encoded) {
            const fh = await sub.getFileHandle(item.name, { create: true });
            const writable = await fh.createWritable();
            await writable.write(item.bytes);
            await writable.close();
          }
          return true;
        } catch (err) {
          if (err?.name === "AbortError") return false;
          if (err?.name === "SecurityError" || err?.name === "NotAllowedError")
            return null;
          throw err;
        }
      }
      return null;
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
          const visOpts = visualOptions();
          if (n === 1) {
            const result = await runSingleVisual(maps[0], type, visOpts);
            if (result === false)
              throw Error(
                t(
                  "Salvataggio annullato o non riuscito.",
                  "Save cancelled or failed.",
                ),
              );
          } else if (type === "pdf-graphic" && !separate) {
            const allPages = [];
            for (const tab of maps) {
              const pages = await captureVisualPdfPages(tab, visOpts);
              allPages.push(...pages);
            }
            const blob = app.io.buildGraphicalPDFBlob(allPages);
            const saved = await app.io.triggerDownload(
              blob,
              "neuromap_" + n + "_schede.pdf",
            );
            if (saved === false)
              throw Error(
                t(
                  "Salvataggio annullato o non riuscito.",
                  "Save cancelled or failed.",
                ),
              );
          } else {
            const ext = type === "pdf-graphic" ? "pdf" : type;
            const seenNames = new Set();
            const safeBase = (raw) =>
              String(raw || "Mappa")
                .normalize("NFC")
                .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
                .trim()
                .slice(0, 85) || "Mappa";
            const uniqueZipName = (title) => {
              const base = safeBase(title);
              let candidate = base + "." + ext,
                suffix = 2;
              while (seenNames.has(candidate.toLowerCase()))
                candidate = base + "_" + suffix++ + "." + ext;
              seenNames.add(candidate.toLowerCase());
              return candidate;
            };
            const files = [];
            for (const tab of maps) {
              const captured = await captureVisualTab(tab, type, visOpts);
              if (!captured?.data)
                throw Error(
                  t(
                    "Impossibile generare l’esportazione grafica.",
                    "Unable to generate graphical export.",
                  ),
                );
              files.push({
                name: uniqueZipName(tab.state?.root?.text || tab.title),
                data: captured.data,
              });
            }
            let saved;
            if (deliveryMode === "folder" && canSaveFolder && files.length > 1) {
              const firstTitle =
                maps[0]?.state?.root?.text || maps[0]?.title || "Mappa";
              const subdir =
                String(firstTitle)
                  .normalize("NFC")
                  .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
                  .trim()
                  .slice(0, 60) + "_export";
              const folderResult = await saveFolderFiles(subdir, files);
              if (folderResult === null) {
                const archive = Core.zip(files);
                saved = await app.io.triggerDownload(
                  new Blob([archive], { type: "application/zip" }),
                  "neuromap_" + ext + "_" + n + "_schede.zip",
                );
              } else {
                saved = folderResult;
              }
            } else {
              const archive = Core.zip(files);
              saved = await app.io.triggerDownload(
                new Blob([archive], { type: "application/zip" }),
                "neuromap_" + ext + "_" + n + "_schede.zip",
              );
            }
            if (saved === false)
              throw Error(
                t(
                  "Salvataggio annullato o non riuscito.",
                  "Save cancelled or failed.",
                ),
              );
          }
        } else {
          const isDocModular = Core.MODULAR_FORMATS?.includes(type);
          const options = {
            separate: separate && n > 1,
            splitMode: isDocModular ? splitMode : separate && n > 1 ? "tabs" : "single",
            preset: densityPreset,
            hierarchicalNumbering: isDocModular ? numberingEnabled : false,
            serializeMarkdown: (node) =>
              host.NeuroMapCore.serializeMarkdown(node),
            serializeJSON: json,
          };
          const result =
            type === "pdf"
              ? await Core.pdf(maps, options)
              : Core.render(maps, type, options);
          let saved;
          if (
            result.separate &&
            result.files &&
            result.files.length > 1 &&
            deliveryMode === "folder" &&
            canSaveFolder
          ) {
            const firstTitle =
              maps[0]?.state?.root?.text || maps[0]?.title || "Mappa";
            const subdir =
              String(firstTitle)
                .normalize("NFC")
                .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
                .trim()
                .slice(0, 60) +
              (options.splitMode === "modular" ? "_moduli" : "_export");
            const folderResult = await saveFolderFiles(subdir, result.files);
            if (folderResult === null) {
              saved = await app.io.triggerDownload(
                new Blob([result.data], { type: result.mime }),
                result.name,
              );
            } else {
              saved = folderResult;
            }
          } else {
            saved = await app.io.triggerDownload(
              new Blob([result.data], { type: result.mime }),
              result.name,
            );
          }
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
        const docs = String(source || "")
          .replace(/^\uFEFF/, "")
          .replace(/\r\n?/g, "\n")
          .split(/^\s*---\s*$/m)
          .map((s) => s.trimEnd())
          .filter((s) => s.trim());
        if (docs.length > 1 && docs.length <= 20 && app.parseTextHierarchy) {
          const parsedTabs = docs.map((d) => app.parseTextHierarchy(d, "txt")).filter((p) => p?.root);
          if (parsedTabs.length > 1) {
            const workspace = {
              schema: "NeuroMapArchitect-WorkspaceBatch-v6",
              tabs: parsedTabs.map((p) => ({ root: p.root })),
            };
            return originalImport(
              new File([JSON.stringify(workspace)], "neuromap-text-batch.json", {
                type: "application/json",
              }),
              options,
            );
          }
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
