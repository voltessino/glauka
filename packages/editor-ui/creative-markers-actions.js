  function install(App) {
    const render = App.prototype.nm62RenderAssets;
    App.prototype.nm62RenderAssets = function (which = "markers") {
      if (!this._nmMarkerUI) return render.call(this, which);
      const ui = this._nmMarkerUI;
      ui.which = which;
      ui.localize();
      document
        .getElementById("nm62-markers-tab")
        .classList.toggle("active", which === "markers");
      document
        .getElementById("nm62-gallery-tab")
        .classList.toggle("active", which === "gallery");
      if (which === "gallery") render.call(this, which);
      else renderMarkers(this);
      ui.category.hidden = which !== "markers";
      ui.search.placeholder = tr(
        which === "markers" ? "Cerca un simbolo…" : "Cerca un’illustrazione…",
        which === "markers" ? "Find a symbol…" : "Find an illustration…",
      );
      ui.filter();
      ui.chips();
    };
    const open = App.prototype.nm62OpenAssets;
    App.prototype.nm62OpenAssets = function (...args) {
      open.apply(this, args);
      const pane = document.getElementById("nm62-assets");
      pane.querySelector("[role=dialog]")?.setAttribute("aria-modal", "false");
      if (root.GlaukaMobile) {
        pane.querySelector('[role=dialog]')?.setAttribute('aria-modal','true');
        document.getElementById('nm62-close')?.focus({preventScroll:true});
      } else this._nmMarkerUI?.search.focus({ preventScroll: true });
    };
    const activate = App.prototype.activateTab;
    App.prototype.activateTab = function (id, ...args) {
      if (id !== this.activeTabId)
        document.getElementById("nm62-assets")?.classList.add("hidden");
      return activate.call(this, id, ...args);
    };
    const bind = App.prototype.bindUI;
    App.prototype.bindUI = function (...args) {
      const r = bind.apply(this, args);
      mount(this);
      return r;
    };
    const status = App.prototype.updateStatus;
    App.prototype.updateStatus = function (...args) {
      const r = status.apply(this, args),
        pane = document.getElementById("nm62-assets");
      if (this._nmMarkerUI && !pane.classList.contains("hidden")) {
        if (
          this._nm62AssetTarget !== this.state.selectedNodeId ||
          this._nm62AssetTab !== this.activeTabId
        ) {
          this._nm62AssetTarget = this.state.selectedNodeId;
          this._nm62AssetTab = this.activeTabId;
          this.nm62RenderAssets(this._nmMarkerUI.which);
        }
      }
      return r;
    };
  }
  function target(app) {
    return app._nm62AssetTab === app.activeTabId &&
      !app.state.selectedImageId &&
      !app.state.selectedRelationshipId
      ? app.state.findNode(app._nm62AssetTarget)
      : null;
  }
  function toggle(app, id) {
    const n = target(app);
    if (!n) return;
    const next = [...(n.markers || [])];
    if (next.includes(id)) next.splice(next.indexOf(id), 1);
    else if (next.length < 3) next.push(id);
    else {
      app.showToast(
        tr(
          "Puoi scegliere fino a 3 simboli per nodo. Rimuovine uno per sostituirlo.",
          "Choose up to 3 symbols per node. Remove one to replace it.",
        ),
        "MARCATORI",
      );
      return;
    }
    app.state.pushHistory();
    n.markers = next;
    app.markChanged();
    app.nm62RenderAssets("markers");
  }
  function renderMarkers(app) {
    const host = document.getElementById("nm62-gallery-root"),
      n = target(app);
    host.replaceChildren();
    for (const [key, it, en] of groups) {
      const section = document.createElement("section");
      section.dataset.category = key;
      const heading = document.createElement("h3");
      heading.textContent = tr(it, en);
      const grid = document.createElement("div");
      grid.className = "nm62-grid";
      section.append(heading, grid);
      for (const entry of entries.filter((e) => e.category === key)) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "nm62-tile";
        b.dataset.marker = entry.id;
        b.dataset.search = (
          entry.it +
          " " +
          entry.en +
          " " +
          entry.id
        ).toLowerCase();
        b.title = tr(entry.it, entry.en);
        b.setAttribute("aria-label", b.title);
        b.setAttribute(
          "aria-pressed",
          String(!!n?.markers?.includes(entry.id)),
        );
        b.classList.toggle("active", !!n?.markers?.includes(entry.id));
        b.disabled = !n;
        const glyph = document.createElement("span");
        glyph.className = "nm62-glyph";
        glyph.textContent = entry.symbol;
        glyph.setAttribute("aria-hidden", "true");
        b.append(glyph);
        b.onclick = () => toggle(app, entry.id);
        grid.append(b);
      }
      host.append(section);
    }
  }
