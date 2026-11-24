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
      const n =
          scope === "current"
            ? 1
            : scope === "all"
              ? all().length
              : selectedIds.size,
        graphics = ["svg", "png", "pdf-graphic"].includes(format.value);
      const only = graphics && scope !== "current";
      if (format.value === "mm" && n > 1) separate = true;
      if (n <= 1) separate = false;
      filesGroup.hidden = n <= 1 || graphics;
      one.disabled = format.value === "mm" && n > 1;
      one.setAttribute("aria-pressed", String(!separate));
      zip.setAttribute("aria-pressed", String(separate));
      hint.textContent =
        translated(descriptions[format.value]) +
        " · " +
        t("Schede: ", "Maps: ") +
        n +
        "/" +
        all().length +
        (only
          ? t(" · Disponibile solo per la scheda attiva", " · Active map only")
          : "");
      renderPreview();
      run.disabled = busy || n === 0 || only;
      status.setAttribute("role", lastError ? "alert" : "status");
      status.textContent =
        lastError ||
        (n === 0
          ? t("Seleziona almeno una scheda.", "Choose at least one map.")
          : "");
    }
    one.addEventListener("click", () => {
      separate = false;
      update();
    });
    zip.addEventListener("click", () => {
      separate = true;
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
