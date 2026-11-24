    function selectControl(id, it, en, choices) {
      const label = el("label", "nm-export-option"),
        caption = el("span", null, t(it, en));
      const select = el("select", "nm-export-select");
      select.id = id;
      label.htmlFor = id;
      for (const [value, it, en] of choices) {
        const option = el("option", null, t(it, en));
        option.value = value;
        select.append(option);
      }
      label.append(caption, select);
      controls.append(label);
      select.addEventListener("change", renderPreview);
      return select;
    }
    const pagination = selectControl(
      "nm-export-pagination",
      "Impaginazione",
      "Page layout",
      [
        ["fit", "Mappa intera · una pagina", "Whole map · one page"],
        [
          "tiles",
          "Più fogli · stampa in grande",
          "Multiple sheets · large print",
        ],
      ],
    );
    const paper = selectControl(
      "nm-export-paper",
      "Formato pagina",
      "Paper size",
      [
        ["a3", "A3", "A3"],
        ["a4", "A4", "A4"],
      ],
    );
    const orientation = selectControl(
      "nm-export-orientation",
      "Orientamento",
      "Orientation",
      [
        ["landscape", "Orizzontale", "Landscape"],
        ["portrait", "Verticale", "Portrait"],
      ],
    );
    const resolution = selectControl(
      "nm-export-resolution",
      "Risoluzione PNG",
      "PNG resolution",
      [
        ["1", "Standard · 1×", "Standard · 1×"],
        ["2", "Alta · 2×", "High · 2×"],
        ["3", "Massima · 3×", "Maximum · 3×"],
      ],
    );
    resolution.value = "2";
    const previewTitle = el(
      "strong",
      null,
      t("Anteprima dell’esportazione", "Export preview"),
    );
    const preview = el("canvas", "nm-export-preview");
    preview.id = "nm-export-preview";
    preview.setAttribute("role", "img");
    const previewInfo = el("p", "nm-export-preview-info");
    previewInfo.setAttribute("role", "status");
    visual.append(controls, previewTitle, preview, previewInfo);
    let previewVersion = 0;
    const visualOptions = () => ({
      pagination: pagination.value,
      paper: paper.value,
      orientation: orientation.value,
      scale: Number(resolution.value),
    });
    async function renderPreview() {
      const version = ++previewVersion,
        type = format.value,
        isPDF = type === "pdf-graphic";
      visual.hidden =
        !["png", "pdf-graphic"].includes(type) || scope !== "current";
      for (const control of [pagination, paper, orientation])
        control.parentElement.hidden = !isPDF;
      resolution.parentElement.hidden = isPDF;
      if (visual.hidden) return;
      previewInfo.textContent = t(
        "Preparazione anteprima…",
        "Preparing preview…",
      );
      try {
        app.closeEditor?.(true);
        app._nmCaptionEditor?.finish(true);
        app._nmCaptionPanel?.flush(true);
        await app.renderer.prepareExportImages();
        if (version !== previewVersion || visual.hidden) return;
        const graphics = host.NeuroMapGraphics,
          plan = graphics.exportPlan(graphics.bounds(app), {
            ...visualOptions(),
            format: type,
          });
        const fullW = isPDF
          ? plan.cols * plan.innerW * plan.worldPerPt
          : plan.mapW;
        const fullH = isPDF
          ? plan.rows * plan.innerH * plan.worldPerPt
          : plan.mapH;
        const scale = Math.min(900 / fullW, 520 / fullH);
        preview.width = Math.max(1, Math.round(fullW * scale));
        preview.height = Math.max(1, Math.round(fullH * scale));
        const ctx = preview.getContext("2d");
        if (!ctx) throw Error("Canvas unavailable");
        ctx.fillStyle = graphics.background();
        ctx.fillRect(0, 0, preview.width, preview.height);
        app.renderer.render(ctx, {
          scale,
          tx: -(isPDF ? plan.startX : plan.mapX),
          ty: -(isPDF ? plan.startY : plan.mapY),
        });
        if (isPDF && plan.cols * plan.rows > 1) {
          ctx.strokeStyle = "#a5b4fc";
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          for (let c = 1; c < plan.cols; c++) {
            const x = c * plan.innerW * plan.worldPerPt * scale;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, preview.height);
          }
          for (let r = 1; r < plan.rows; r++) {
            const y = r * plan.innerH * plan.worldPerPt * scale;
            ctx.moveTo(0, y);
            ctx.lineTo(preview.width, y);
          }
          ctx.stroke();
        }
        const count = isPDF ? plan.cols * plan.rows : 1;
        previewInfo.textContent = isPDF
          ? count +
            t(
              count === 1
                ? " pagina · mappa intera"
                : " pagine · linee tratteggiate = separazione dei fogli",
              count === 1
                ? " page · whole map"
                : " pages · dashed lines = sheet boundaries",
            )
          : plan.width +
            " × " +
            plan.height +
            " px" +
            t(" · mappa intera", " · whole map");
        preview.setAttribute(
          "aria-label",
          t("Anteprima della mappa: ", "Map preview: ") +
            previewInfo.textContent,
        );
        preview.dataset.pages = String(count);
      } catch (error) {
        if (version === previewVersion)
          previewInfo.textContent =
            t("Anteprima non disponibile: ", "Preview unavailable: ") +
            error.message;
      }
    }
    panel.append(
      head,
      scopeGroup,
      formatGroup,
      filesGroup,
      hint,
      visual,
      actions,
    );
    shade.append(panel);
    document.body.append(shade);
    const descriptions = {
      md: t(
        "Testo gerarchico con note e stili essenziali. Non include immagini o posizioni.",
        "Hierarchy with notes and basic styling; no images or positions.",
      ),
      txt: t(
        "Testo indentato universalmente leggibile, senza formattazione grafica.",
        "Plain indented text without graphical styling.",
      ),
      opml: t(
        "Struttura per altri programmi di outline. Note incluse, grafica esclusa.",
        "Outline hierarchy with notes but no map graphics.",
      ),
      mm: t(
        "FreeMind e Freeplane. Ogni file .mm contiene una sola mappa.",
        "FreeMind and Freeplane; one map per .mm file.",
      ),
      html: t(
        "Documento HTML offline navigabile, con titoli espandibili e note.",
        "Offline navigable HTML with collapsible topics and notes.",
      ),
      docx: t(
        "Documento Word modificabile con titoli gerarchici e note; immagini e disposizione grafica escluse.",
        "Editable Word outline with notes, without pictures or original map geometry.",
      ),
      pdf: t(
        "PDF documentale in pagine-immagine con testo e note: non selezionabile, non replica il Canvas.",
        "PDF outline rendered as image pages: text is not selectable and it does not reproduce the map canvas.",
      ),
      "pdf-graphic": t(
        "Tutta la mappa in una pagina. Puoi scegliere più fogli per stamparla in grande.",
        "The whole map on one page. Choose multiple sheets for a larger print.",
      ),
      json: t(
        "Backup NeuroMap con immagini, relazioni e impostazioni disponibili.",
        "NeuroMap backup with available images, relationships and settings.",
      ),
      neuromap: t(
        "Progetto nativo. Per più schede produce uno workspace JSON o uno ZIP di progetti.",
        "Native project. Multiple maps yield workspace JSON or a ZIP of projects.",
      ),
      svg: t(
        "Disegno vettoriale della sola scheda attiva.",
        "Vector drawing of the active map only.",
      ),
      png: t(
        "Immagine della sola scheda attiva.",
        "Image of the active map only.",
      ),
    };
    const all = () => app.tabs || [];
    const chosen = () =>
      Core.selected(all(), scope, [...selectedIds], app.activeTabId);
