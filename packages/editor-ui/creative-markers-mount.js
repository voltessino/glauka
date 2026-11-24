  function mount(app) {
    // bindUI wrappers may run more than once across plugin installs; keep one
    // shelf, one style tag and one language observer.
    if (app._nmMarkerUI || document.getElementById("nm-marker-search")) return;
    const pane = document.getElementById("nm62-assets"),
      panel = pane?.querySelector(".nm62-modal");
    if (!panel) return;
    pane.classList.add("nm-marker-shelf", "nm6-skiptranslate");
    panel.setAttribute("aria-modal", "false");
    const style = document.createElement("style");
    style.id = "nm-marker-shelf-styles";
    style.textContent =
      root.NeuroMapMarkers.fontCSS + /* @neuromap-marker-styles */ "";
    document.head.append(style);
    document.fonts
      .load("15px NeuroMapSymbols")
      .then(() => app.requestRender())
      .catch(() => {});
    panel.querySelector(".nm62-small").textContent = tr(
      "Simboli locali · fino a 3 per nodo",
      "Offline symbols · up to 3 per node",
    );
    const tools = document.createElement("div");
    tools.className = "nm-marker-filters";
    const search = document.createElement("input");
    search.id = "nm-marker-search";
    search.type = "search";
    search.setAttribute("aria-label", tr("Cerca simboli", "Find symbols"));
    const category = document.createElement("select");
    category.id = "nm-marker-category";
    category.setAttribute(
      "aria-label",
      tr("Categoria dei simboli", "Symbol category"),
    );
    for (const [value, it, en] of [
      ["all", "Tutte le categorie", "All categories"],
      ...groups,
    ]) {
      const o = document.createElement("option");
      o.value = value;
      o.dataset.it = it;
      o.dataset.en = en;
      o.textContent = tr(it, en);
      category.append(o);
    }
    tools.append(search, category);
    const chips = document.createElement("div");
    chips.id = "nm-marker-selected";
    const empty = document.createElement("p");
    empty.id = "nm-marker-empty";
    empty.textContent = tr(
      "Nessun simbolo trovato. Prova un altro termine.",
      "No symbols found. Try another term.",
    );
    empty.hidden = true;
    const host = document.getElementById("nm62-gallery-root");
    host.before(chips, tools);
    host.after(empty);
    const ui = (app._nmMarkerUI = {
      search,
      category,
      which: "markers",
      localize() {
        document.getElementById("nm62-title").textContent = tr(
          "🏷️ Simboli & Libreria",
          "🏷️ Symbols & Gallery",
        );
        document.getElementById("nm62-markers-tab").textContent = tr(
          "🏷️ Simboli",
          "🏷️ Symbols",
        );
        document.getElementById("nm62-gallery-tab").textContent = tr(
          "🖼️ Libreria grafica",
          "🖼️ Graphic gallery",
        );
        document.getElementById("nm62-remove-assets").textContent = tr(
          "↺ Rimuovi",
          "↺ Remove",
        );
        document.getElementById("nm62-close").textContent = tr(
          "✕ Chiudi",
          "✕ Close",
        );
        panel.querySelector(".nm62-small").textContent = tr(
          "Simboli locali · fino a 3 per nodo",
          "Offline symbols · up to 3 per node",
        );
        search.setAttribute("aria-label", tr("Cerca simboli", "Find symbols"));
        category.setAttribute(
          "aria-label",
          tr("Categoria dei simboli", "Symbol category"),
        );
        empty.textContent = tr(
          "Nessun simbolo trovato. Prova un altro termine.",
          "No symbols found. Try another term.",
        );
      },
      filter() {
        let visible = 0;
        const q = search.value.trim().toLowerCase();
        for (const b of host.querySelectorAll(".nm62-tile")) {
          b.hidden = !(
            b.dataset.search || b.textContent.toLowerCase()
          ).includes(q);
          if (!b.hidden) visible++;
        }
        for (const section of host.querySelectorAll("section[data-category]")) {
          section.hidden =
            (category.value !== "all" &&
              category.value !== section.dataset.category) ||
            ![...section.querySelectorAll(".nm62-tile")].some((b) => !b.hidden);
          if (section.hidden)
            visible -= section.querySelectorAll(
              ".nm62-tile:not([hidden])",
            ).length;
        }
        empty.hidden = visible > 0;
      },
      chips() {
        chips.replaceChildren();
        const n = target(app),
          status = document.getElementById("nm62-assets-status");
        status.textContent = n
          ? tr("Nodo: ", "Node: ") +
            n.text +
            " · " +
            (n.markers || []).length +
            "/3"
          : tr("Seleziona un nodo della mappa", "Select a map node");
        status.title = n?.text || "";
        if (n)
          for (const id of n.markers || []) {
            const entry = entries.find((e) => e.id === id),
              b = document.createElement("button");
            b.type = "button";
            b.textContent = (symbols[id] || id) + " ×";
            b.setAttribute(
              "aria-label",
              tr("Rimuovi ", "Remove ") + (entry ? tr(entry.it, entry.en) : id),
            );
            b.onclick = () => toggle(app, id);
            chips.append(b);
          }
      },
    });
    search.oninput = category.onchange = () => ui.filter();
    document.getElementById("nm62-remove-assets").addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        const n = target(app);
        if (!n) return;
        const key = ui.which === "gallery" ? "illustration" : "markers";
        if (
          (key === "markers" && !n.markers?.length) ||
          (key === "illustration" && !n.illustration)
        )
          return;
        app.state.pushHistory();
        n[key] = key === "markers" ? [] : null;
        app.markChanged();
        app.nm62RenderAssets(ui.which);
      },
      true,
    );
    new MutationObserver(() => {
      locale(pane);
      if (!pane.classList.contains("hidden")) app.nm62RenderAssets(ui.which);
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
  }
