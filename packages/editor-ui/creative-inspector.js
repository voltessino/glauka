/* Contextual formatting: select an object to expose only its own controls. */
(function (root) {
  "use strict";
  const { button, tr, locale } = root.NeuroMapCreativeModules.ui;
  const boundaries = root.NeuroMapCreativeModules.boundaries;
  const drawing = root.NeuroMapCreativeModules.drawing;
  function selectBoundary(app, hit) {
    app.selectNode(hit.node.id);
    app._nmBoundarySelection = {
      owner: app.state,
      id: hit.node.id,
      view: hit.view,
    };
    const sidebar = document.getElementById("inspector-sidebar");
    if (!document.body.classList.contains("glauka-mobile-app") &&
        innerWidth > 700 && sidebar?.classList.contains("collapsed"))
      document.getElementById("btn-toggle-inspector")?.click();
    app.updateStatus();
    app.requestRender();
  }
  function install(App) {
    for (const name of [
      "selectNode",
      "selectImage",
      "clearSelection",
      "selectAllBranches",
      "v5SelectRelation",
    ]) {
      const prior = App.prototype[name];
      if (!prior) continue;
      App.prototype[name] = function (...args) {
        this._nmBoundarySelection = null;
        const result = prior.apply(this, args);
        const inspector=document.getElementById("inspector-sidebar");
        if(name==="selectImage"){
          // A photo or chart owns an independent panel, never "Text and style".
          // Closing style avoids the two overlapping inspector shells.
          inspector?.classList.add("collapsed");
          this.updateImageControls?.();
        }else if(name==="v5SelectRelation" && innerWidth>700 &&
          inspector?.classList.contains("collapsed")){
          document.getElementById("btn-toggle-inspector")?.click();
        }
        return result;
      };
    }
    const position = App.prototype.positionEditor;
    App.prototype.positionEditor = function (...args) {
      const result = position.apply(this, args);
      boundaries.positionEditor(this);
      return result;
    };
    const close = App.prototype.v5CloseRelation;
    App.prototype.v5CloseRelation = function (...args) {
      const result = close.apply(this, args);
      this.updateStatus();
      return result;
    };
  }
  function nodes(app) {
    return (
      app.nm70ScopeAllNodes?.() ||
      app.nm70ScopeNodes?.() ||
      app.v6SelectedNodes?.() ||
      [app.state.findNode(app.state.selectedNodeId)].filter(Boolean)
    );
  }
  function typography(app) {
    const bold = document.getElementById("btn-weight-bold"),
      normal = document.getElementById("btn-weight-normal");
    if (!bold) return;
    const group = bold.parentElement;
    group.id = "nm-text-emphasis";
    group.setAttribute("role", "group");
    let italic = document.getElementById("nm70-italic");
    if (!italic) {
      italic = button("nm70-italic", "Corsivo", "Italic", () => {});
    }
    const oldRow = italic.parentElement;
    const underline=button("nm-text-underline","Sottolineato","Underline",()=>{});
    group.append(italic,underline);
    if (oldRow?.classList.contains("nm70-italic-row")) oldRow.hidden = true;
    if (normal) normal.hidden = true;
    for (const [control, symbol, it, en] of [
      [bold, "B", "Grassetto", "Bold"],
      [italic, "I", "Corsivo", "Italic"],
      [underline,"U","Sottolineato","Underline"],
    ]) {
      delete control.dataset.it;
      delete control.dataset.en;
      control.textContent =
        (symbol === "B" ? tr("G", "B") : symbol === "I"?tr("C", "I"):tr("S","U"));
      control.title = tr(it, en);
      control.setAttribute("aria-label", tr(it, en));
      control.dataset.nmFormat = it;
      control.dataset.nmFormatEn = en;
      control._nmApplyFormat = () => {
        const selected = nodes(app);
        if (!selected.length) return;
        const key = symbol === "B" ? "fontWeight" : symbol === "I" ? "fontItalic" : "fontUnderline";
        const value =
          symbol === "B"
            ? selected.every((n) => (n.fontWeight ?? 400) >= 650)
              ? 400
              : 700
            : !selected.every((n) => n[key]);
        if (app.nmSettingsApplyNode) {
          app.nmSettingsApplyNode(key, value);
          return;
        }
        app.state.pushHistory();
        for (const n of selected) n[key] = value;
        app.markChanged();
      };
    }
  }
  root.addEventListener(
    "click",
    (e) => {
      const control = e.target.closest?.("#nm-text-emphasis [data-nm-format]");
      if (!control) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      control._nmApplyFormat();
    },
    true,
  );
  function mount(app, sidebar) {
    const listInput=document.getElementById("inline-editor-input");
    root.NeuroMapCaption?.bindListInput(listInput);
    if(listInput&&!document.getElementById("nm-list-edit-hint")){const hint=document.createElement("small");hint.id="nm-list-edit-hint";hint.hidden=true;listInput.after(hint);listInput.addEventListener("input",()=>{const start=listInput.value.lastIndexOf("\n",listInput.selectionStart-1)+1;hint.hidden=!root.NeuroMapCaption?.automaticListsEnabled()||!root.NeuroMapCaption?.marker(listInput.value.slice(start).split("\n")[0]);hint.textContent=root.GlaukaTouchGuidance?.text("list")??tr("Invio: nuova voce · Ctrl+Invio: conferma · Maiusc+Invio: a capo","Enter: next item · Ctrl+Enter: confirm · Shift+Enter: line break")});}
    typography(app);
    const panel = document.getElementById("nm-boundary-controls");
    const label = document.createElement("label");
    label.className = "nm-object-color";
    const caption = document.createElement("span");
    caption.dataset.it = "Colore del recinto";
    caption.dataset.en = "Boundary color";
    caption.textContent = tr(caption.dataset.it, caption.dataset.en);
    const color = document.createElement("input");
    color.type = "color";
    color.id = "nm-boundary-color";
    color.setAttribute("aria-label", caption.textContent);
    color.addEventListener("change", () => {
      const n =
        app._nmBoundarySelection?.owner === app.state &&
        app.state.findNode(app._nmBoundarySelection.id);
      if (!n?.boundary?.enabled) return;
      app.state.pushHistory();
      n.boundary = { ...n.boundary, color: color.value };
      app.markChanged();
    });
    label.append(caption, color);
    panel?.append(
      label,
      button("nm-boundary-delete", "Rimuovi recinto", "Remove boundary", () => {
        const n = app.state.findNode(app._nmBoundarySelection?.id);
        if (!n) return;
        app.state.pushHistory();
        n.boundary = { ...n.boundary, enabled: false };
        app._nmBoundarySelection = null;
        app.markChanged();
      }),
    );
    const relation = document.getElementById("v5-relation-panel");
    if (relation) sidebar?.append(relation);
    const imagePanel = document.getElementById("image-controls");
    // Do not nest image controls inside the style inspector: selecting an
    // image must display one distinct, closable side panel.
    if (imagePanel) {
      document.body.append(imagePanel);
      imagePanel.dataset.nmIndependentPanel="true";
      imagePanel.setAttribute("tabindex","-1");
    }
    const graphic = document.createElement("section");
    graphic.id = "nm-graphic-controls";
    graphic.hidden = true;
    graphic.className = "nm6-skiptranslate";
    graphic.append(
      button("nm-object-edit", "Modifica disegno", "Edit drawing", () =>
        drawing.editGraphic(app),
      ),
      button(
        "nm-object-library",
        "Libreria personale",
        "Personal library",
        () => drawing.libraryDialog(app),
      ),
    );
    (imagePanel || sidebar)?.append(graphic);
    for (const id of ["val-hr", "val-hl"]) {
      const value = document.getElementById(id);
      if (value?.parentElement) value.parentElement.hidden = true;
    }
    const observer = new MutationObserver(() => {
      for (const control of document.querySelectorAll("[data-nm-format]")) {
        control.textContent =
          (control.id === "btn-weight-bold" ? tr("G", "B") : control.id === "nm70-italic" ? tr("C", "I") : tr("S","U"));
        control.title = tr(
          control.dataset.nmFormat,
          control.dataset.nmFormatEn,
        );
        control.setAttribute("aria-label", control.title);
      }
      locale(graphic);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
  }
  function sync(app) {
    const selection = app._nmBoundarySelection;
    const node =
      selection?.owner === app.state && app.state.findNode(selection.id);
    const image = app.state.findImage(app.state.selectedImageId);
    const kind = node?.boundary?.enabled
      ? "boundary"
      : app.state.selectedRelationshipId
        ? "relationship"
        : image
          ? image.graphic
            ? "graphic"
            : "image"
          : "node";
    const sidebar = document.getElementById("inspector-sidebar");
    if (sidebar) {
      if (kind === "node" && sidebar.dataset.nmSelection !== "node")
        document
          .getElementById("inspector-fontsize-slider")
          ?.closest(".nm70-inspector-accordion")
          ?.setAttribute("open", "");
      sidebar.dataset.nmSelection = kind;
    }
    const panel = document.getElementById("nm-boundary-controls");
    if (panel) panel.hidden = kind !== "boundary";
    const graphic = document.getElementById("nm-graphic-controls");
    if (graphic) graphic.hidden = kind !== "graphic";
    const relation = document.getElementById("v5-relation-panel");
    if (relation && kind !== "relationship") relation.classList.add("hidden");
    const color = document.getElementById("nm-boundary-color");
    if (color && node && document.activeElement !== color)
      color.value = node.boundary.color || node.color || "#a855f7";
    const imageTitle = document.querySelector(
      "#image-controls .image-controls-header strong",
    );
    if (imageTitle)
      imageTitle.textContent =
        kind === "graphic"
          ? tr("Dimensioni e posizione", "Size and position")
          : tr("✦ Immagine", "✦ Image");
    const selected = nodes(app);
    document.getElementById("nm-text-underline")?.setAttribute("aria-pressed",String(selected.length>0&&selected.every(n=>n.fontUnderline)));
    document
      .getElementById("btn-weight-bold")
      ?.setAttribute(
        "aria-pressed",
        String(
          selected.length > 0 &&
            selected.every((n) => (n.fontWeight ?? 400) >= 650),
        ),
      );
    document
      .getElementById("nm70-italic")
      ?.setAttribute(
        "aria-pressed",
        String(selected.length > 0 && selected.every((n) => n.fontItalic)),
      );
  }
  root.NeuroMapCreativeModules.inspector = {
    install,
    mount,
    sync,
    selectBoundary,
  };
})(globalThis);
