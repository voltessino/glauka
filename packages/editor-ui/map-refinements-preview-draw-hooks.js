    App.prototype.bindUI = function (...args) {
      const result = bind.apply(this, args),
        app = this;
      state(app);
      mount(app);
      document.addEventListener(
        "pointerdown",
        (e) => {
          if (!e.target.closest?.(".nm-map-card")) cancelPreview(app);
          if (e.target === app.canvas) {
            app.stopTeleport?.();
            clearGuides(app);
          }
        },
        true,
      );
      document.addEventListener(
        "pointermove",
        (e) => {
          const d = app._nmDraw;
          if (
            d?.active &&
            d.path?.length &&
            !["pen", "highlight"].includes(d.tool)
          ) {
            const p = app.renderer.screenToWorld(e.clientX, e.clientY),
              a = d.path[0];
            showGuides(
              app,
              {
                x: (a.x + p.x) / 2,
                y: (a.y + p.y) / 2,
                w: Math.abs(p.x - a.x),
                h: Math.abs(p.y - a.y),
              },
              null,
            );
          }
        },
        true,
      );
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
        document.addEventListener(event, () => clearGuides(app), true);
      document.addEventListener(
        "keydown",
        (e) => {
          if (e.key === "Escape") {
            cancelPreview(app);
            app.stopTeleport?.();
            clearGuides(app);
          }
        },
        true,
      );
      root.addEventListener("blur", () => {
        cancelPreview(app);
        app.stopTeleport?.();
        clearGuides(app);
        stopArrival(app);
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          cancelPreview(app);
          app.stopTeleport?.();
          clearGuides(app);
          stopArrival(app);
        }
      });
      return result;
    };
    for (const name of [
      "activateTab",
      "undo",
      "redo",
      "importHierarchy",
      "markChanged",
    ]) {
      const original = App.prototype[name];
      if (original)
        App.prototype[name] = function (...args) {
          cancelPreview(this);
          if (name !== "markChanged") {
            releasePath(this);
            this.stopTeleport?.();
            clearGuides(this);
            stopArrival(this);
          }
          return original.apply(this, args);
        };
    }
    const visual = App.prototype.v5DragVisual;
    if (visual)
      App.prototype.v5DragVisual = function (d, x, y) {
        const result = visual.apply(this, arguments),
          m = this.layout.getLayout(d.nodeId);
        if (m) {
          const z = this.renderer.camera.zoom;
          showGuides(
            this,
            {
              x: m.x + (x - d.startX) / z,
              y: m.y + (y - d.startY) / z,
              w: m.width,
              h: m.height,
            },
            d.nodeId,
          );
        }
        return result;
      };
    const imageDrag = App.prototype.updateImageDrag;
    if (imageDrag)
      App.prototype.updateImageDrag = function (...args) {
        const result = imageDrag.apply(this, args),
          d = this.drag,
          img = d && this.state.findImage(d.original.id),
          r = img && this.renderer.resolveImageWorldRect(img);
        if (r && d.moved)
          showGuides(this, { x: r.cx, y: r.cy, w: r.w, h: r.h }, img.id);
        return result;
      };
    const stop = App.prototype.stopTeleport;
    App.prototype.stopTeleport = function () {
      this._teleportNonce = (this._teleportNonce || 0) + 1;
      return stop?.call(this);
    };
    App.prototype.teleportToNode = function (id, tabId = this.activeTabId) {
      this.stopTeleport();
      cancelPreview(this);
      stopArrival(this);
      this.renderer.pulse = null;
      if (tabId !== this.activeTabId) this.activateTab(tabId);
      const node = this.state.findNode(id);
      if (!node) return false;
      let n = node,
        changed = false;
      while (n.parentId) {
        n = this.state.findNode(n.parentId);
        if (!n) break;
        if (n.collapsed) {
          if (!changed) this.state.pushHistory();
          n.collapsed = false;
          changed = true;
        }
      }
      this.recalculateAndRender(changed);
      this.selectNode(id);
      const m = this.layout.getLayout(id);
      if (!m) return false;
      const viewport = root.NeuroMapGraphics.viewport();
      const layoutPanel = document.querySelector(".hud-bottom-left");
      if (
        layoutPanel &&
        !layoutPanel.hidden &&
        !layoutPanel.classList.contains("hidden")
      ) {
        const box = layoutPanel.getBoundingClientRect();
        if (
          box.width > 100 &&
          box.left < 180 &&
          box.right < viewport.right - 200
        )
          viewport.left = Math.max(viewport.left, box.right + 16);
      }
      const width = Math.max(200, viewport.right - viewport.left),
        height = Math.max(180, viewport.bottom - viewport.top);
      const zoom = Math.max(
          0.18,
          Math.min(
            1.15,
            (width * 0.72) / Math.max(1, m.width),
            (height * 0.58) / Math.max(1, m.height),
          ),
        ),
        camera = this.renderer.camera,
        start = { ...camera },
        target = {
          zoom,
          x: (viewport.left + viewport.right) / 2 - m.x * zoom,
          y: (viewport.top + viewport.bottom) / 2 - m.y * zoom,
        };
      const c = state(this),
        finish = () => {
          Object.assign(camera, target);
          this._teleportFrame = null;
          this.updateStatus();
          if (prefs.travel) {
            c.arrival = { id, owner: this.state };
            c.arrivalTimer = setTimeout(() => stopArrival(this), 650);
          }
          this.requestRender();
        };
      if (
        !prefs.travel ||
        media?.matches ||
        root.NeuroMapMotion?.get().interface === false
      ) {
        finish();
        return true;
      }
      const begin = performance.now(),
        nonce = this._teleportNonce;
      const tick = (now) => {
        if (nonce !== this._teleportNonce) return;
        const p = Math.min(1, (now - begin) / 260),
          ease = 1 - (1 - p) ** 3;
        for (const k of ["x", "y", "zoom"])
          camera[k] = start[k] + (target[k] - start[k]) * ease;
        this.requestRender();
        if (p < 1) this._teleportFrame = requestAnimationFrame(tick);
        else finish();
      };
      this._teleportFrame = requestAnimationFrame(tick);
      return true;
    };
    media?.addEventListener?.("change", () => {
      const app = root.neuroMapApp;
      if (app) app.stopTeleport?.();
    });
    const grid = Renderer.prototype.drawAmbientGrid;
    Renderer.prototype.drawAmbientGrid = function () {
      if (prefs.pattern === "none" || prefs.intensity <= 0) return;
      const ctx = this.ctx,
        step = 42 * this.camera.zoom;
      if (step < 14) return;
      ctx.save();
      ctx.globalAlpha = prefs.intensity / 100;
      ctx.fillStyle = ctx.strokeStyle = root.NeuroMapGraphics.light()
        ? "#334155"
        : "#c3d0e4";
      ctx.lineWidth = 1;
      const x0 = this.camera.x % step,
        y0 = this.camera.y % step;
      if (prefs.pattern === "dots") {
        for (let x = x0; x < innerWidth; x += step)
          for (let y = y0; y < innerHeight; y += step) {
            ctx.beginPath();
            ctx.arc(x, y, 1.1, 0, Math.PI * 2);
            ctx.fill();
          }
      } else {
        ctx.beginPath();
        for (let x = x0; x < innerWidth; x += step) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, innerHeight);
        }
        for (let y = y0; y < innerHeight; y += step) {
          ctx.moveTo(0, y);
          ctx.lineTo(innerWidth, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    };
    const render = Renderer.prototype.render;
    Renderer.prototype.render = function (ctx, ...args) {
      const app = root.neuroMapApp;
      if (ctx || !app || app.renderer !== this)
        return render.call(this, ctx, ...args);
      const c = state(app),
        original = {
          state: this.state,
          layout: this.layout,
          fast: this.highPerformanceCanvas,
          autoFast: this._nmAutoFastCanvas,
          noDecode: this._nmPreviewNoDecode,
        };
      const previewActive = c.preview?.owner === app.state;
      if (previewActive) {
        this.state = c.preview.view;
        this.layout = c.preview.layout;
        this.highPerformanceCanvas = false;
        this._nmAutoFastCanvas = false;
        this._nmPreviewNoDecode = true;
      }
      try {
        const result = render.call(this, ctx, ...args);
        drawOverlays(app, this, c);
        return result;
      } finally {
        if (previewActive) {
          this.state = original.state;
          this.layout = original.layout;
          this.highPerformanceCanvas = original.fast;
          this._nmAutoFastCanvas = original.autoFast;
          this._nmPreviewNoDecode = original.noDecode;
        }
      }
    };
