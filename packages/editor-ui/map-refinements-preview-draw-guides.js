    function preview(app, preset, scope = "map", button) {
      cancelPreview(app);
      const c = state(app),
        owner = app.state;
      c.timer = setTimeout(() => {
        c.timer = null;
        if (owner !== app.state || document.hidden) return;
        let count = 0;
        const pending = [owner.root];
        while (pending.length && count <= 1500) {
          const n = pending.pop();
          count++;
          pending.push(...(n.children || []));
        }
        if (
          count > 1500 ||
          (owner.images?.length || 0) + (owner.relationships?.length || 0) >
            3000
        ) {
          button?.setAttribute(
            "title",
            tr(
              "Mappa estesa: guarda la scheda e clicca per applicare.",
              "Large map: use the card preview and click to apply.",
            ),
          );
          return;
        }
        button?.removeAttribute("title");
        const view = Object.create(owner);
        view.root = owner.constructor.cloneTree(owner.root);
        // Painters attach runtime hit curves to relationships. Keep those
        // writes, and any media metadata caches, inside the temporary view.
        view.relationships = (owner.relationships || []).map((item) => ({
          ...item,
        }));
        view.images = (owner.images || []).map((item) => ({ ...item }));
        view.pushHistory = () => {};
        if (
          !root.NeuroMapMapStyleCore.apply(
            view,
            preset,
            scope,
            root.NeuroMapEditorPalettes,
          )
        )
          return;
        const layout = new Layout();
        for (const [k, v] of Object.entries(app.layout))
          if (["string", "number", "boolean"].includes(typeof v)) layout[k] = v;
        Object.assign(layout, {
          branchStyle: view.branchStyle,
          strokeScale: view.strokeScale,
          typographyPreset: view.typographyPreset,
          typographyScale: view.typographyScale,
          defaultLabelWrapChars: view.defaultLabelWrapChars,
          balanceBias: view.balanceBias,
          compactness: view.compactness,
          branchGapX: view.branchGapX,
          _nmImages: view.images || [],
        });
        layout.computeLayout(view.root, view.thresholdY);
        c.preview = { owner, view, layout };
        if (button) button.dataset.nmPreview = "true";
        app.requestRender();
      }, 120);
    }
    function anchors(app, exclude) {
      const c = state(app);
      if (c.anchors) return c.anchors;
      const list = [],
        excluded = new Set();
      const n = app.state.findNode(exclude);
      if (n) {
        const s = [n];
        while (s.length) {
          const v = s.pop();
          excluded.add(v.id);
          s.push(...(v.children || []));
        }
      }
      const visible = (m) => {
        const p = app.renderer.worldToScreen(m.x, m.y);
        return (
          p.x >= -80 &&
          p.x <= innerWidth + 80 &&
          p.y >= -80 &&
          p.y <= innerHeight + 80
        );
      };
      for (const [id, m] of app.layout.nodeLayoutMap || []) {
        const logical = app.layout.viewNodes?.get(id)?.logicalId || id;
        if (excluded.has(logical) || !visible(m)) continue;
        list.push({ x: m.x, y: m.y, w: m.width, h: m.height });
        if (list.length >= 1500) break;
      }
      for (const img of app.state.images || []) {
        if (img.id === exclude) continue;
        const r = app.renderer.resolveImageWorldRect(img);
        if (r && visible({ x: r.cx, y: r.cy }))
          list.push({ x: r.cx, y: r.cy, w: r.w, h: r.h });
        if (list.length >= 1500) break;
      }
      return (c.anchors = list);
    }
    function showGuides(app, moving, exclude) {
      const c = state(app);
      if (!prefs.guides) return;
      const next = alignment(
        moving,
        anchors(app, exclude),
        6 / Math.max(0.05, app.renderer.camera.zoom),
      );
      if (JSON.stringify(next) !== JSON.stringify(c.guides)) {
        c.guides = next;
        app.requestRender();
      }
    }
    const bind = App.prototype.bindUI;
