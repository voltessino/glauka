/* Box and lasso selection. Presentation only: no history and no saved fields. */
(function (root) {
  "use strict";

  const MIN_PX = 5;
  const SAMPLE_PX = 4;
  const MAX_POINTS = 1024;

  function geometry() {
    return root.NeuroMapCanvasGeometry;
  }

  function visibleItems(app) {
    const node = app && app.state && app.state.root;
    const layout = app && app.layout;
    if (!node || !layout || typeof layout.getLayout !== "function") return [];
    const items = [];
    const seen = new Set();
    const stack = [node];
    const walked = new Set();
    while (stack.length) {
      const current = stack.pop();
      if (!current || walked.has(current)) continue;
      walked.add(current);
      const id = current.logicalId || current.id;
      const box = id ? layout.getLayout(id) : null;
      if (box && Number.isFinite(box.x) && Number.isFinite(box.y) && !seen.has(id)) {
        const w = Math.max(1, Number(box.width) || 1);
        const h = Math.max(1, Number(box.height) || 1);
        seen.add(id);
        items.push({
          id,
          rect: { x: box.x - w / 2, y: box.y - h / 2, w, h },
          order: items.length,
        });
      }
      if (!current.collapsed && Array.isArray(current.children)) {
        for (let i = current.children.length - 1; i >= 0; i--) stack.push(current.children[i]);
      }
    }
    return items;
  }

  function buildIndex(items) {
    const cell = 512;
    const cells = new Map();
    for (const item of items) {
      const box = item.rect;
      const x0 = Math.floor(box.x / cell), x1 = Math.floor((box.x + box.w) / cell);
      const y0 = Math.floor(box.y / cell), y1 = Math.floor((box.y + box.h) / cell);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > 64) {
        item.large = true;
        continue;
      }
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const key = x + "," + y;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(item);
      }
    }
    return { items, cells, cell };
  }

  function queryIndex(index, bounds) {
    if (!index) return [];
    if (!bounds) return index.items;
    const spanX = Math.floor(bounds.x / index.cell);
    const spanY = Math.floor(bounds.y / index.cell);
    const endX = Math.floor((bounds.x + bounds.w) / index.cell);
    const endY = Math.floor((bounds.y + bounds.h) / index.cell);
    if ((endX - spanX + 1) * (endY - spanY + 1) > 4000) return index.items;
    const found = new Set(index.items.filter((item) => item.large));
    for (let x = spanX; x <= endX; x++) for (let y = spanY; y <= endY; y++) {
      for (const item of index.cells.get(x + "," + y) || []) found.add(item);
    }
    return [...found];
  }

  function boundsOf(points, rect) {
    if (rect) return rect;
    if (!points || !points.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const point of points) {
      minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function applyIds(app, ids, modifiers) {
    const current = Array.isArray(app.state.selectedNodeIds) ? app.state.selectedNodeIds : [];
    let next;
    if (modifiers && modifiers.toggle) {
      const set = new Set(current);
      for (const id of ids) set.has(id) ? set.delete(id) : set.add(id);
      next = [...set];
    } else if (modifiers && modifiers.add) {
      next = [...new Set(current.concat(ids))];
    } else next = [...new Set(ids)];
    app.state.selectedNodeIds = next;
    app.state.selectedNodeId = next.length ? next[next.length - 1] : app.state.root && app.state.root.id;
    app.state.selectedImageId = null;
    app.state.selectedRelationshipId = null;
    if (typeof app.updateStatus === "function") app.updateStatus();
    if (typeof app.requestRender === "function") app.requestRender();
    return next.slice();
  }

  function createAreaSelectionController(app) {
    const state = {
      mode: "off",
      active: false,
      armed: false,
      points: [],
      anchor: null,
      pointerId: null,
      camera: null,
      index: null,
      items: [],
      preview: [],
      modifiers: null,
      moves: 0,
    };

    function world(pointer) {
      if (!pointer || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return null;
      const projected = app.renderer && app.renderer.screenToWorld
        ? app.renderer.screenToWorld(pointer.x, pointer.y) : { x: pointer.x, y: pointer.y };
      if (!projected || !Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return null;
      return { x: projected.x, y: projected.y };
    }

    function zoom() {
      const value = app.renderer && app.renderer.camera && app.renderer.camera.zoom;
      return Number.isFinite(value) && value > 0 ? value : 1;
    }

    function cameraKey() {
      const camera = app.renderer && app.renderer.camera || {};
      return [camera.x, camera.y, camera.zoom].join(",");
    }

    function shape() {
      if (state.mode === "box" && state.anchor && state.points.length) {
        return { kind: "box", rect: geometry().normalizeRect(state.anchor, state.points[state.points.length - 1]) };
      }
      if (state.mode === "lasso" && state.points.length >= 3) return { kind: "lasso", points: state.points };
      return null;
    }

    function preview() {
      const current = shape();
      if (!current) { state.preview = []; return; }
      const coarse = queryIndex(state.index, boundsOf(current.points, current.rect));
      const exact = state.items.length > 800 && state.moves % 2 === 1 && state.active
        ? state.preview
        : geometry().selectCandidates(current, coarse);
      state.preview = exact;
    }

    function setMode(mode) {
      state.mode = mode === "box" || mode === "lasso" ? mode : "off";
      if (state.mode === "off") cancel("mode");
      if (typeof app.requestRender === "function") app.requestRender();
      return state.mode;
    }

    function begin(pointer, modifiers) {
      if (state.mode === "off") return false;
      const point = world(pointer);
      if (!point) return false;
      root.NeuroMapCameraDynamics && app._nmCameraDynamics && app._nmCameraDynamics.cancel("selection");
      state.active = true;
      state.armed = false;
      state.points = [point];
      state.anchor = point;
      state.pointerId = pointer && pointer.pointerId;
      state.camera = cameraKey();
      state.items = visibleItems(app);
      state.index = buildIndex(state.items);
      state.preview = [];
      state.modifiers = modifiers || {};
      state.moves = 0;
      return true;
    }

    function update(pointer) {
      if (!state.active) return false;
      if (cameraKey() !== state.camera) return cancel("camera");
      const point = world(pointer);
      if (!point) return false;
      const last = state.points[state.points.length - 1];
      const min = SAMPLE_PX / zoom();
      if (Math.hypot(point.x - state.anchor.x, point.y - state.anchor.y) * zoom() >= MIN_PX) state.armed = true;
      if (Math.hypot(point.x - last.x, point.y - last.y) < min) {
        if (state.mode === "box") state.points = [point];
        preview();
        if (typeof app.requestRender === "function") app.requestRender();
        return true;
      }
      if (state.mode === "box") state.points = [point];
      else {
        state.points.push(point);
        if (state.points.length > MAX_POINTS) {
          state.points = geometry().simplifyPolyline(state.points, 2 / zoom());
        }
      }
      state.moves++;
      preview();
      if (typeof app.requestRender === "function") app.requestRender();
      return true;
    }

    function finish() {
      if (!state.active) return (app.state.selectedNodeIds || []).slice();
      if (cameraKey() !== state.camera) return cancel("camera");
      const current = state.armed ? shape() : null;
      let ids = [];
      if (current) {
        if (state.points.length > 64 && state.mode === "lasso") {
          state.points = geometry().simplifyPolyline(state.points, 2 / zoom());
          current.points = state.points;
        }
        ids = geometry().selectCandidates(current, queryIndex(state.index, boundsOf(current.points, current.rect)));
        applyIds(app, ids, state.modifiers);
      }
      const committed = ids.slice();
      state.active = false;
      state.armed = false;
      state.points = [];
      state.anchor = null;
      state.preview = [];
      if (typeof app.requestRender === "function") app.requestRender();
      return committed;
    }

    function cancel(reason) {
      state.active = false;
      state.armed = false;
      state.points = [];
      state.anchor = null;
      state.preview = [];
      state.reason = reason || "cancel";
      if (typeof app.requestRender === "function") app.requestRender();
      return [];
    }

    function snapshot() {
      return {
        mode: state.mode,
        active: state.active,
        armed: state.armed,
        anchor: state.anchor ? { x: state.anchor.x, y: state.anchor.y } : null,
        points: state.points.map((point) => ({ x: point.x, y: point.y })),
        previewIds: state.preview.slice(),
      };
    }

    return { setMode, begin, update, finish, cancel, snapshot, dispose: () => cancel("dispose") };
  }

  function paint(renderer) {
    const app = renderer && renderer.app;
    const controller = app && app._nmAreaSelection;
    const ctx = renderer && renderer.ctx;
    const geo = geometry();
    if (!ctx || !geo || renderer._nmNavExport) return;
    const zoom = renderer.camera && renderer.camera.zoom || 1;
    const snap = controller && controller.snapshot();
    if (snap && snap.active && snap.armed) {
      const colors = root.NeuroMapCanvasPremium && root.NeuroMapCanvasPremium.colors
        ? root.NeuroMapCanvasPremium.colors() : { focus: "#6441df", focusHalo: "rgba(100,65,223,.28)" };
      ctx.save();
      ctx.fillStyle = colors.focusHalo || "rgba(100,65,223,.18)";
      ctx.strokeStyle = colors.focus || "#6441df";
      ctx.lineWidth = 1.75 / zoom;
      ctx.lineJoin = "round";
      if (snap.mode === "box" && snap.anchor && snap.points.length) {
        const rect = geo.normalizeRect(snap.anchor, snap.points[snap.points.length - 1]);
        if (rect) {
          ctx.beginPath();
          ctx.rect(rect.x, rect.y, rect.w, rect.h);
          ctx.fill();
          ctx.stroke();
        }
      } else if (snap.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(snap.points[0].x, snap.points[0].y);
        for (const point of snap.points) ctx.lineTo(point.x, point.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
    paintHull(renderer, geo, zoom);
  }

  function paintHull(renderer, geo, zoom) {
    const ids = renderer.state && renderer.state.selectedNodeIds;
    if (!Array.isArray(ids) || ids.length < 2 || !renderer.layout) return;
    const points = [];
    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const box = renderer.layout.getLayout(id);
      if (!box || !Number.isFinite(box.x) || !Number.isFinite(box.y)) continue;
      const w = Math.max(1, Number(box.width) || 1);
      const h = Math.max(1, Number(box.height) || 1);
      points.push(
        { x: box.x - w / 2, y: box.y - h / 2 },
        { x: box.x + w / 2, y: box.y - h / 2 },
        { x: box.x + w / 2, y: box.y + h / 2 },
        { x: box.x - w / 2, y: box.y + h / 2 }
      );
    }
    const hull = geo.expandHull(geo.convexHull(points), 14 / zoom);
    if (hull.length < 3) return;
    const ctx = renderer.ctx;
    const colors = root.NeuroMapCanvasPremium && root.NeuroMapCanvasPremium.colors
      ? root.NeuroMapCanvasPremium.colors() : { focus: "#6441df" };
    ctx.save();
    ctx.strokeStyle = colors.focus || "#6441df";
    ctx.lineWidth = 1.75 / zoom;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hull[0].x, hull[0].y);
    for (const point of hull) ctx.lineTo(point.x, point.y);
    ctx.closePath();
    ctx.stroke();
    const label = (root.document && root.document.documentElement && root.document.documentElement.lang === "en"
      ? seen.size + " selected nodes" : seen.size + " nodi selezionati");
    ctx.font = (12 / zoom) + "px sans-serif";
    ctx.fillStyle = colors.focus || "#6441df";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    let x = hull[0].x, y = hull[0].y;
    for (const point of hull) if (point.y < y || (point.y === y && point.x > x)) { x = point.x; y = point.y; }
    const camera = renderer.camera || { x: 0, y: 0, zoom: 1 };
    const viewW = renderer.canvas && renderer.canvas.clientWidth || 800;
    const viewH = renderer.canvas && renderer.canvas.clientHeight || 600;
    const minX = (8 - camera.x) / camera.zoom;
    const minY = (28 - camera.y) / camera.zoom;
    const maxX = (viewW - 8 - camera.x) / camera.zoom;
    const maxY = (viewH - 8 - camera.y) / camera.zoom;
    ctx.fillText(label, Math.min(maxX, Math.max(minX, x)), Math.min(maxY, Math.max(minY, y)));
    ctx.restore();
    renderer._nmSelectionHull = hull;
  }

  function typing(target) {
    if (!target) return false;
    const name = target.tagName;
    return name === "INPUT" || name === "TEXTAREA" || target.isContentEditable;
  }

  function install(App) {
    if (!App || !App.prototype || App.prototype._nmAreaInstalled) return;
    App.prototype._nmAreaInstalled = true;
    const bind = App.prototype.bindUI;
    if (typeof bind !== "function") return;
    App.prototype.bindUI = function (...args) {
      const result = bind.apply(this, args);
      const controller = createAreaSelectionController(this);
      this._nmAreaSelection = controller;
      if (this.renderer) this.renderer.app = this;
      const canvas = this.canvas;
      if (!canvas || canvas._nmAreaBound) return result;
      canvas._nmAreaBound = true;
      const pointers = new Set();
      const syncButtons = () => {
        const box = root.document && root.document.getElementById("nm-area-box");
        const lasso = root.document && root.document.getElementById("nm-area-lasso");
        const mode = controller.snapshot().mode;
        if (box) box.setAttribute("aria-pressed", mode === "box" ? "true" : "false");
        if (lasso) lasso.setAttribute("aria-pressed", mode === "lasso" ? "true" : "false");
      };
      const menu = root.document && root.document.getElementById("dropdown-view");
      if (menu && !root.document.getElementById("nm-area-box")) {
        const make = (id, label) => {
          const button = root.document.createElement("button");
          button.type = "button";
          button.id = id;
          button.className = "dropdown-item";
          button.textContent = label;
          button.setAttribute("aria-pressed", "false");
          menu.append(button);
          return button;
        };
        const label = (it, en) =>
          root.GlaukaI18n?.pair(it, en) ??
          (root.document.documentElement.lang === "en" ? en : it);
        make("nm-area-box", label("Selezione rettangolare", "Rectangle selection"))
          .addEventListener("click", () => {
            controller.setMode(controller.snapshot().mode === "box" ? "off" : "box");
            syncButtons();
          });
        make("nm-area-lasso", label("Selezione libera", "Free selection"))
          .addEventListener("click", () => {
            controller.setMode(controller.snapshot().mode === "lasso" ? "off" : "lasso");
            syncButtons();
          });
      }
      canvas.addEventListener("pointerdown", (event) => {
        pointers.add(event.pointerId);
        if (pointers.size > 1) { controller.cancel("pinch"); return; }
        if (controller.snapshot().mode === "off" || event.button !== 0) return;
        if (this.relationshipSourceId || (this.editorNodeId && root.document.getElementById("inline-editor") && !root.document.getElementById("inline-editor").classList.contains("hidden"))) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        canvas.setPointerCapture && canvas.setPointerCapture(event.pointerId);
        controller.begin({ x: event.clientX, y: event.clientY, pointerId: event.pointerId }, {
          add: event.shiftKey, toggle: event.ctrlKey || event.metaKey,
        });
      }, true);
      canvas.addEventListener("pointermove", (event) => {
        if (!controller.snapshot().active) return;
        if (pointers.size > 1) { controller.cancel("pinch"); return; }
        controller.update({ x: event.clientX, y: event.clientY, pointerId: event.pointerId });
      }, true);
      const end = (event) => {
        pointers.delete(event.pointerId);
        if (!controller.snapshot().active) return;
        controller.finish();
      };
      canvas.addEventListener("pointerup", end, true);
      canvas.addEventListener("pointercancel", (event) => { pointers.delete(event.pointerId); controller.cancel("pointercancel"); }, true);
      root.document && root.document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") { controller.cancel("escape"); return; }
        if (event.key !== "l" && event.key !== "L") return;
        if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
        if (root.document.activeElement !== canvas) return;
        event.preventDefault();
        controller.setMode(controller.snapshot().mode === "lasso" ? "off" : "lasso");
        syncButtons();
      });
      return result;
    };
    const activate = App.prototype.activateTab;
    if (typeof activate === "function") {
      App.prototype.activateTab = function (...args) {
        this._nmAreaSelection && this._nmAreaSelection.cancel("tab");
        return activate.apply(this, args);
      };
    }
  }

  root.NeuroMapAreaSelection = { install, createAreaSelectionController, paint, visibleItems };
})(typeof globalThis === "object" ? globalThis : this);
