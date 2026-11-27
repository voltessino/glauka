    function drawTabs() {
      tabs.replaceChildren();
      for (const tab of all()) {
        const lab = el("label", "nm-export-tab"),
          cb = el("input"),
          name = el(
            "span",
            null,
            tab.title || tab.state?.root?.text || "Mappa",
          );
        cb.type = "checkbox";
        cb.checked = selectedIds.has(tab.id);
        cb.addEventListener("change", () => {
          if (cb.checked) selectedIds.add(tab.id);
          else selectedIds.delete(tab.id);
          update();
        });
        lab.append(cb, name);
        tabs.append(lab);
      }
    }
    function update() {
      for (const [id, b] of scopes)
        b.setAttribute("aria-pressed", String(scope === id));
      tabs.hidden = scope !== "selected";
      const fmt = format.value,
        isDocModular = Core.MODULAR_FORMATS?.includes(fmt),
        targets = (() => {
          try {
            return chosen();
          } catch {
            return [];
          }
        })(),
        n =
          scope === "current"
            ? 1
            : scope === "all"
              ? all().length
              : selectedIds.size,
        zipOnly = ["mm", "svg", "png"].includes(fmt) && n > 1;

      optModular.disabled = !isDocModular;
      optModular.title = isDocModular
        ? ""
        : t(
            "La suddivisione in blocchi di parole si applica ai formati documentali (.md, .txt, .html, .docx, .pdf).",
            "Word-based splitting applies to document formats (.md, .txt, .html, .docx, .pdf).",
          );
      optTabs.disabled = n <= 1;
      optSingle.disabled = zipOnly;

      if (!isDocModular && splitMode === "modular") {
        splitMode = zipOnly ? "tabs" : userSeparate && n > 1 ? "tabs" : "single";
      }
      if (zipOnly) {
        splitMode = "tabs";
        separate = true;
      } else if (splitMode === "tabs" && n <= 1) {
        splitMode = "single";
        separate = false;
      } else if (splitMode === "modular") {
        separate = false;
      } else if (n <= 1) {
        separate = false;
      } else {
        separate = splitMode === "tabs" || userSeparate;
        if (separate) splitMode = "tabs";
      }

      if (splitSelect.value !== splitMode) splitSelect.value = splitMode;
      densityRow.hidden = splitMode !== "modular" || !isDocModular;
      densitySelect.disabled = !isDocModular || splitMode !== "modular";
      numberingCheck.disabled = !isDocModular;
      numberingWrap.title = isDocModular
        ? ""
        : t(
            "La numerazione gerarchica dei titoli è disponibile per i formati documentali.",
            "Hierarchical heading numbering is available for document formats.",
          );
      numberingCheck.checked = isDocModular && numberingEnabled;

      const est = isDocModular
        ? Core.TreeChunker.estimate(targets, {
            splitMode,
            preset: densityPreset,
            hierarchicalNumbering: numberingEnabled,
          })
        : { files: zipOnly || (separate && n > 1) ? n : targets.length ? 1 : 0, totalWords: 0, avgWords: 0 };

      const showMultiDelivery =
        n > 0 && ((splitMode === "modular" && est.files > 1) || (splitMode === "tabs" && n > 1));
      deliveryRow.hidden = !showMultiDelivery;
      if (deliverySelect.value !== deliveryMode) deliverySelect.value = deliveryMode;

      filesGroup.hidden = n <= 1 || splitMode === "modular";
      one.disabled = zipOnly;
      one.setAttribute("aria-pressed", String(!separate));
      zip.setAttribute("aria-pressed", String(separate));

      if (!targets.length) {
        chunkEstimate.textContent = "";
      } else if (isDocModular && splitMode === "modular") {
        chunkEstimate.textContent =
          est.files <= 1
            ? t(
                "Mappa compatta: verrà esportato 1 solo file",
                "Compact map: 1 single file will be exported",
              )
            : t("Output stimato: ", "Estimated output: ") +
              est.files +
              t(" file (~", " files (~") +
              est.avgWords +
              t(" parole medie/file)", " avg words/file)");
      } else if (est.files > 1) {
        chunkEstimate.textContent =
          t("Output stimato: ", "Estimated output: ") +
          est.files +
          t(" file", " files") +
          (est.avgWords ? " (~" + est.avgWords + t(" parole medie/file)", " avg words/file)") : "");
      } else {
        chunkEstimate.textContent = isDocModular
          ? t(
              "Mappa compatta: verrà esportato 1 solo file",
              "Compact map: 1 single file will be exported",
            ) + (est.totalWords ? " (~" + est.totalWords + t(" parole)", " words)") : "")
          : "";
      }

      hint.textContent =
        translated(descriptions[fmt]) +
        " · " +
        t("Schede: ", "Maps: ") +
        n +
        "/" +
        all().length +
        (zipOnly
          ? t(" · Esportate come archivio ZIP", " · Exported as ZIP archive")
          : "");
      renderPreview();
      run.disabled = busy || n === 0;
      status.setAttribute("role", lastError ? "alert" : "status");
      status.textContent =
        lastError ||
        (n === 0
          ? t("Seleziona almeno una scheda.", "Choose at least one map.")
          : "");
    }
    splitSelect.addEventListener("change", () => {
      splitMode = splitSelect.value;
      if (splitMode === "modular") {
        userSeparate = false;
        if (!numberingTouched) numberingEnabled = true;
      } else if (splitMode === "tabs") {
        userSeparate = true;
      } else {
        userSeparate = false;
        if (!numberingTouched) numberingEnabled = false;
      }
      update();
    });
    densitySelect.addEventListener("change", () => {
      densityPreset = densitySelect.value;
      update();
    });
    numberingCheck.addEventListener("change", () => {
      numberingTouched = true;
      numberingEnabled = numberingCheck.checked;
      update();
    });
    deliverySelect.addEventListener("change", () => {
      deliveryMode = deliverySelect.value;
      update();
    });
    one.addEventListener("click", () => {
      userSeparate = false;
      separate = false;
      splitMode = "single";
      update();
    });
    zip.addEventListener("click", () => {
      userSeparate = true;
      separate = true;
      splitMode = "tabs";
      deliveryMode = "zip";
      update();
    });
    format.addEventListener("change", update);
    const focusables = () =>
      [
        ...panel.querySelectorAll(
          "button:not([disabled]),input:not([disabled]),select:not([disabled])",
        ),
      ].filter((x) => x.getClientRects().length);
    function keys(ev) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        hide();
      }
      if (ev.key === "Tab") {
        const a = focusables(),
          first = a[0],
          last = a.at(-1);
        if (!first || !last) return;
        // Focus can leave the dialog when an active control becomes disabled
        // during export. Bring keyboard navigation back inside the modal.
        if (!a.includes(document.activeElement)) {
          ev.preventDefault();
          (ev.shiftKey ? last : first).focus();
          return;
        }
        if (ev.shiftKey && document.activeElement === first) {
          ev.preventDefault();
          last.focus();
        }
        if (!ev.shiftKey && document.activeElement === last) {
          ev.preventDefault();
          first.focus();
        }
      }
    }
    function hide() {
      if (busy) return;
      shade.hidden = true;
      previewVersion++;
      document.removeEventListener("keydown", keys, true);
      const back = oldFocus?.getClientRects?.().length
        ? oldFocus
        : document.getElementById("btn-menu-file");
      back?.focus?.();
    }
    function localize() {
      lastError = translated(lastError);
      const walk = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walk.nextNode())) {
        if (node.parentElement.closest(".nm-export-tabs,.nm-export-status"))
          continue;
        const value = translated(node.nodeValue);
        if (value !== node.nodeValue) node.nodeValue = value;
      }
      close.setAttribute("aria-label", t("Chiudi", "Close"));
      segments.setAttribute("aria-label", t("Quali schede?", "Which maps?"));
      tabs.setAttribute("aria-label", t("Scegli le schede", "Choose maps"));
      button.textContent = t("Esporta…", "Export…");
      update();
    }
    function open() {
      lastError = "";
      localize();
      oldFocus = document.activeElement;
      selectedIds = new Set([app.activeTabId]);
      scope = "current";
      separate = false;
      format.value = "md";
      drawTabs();
      update();
      status.style.color = "";
      shade.hidden = false;
      document.addEventListener("keydown", keys, true);
      scopes.get("current").focus();
    }
    close.addEventListener("click", hide);
    cancel.addEventListener("click", hide);
    shade.addEventListener("pointerdown", (ev) => {
      if (ev.target === shade) hide();
    });
