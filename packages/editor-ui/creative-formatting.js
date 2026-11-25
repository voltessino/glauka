/* Explicit formatting targets, independent defaults, and property-only copying. */
(function (root) {
  "use strict";
  const { tr, button, locale } = root.NeuroMapCreativeModules.ui;
  const KEY = "neuromap.format.defaults.v1",
    clone = (v) => JSON.parse(JSON.stringify(v));
  const specs = [
    [
      "branches",
      "Forma dei rami",
      "Branch shape",
      "#nm54-style-grid",
      ["branchStyle"],
    ],
    [
      "stroke",
      "Spessore dei rami",
      "Branch thickness",
      "#nm63-stroke-range",
      ["strokeScale"],
    ],
    [
      "root-gap",
      "Distacco dal nodo centrale",
      "Center node branch gap",
      "#nm-root-branch-gap",
      ["rootBranchGap"],
    ],
    [
      "gap",
      "Distanza fra nodo e sottorami",
      "Distance from node to children",
      "#nm68-branch-gap",
      ["branchGapX"],
    ],
    [
      "vertical",
      "Distanza tra i rami",
      "Distance between branches",
      "#nm67-compact-slider",
      ["compactness"],
    ],
    [
      "balance",
      "Distribuzione dei rami",
      "Branch distribution",
      "#threshold-slider",
      ["balanceBias"],
    ],
    [
      "profile",
      "Dimensioni per livello",
      "Size by level",
      "#v6-preset-wrap",
      ["typographyPreset"],
    ],
    [
      "scale",
      "Ingrandimento del testo",
      "Text scale",
      "#v5-font-scale",
      ["typographyScale"],
    ],
    [
      "wrap",
      "Testo a capo della mappa",
      "Map text wrapping",
      "#nm54-map-wrap-slider",
      ["defaultLabelWrapChars"],
    ],
    [
      "palette",
      "Palette dei colori",
      "Color palette",
      ".theme-grid",
      ["activeThemeId"],
    ],
    [
      "layout",
      "Disposizione della mappa",
      "Map layout",
      "#nm-layout-modes",
      ["layoutMode"],
    ],
    [
      "continuation",
      "Continuazione dei rami",
      "Branch continuation",
      "#nm-distribution-height",
      ["layoutDistribution"],
    ],
    [
      "font-size",
      "Dimensione dei nodi",
      "Node font size",
      "#inspector-fontsize-slider",
      ["fontSize"],
      "node",
    ],
    [
      "font-style",
      "Stile del testo",
      "Text style",
      "#btn-weight-bold",
      ["fontWeight", "fontItalic", "fontUnderline", "fontStrike", "fontFamily", "fontColor"],
      "node",
    ],
    [
      "node-shape",
      "Contorno del testo",
      "Text outline",
      "#glauka-node-shape",
      ["nodeShape"],
      "node",
    ],
    [
      "node-wrap",
      "Testo a capo dei nodi",
      "Node text wrapping",
      "#nm54-wrap-slider",
      ["labelWrapChars"],
      "node",
    ],
    [
      "indent",
      "Rientro del testo",
      "Text indent",
      "#nm68-text-indent",
      ["labelIndent"],
      "node",
    ],
    [
      "align",
      "Allineamento del testo",
      "Text alignment",
      "[data-nm68-align]",
      ["labelAlign"],
      "node",
    ],
    [
      "color",
      "Colore dei nodi",
      "Node color",
      "#inspector-color-picker",
      ["color"],
      "node",
    ],
  ].map(([id, it, en, selector, fields, kind = "map"]) => ({
    id,
    it,
    en,
    selector,
    fields,
    kind,
  }));
/* @neuromap-creative-formatting-values */
  function write(state, spec, values, history = true) {
    if (spec.id === "palette") {
      if (!values.activeThemeId) return;
      const length = state.undoStack.length,
        redo = state.redoStack,
        dirty = state.isDirty;
      state.applyGlobalTheme(values.activeThemeId);
      if (!history) {
        state.undoStack.length = length;
        state.redoStack = redo;
        state.isDirty = dirty;
      }
      return;
    }
    if (history) state.pushHistory();
    Object.assign(rootSpec(spec) ? state.root : state, clone(values));
    if (spec.id === "layout") {
      // A saved Balanced preset must activate the real geometric algorithm
      // in every *new* map, not merely write the layoutMode label.
      // Legacy imported maps remain untouched until an explicit selection.
      if (values.layoutMode === "balanced")
        state.root.layoutBalanceMode = "geometry";
      state.root.layoutDistribution = {
        ...(state.root.layoutDistribution || {}),
        enabled: values.layoutMode === "clockwise",
        // Do not freeze adaptive geometry with a snapshot of old visual sides.
        ...(state.root.layoutDistribution?.overflowMode === "expand"
          ? {anchorSides: undefined, initialOrder: false} : {
            anchorSides: Object.fromEntries((state.root.children || []).map(n => [n.id, n.side]))}),
      };
    }
    if (spec.id === "continuation" && state.root.layoutDistribution?.overflowMode !== "expand")
      state.root.layoutDistribution.anchorSides = Object.fromEntries(
        (state.root.children || []).map((n) => [n.id, n.side]),
      );
    else if (spec.id === "continuation" && state.root.layoutDistribution?.overflowMode === "expand")
      delete state.root.layoutDistribution.anchorSides;
    if (spec.id === "wrap") state.wrapCustom = true;
    if (spec.id === "balance") state.thresholdY = values.balanceBias;
  }
  function install(App, State) {
    State.prototype.nextPaletteEntry = function () {
      const palette =
        root.NeuroMapEditorPalettes[this.activeThemeId || "default"] ||
        root.NeuroMapEditorPalettes.default;
      const colorIndex = this.paletteCounter++ % palette.length;
      return { color: palette[colorIndex], colorIndex };
    };
    const init = State.prototype.initStarterTree;
    State.prototype.initStarterTree = function (...args) {
      const r = init.apply(this, args);
      defaults(this, true);
      return r;
    };
    const fresh = App.prototype.newState;
    App.prototype.newState = function (...args) {
      const s = fresh.apply(this, args);
      defaults(s, true);
      return s;
    };
    for (const name of ["addChildNode", "addSiblingNode"]) {
      const prior = State.prototype[name];
      if (!prior) continue;
      State.prototype[name] = function (...args) {
        const n = prior.apply(this, args);
        if (n && typeof n === "object")
          for (const s of specs)
            if (s.kind === "node") Object.assign(n, load()[s.id] || {});
        return n;
      };
    }
    for (const name of [
      "activateTab",
      "closeTab",
      "undo",
      "redo",
      "selectNode",
      "clearSelection",
    ]) {
      const prior = App.prototype[name];
      if (prior)
        App.prototype[name] = function (...args) {
          this.nmSettings?.finish();
          return prior.apply(this, args);
        };
    }
    const bind = App.prototype.bindUI;
    App.prototype.bindUI = function (...args) {
      const r = bind.apply(this, args);
      queueMicrotask(() => root.NeuroMapCreativeModules.settings.mount(this));
      return r;
    };
    const status = App.prototype.updateStatus;
    App.prototype.updateStatus = function (...args) {
      const r = status.apply(this, args);
      this.nmFormatRefresh?.();
      if (!this._nmSettingsQueued) {
        this._nmSettingsQueued = true;
        queueMicrotask(() => {
          this._nmSettingsQueued = false;
          this.nmFormatRefresh?.();
        });
      }
      return r;
    };
  }
  root.NeuroMapCreativeModules.formatting = {
    install,
    clean,
    specs,
    load,
    write,
    rootSpec,
    KEY,
  };
})(globalThis);
