/* Compose creative components and connect the editor lifecycle. */
(function (root) {
  "use strict";
  const {
    core,
    tr,
    BUTTONS,
    button,
    locale,
    openURL,
    nodeURL,
    dialog,
    addGraphic,
    appliedBadge,
  } = root.NeuroMapCreativeModules.ui;
  const { formulaSVG, formulaDialog, symbolsDialog } =
    root.NeuroMapCreativeModules.formulas;
  const { boundaryDialog, boundaryHit } =
    root.NeuroMapCreativeModules.boundaries;
  const {
    editGraphic,
    stopDrawing,
    drawingToolbar,
    group,
    ungroup,
    libraryDialog,
  } = root.NeuroMapCreativeModules.drawing;
  const inspector = root.NeuroMapCreativeModules.inspector;

  // Dialogs that expose a node destination stay open while the user selects
  // another branch on the canvas.  Observe the editor's canonical selection
  // entry point for the lifetime of the dialog, then restore it exactly when
  // the dialog closes.  This keeps every picker in sync without adding a
  // polling timer or coupling it to renderer events.
  function watchSelection(app, onChange) {
    const original = app?.selectNode;
    if (typeof original !== 'function') return () => {};
    const wrapped = function (...args) {
      const result = original.apply(this, args);
      onChange?.();
      return result;
    };
    app.selectNode = wrapped;
    return () => {
      if (app.selectNode === wrapped) app.selectNode = original;
    };
  }
  function install(App, State, Layout, Renderer) {
    inspector.install(App);
    // The miniature previously refreshed only when the selected mode or
    // node changed. A drag, undo or spacing adjustment could leave it stale.
    // Coalesce updates after the actual geometry has been recalculated.
    const recalculate = App.prototype.recalculateAndRender;
    if (typeof recalculate === "function") {
      App.prototype.recalculateAndRender = function (...args) {
        const result = recalculate.apply(this, args);
        if (!this._nmLayoutPreviewQueued &&
            typeof root.requestAnimationFrame === "function" &&
            document.getElementById?.("nm-layout-mini-preview")) {
          this._nmLayoutPreviewQueued = true;
          root.requestAnimationFrame(() => {
            this._nmLayoutPreviewQueued = false;
            updateMiniPreview(this);
          });
        }
        return result;
      };
    }
    root.NeuroMapCreativeModules.formatting.install(App, State);
    root.NeuroMapCreativeModules.markers.install(App);
    // Route existing marker, emoji and toolbar shortcuts through one modal.
    // Keep the old picker implementation reachable as a compatibility fallback.
    const openLegacyPicker=App.prototype.nm62OpenAssets;
    App.prototype.nm62OpenAssets=function(tab='markers'){
      if(root.NeuroMapMarkers?.entries && root.GlaukaLegacyGallery?.gallery)
        return creativeLibraryDialog(this,tab==='gallery'?'icons':'symbols');
      return openLegacyPicker.call(this,tab);
    };
    const clone = State.cloneImages;
    State.cloneImages = function (list = []) {
      const out = clone.call(this, list);
      out.forEach((im, i) => {
        const value = core.graphic(list[i]?.graphic);
        if (value) im.graphic = value;
      });
      return out;
    };
    const add = State.prototype.addImageItem;
    State.prototype.addImageItem = function (payload, ...args) {
      const im = add.call(this, payload, ...args);
      const meta = core.graphic(payload?.graphic);
      if (im && meta) im.graphic = meta;
      return im;
    };
    const activateLibraryTab=App.prototype.activateTab;
    App.prototype.activateTab=function(id,...args){
      if(id!==this.activeTabId&&this.tabs.some(tab=>tab.id===id))
        document.getElementById('nm-creative-library-hub')?.remove();
      return activateLibraryTab.call(this,id,...args);
    };
    // Root fields live in the logical tree so every existing snapshot/undo/save path retains them.
    const importTree = App.prototype.importHierarchy;
    App.prototype.importHierarchy = function (source, ...args) {
      const result = importTree.call(this, source, ...args);
      if (result && source) {
        // An import without layout metadata must not inherit the new-map default.
        this.state.root.layoutMode = source.layoutMode;
        this.state.root.layoutBalanceMode = source.layoutBalanceMode === 'geometry' ? 'geometry' : undefined;
        this.state.root.layoutDistribution = source.layoutDistribution
          ? root.NeuroMapCore.continuationSettings(source.layoutDistribution)
          : undefined;
        const config = source.layoutDistribution;
        if (config?.anchorSides) {
          const remap = {};
          const walk = (old, n) => {
            if (config.anchorSides[old.id])
              remap[n.id] = config.anchorSides[old.id];
            (old.children || []).forEach((c, i) => {
              if (n.children?.[i]) walk(c, n.children[i]);
            });
          };
          walk(source, this.state.root);
          this.state.root.layoutDistribution = {
            ...root.NeuroMapCore.continuationSettings(config),
            anchorSides: remap,
          };
        }
        this.recalculateAndRender();
      }
      return result;
    };
    const offsets = Layout.prototype.applyManualOffsets;
    Layout.prototype.applyManualOffsets = function (tree) {
      offsets?.call(this, tree);
      if (this.branchStyle !== "radial")
        root.NeuroMapGraphics.separateSubtrees(this, tree);
    };
    const split = Layout.prototype.computeDynamicClockwiseSplit;
    Layout.prototype.computeDynamicClockwiseSplit = function (
      tree,
      bias,
      ...args
    ) {
      const mode = tree.layoutMode;
      this._nmBias = bias;
      if (mode === "fluid") {
        const nodes=(tree.children||[]).filter(n=>!n.isSummary&&!n.isFloating);
        const result=root.NeuroMapCore.splitFluid(nodes,
          nodes.map(n=>this.computeSubtreeHeight(n,1)),this.primaryGroupGap);
        const rights=new Set(result.rightIds);
        for(const node of nodes)this.propagateSubtreeSide(node,rights.has(node.id)?"right":"left");
        this.lastSplitIndex=result.splitIndex;
        return result;
      }
      if (mode === "right" || mode === "left") {
        const nodes = (tree.children || []).filter(
          (n) => !n.isSummary && !n.isFloating,
        );
        const metrics = root.NeuroMapCore.splitClockwise(
          nodes.map((n) => ({ ...n, sidePinned: n.sidePinned || mode })),
          nodes.map((n) => this.computeSubtreeHeight(n, 1)),
          this.primaryGroupGap,
          mode === "right" ? 100 : 0,
        );
        const rightIds=new Set(metrics.rightIds);
        for (const node of nodes) this.propagateSubtreeSide(node,
          rightIds.has(node.id)?"right":"left");
        this.lastSplitIndex = metrics.splitIndex;
        return metrics;
      }
      return split.call(
        this,
        tree,
        mode === "right" ? 100 : mode === "left" ? 0 : bias,
        ...args,
      );
    };
    const side = Layout.prototype.layoutSideBranches;
    Layout.prototype.layoutSideBranches = function (
      tree,
      branches,
      direction,
      height,
    ) {
      return side.call(
        this,
        tree,
        tree.layoutMode === "columns" && direction === "left"
          ? [...branches].reverse()
          : branches,
        direction,
        height,
      );
    };
    const imagesLayer = Renderer.prototype.drawImagesLayer;
    Renderer.prototype.drawImagesLayer = function (layer = "front", ...args) {
      const all = this.state.images || [];
      let result;
      try {
        this.state.images = all.filter((im) => !im.graphic);
        result = imagesLayer.call(this, layer, ...args);
      } finally {
        this.state.images = all;
      }
      for (const im of all) {
        if (!im.graphic || (im.zLayer === "back" ? "back" : "front") !== layer)
          continue;
        const rect = this.resolveImageWorldRect(im),
          picture = this.getOrLoadImage(im.src);
        if (!rect) continue;
        const ctx = this.ctx;
        ctx.save();
        if (picture?.complete && picture.naturalWidth)
          ctx.drawImage(picture, rect.x, rect.y, rect.w, rect.h);
        if (this.state.selectedImageId === im.id) {
          ctx.strokeStyle = "#a5b4fc";
          ctx.lineWidth = 1 / this.camera.zoom;
          ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
          for (const h of rect.handles) {
            ctx.fillStyle = "#fff";
            ctx.fillRect(
              h.x - rect.handleSize / 2,
              h.y - rect.handleSize / 2,
              rect.handleSize,
              rect.handleSize,
            );
          }
        }
        ctx.restore();
      }
      return result;
    };
    const renderNode = Renderer.prototype.drawNode;
    Renderer.prototype.drawNode = function (node, ...args) {
      const result = renderNode.call(this, node, ...args);
      if (nodeURL(node)) {
        const m = this.layout.getLayout(node.id);
        if (m) {
          const c = this.ctx;
          c.save();
          c.fillStyle = root.NeuroMapGraphics?.light?.()
            ? "#1d4ed8"
            : "#7dd3fc";
          c.font = "14px system-ui";
          c.textAlign = "right";
          c.textBaseline = "top";
          c.fillText("↗", m.x + m.width / 2 - 4, m.y - m.height / 2 + 3);
          c.restore();
        }
      }
      return result;
    };
    const bind = App.prototype.bindUI;
    App.prototype.bindUI = function (...args) {
      const result = bind.apply(this, args);
      mount(this);
      return result;
    };
    const status = App.prototype.updateStatus;
    App.prototype.updateStatus = function (...args) {
      const result = status.apply(this, args);
      sync(this);
      return result;
    };
    root.NeuroMapCreative = {
      formulaDialog,
      symbolsDialog,
      objectDialog,
      libraryHub:creativeLibraryDialog,
      boundaryDialog,
      selectBoundary: (hit) => inspector.selectBoundary(root.neuroMapApp, hit),
      nodeURL,
      openURL,
      addGraphic,
      formulaSVG,
      group,
      ungroup,
      library: libraryDialog,
    };
  }

  // Preview and final renderer share the same local SVG source: no emoji or
  // internet request is substituted for the selected artwork.
/* @neuromap-creative-tools-object-dialog */
/* @neuromap-creative-tools-library-dialog */
/* @neuromap-creative-tools-mount */
/* @neuromap-creative-tools-sync */
  root.NeuroMapCreativeInstall = install;
})(globalThis);
