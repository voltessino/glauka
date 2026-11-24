/* Transient camera glide. It never writes history or map data. */
(function (root) {
  "use strict";

  function createCameraDynamics(app, options) {
    const settings = options || {};
    const minZoom = Number.isFinite(settings.minZoom) ? settings.minZoom : 0.001;
    const maxZoom = Number.isFinite(settings.maxZoom) ? settings.maxZoom : 3.5;
    const schedule = settings.schedule || ((fn) => root.requestAnimationFrame(fn));
    const cancelSchedule = settings.cancelSchedule || ((id) => root.cancelAnimationFrame(id));
    const now = settings.now || (() => (root.performance ? root.performance.now() : Date.now()));
    let reduced = !!(settings.reducedMotion || (root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches));
    let handle = 0;
    let active = false;
    let mode = "idle";
    let velocity = { x: 0, y: 0 };
    let samples = [];
    let started = 0;
    let previous = 0;
    let zoomTarget = null;
    let zoomAnchor = null;
    let spring = null;

    function camera() {
      return app.renderer && app.renderer.camera;
    }

    function finiteCamera() {
      const cam = camera();
      return !!cam && [cam.x, cam.y, cam.zoom].every((value) => Number.isFinite(value)) && cam.zoom > 0;
    }

    function stopLoop() {
      if (handle) cancelSchedule(handle);
      handle = 0;
      active = false;
      mode = "idle";
      velocity = { x: 0, y: 0 };
      zoomTarget = null;
      spring = null;
    }

    function render() {
      if (typeof app.requestRender === "function") app.requestRender();
      if (typeof app.positionEditor === "function") app.positionEditor();
    }

    function clampZoom(value) {
      if (!Number.isFinite(value)) return camera().zoom;
      return Math.max(minZoom, Math.min(maxZoom, value));
    }

    function placeZoom(next, anchor) {
      const cam = camera();
      if (!finiteCamera() || !anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return;
      const zoom = clampZoom(next);
      const wx = (anchor.x - cam.x) / cam.zoom;
      const wy = (anchor.y - cam.y) / cam.zoom;
      cam.zoom = zoom;
      cam.x = anchor.x - wx * zoom;
      cam.y = anchor.y - wy * zoom;
    }

    function tick(time) {
      handle = 0;
      if (!active || !finiteCamera()) { stopLoop(); return; }
      const dt = Math.max(0, Math.min(0.05, (time - previous) / 1000));
      previous = time;
      const cam = camera();
      if (mode === "pan") {
        if (time - started > 650 || Math.hypot(velocity.x, velocity.y) < 0.02) { stopLoop(); render(); return; }
        cam.x += velocity.x * dt * 1000;
        cam.y += velocity.y * dt * 1000;
        const decay = Math.exp(-6 * dt);
        velocity.x *= decay;
        velocity.y *= decay;
      } else if (mode === "zoom" && zoomAnchor) {
        const delta = zoomTarget - cam.zoom;
        if (Math.abs(delta) < 0.0008) { placeZoom(zoomTarget, zoomAnchor); stopLoop(); render(); return; }
        const current = Math.log(Math.max(0.0001, cam.zoom));
        const goal = Math.log(Math.max(0.0001, zoomTarget));
        placeZoom(Math.exp(current + (goal - current) * (1 - Math.exp(-8 * dt))), zoomAnchor);
      } else if (mode === "spring" && spring) {
        const ax = -42 * (cam.x - spring.x) - 12 * velocity.x;
        const ay = -42 * (cam.y - spring.y) - 12 * velocity.y;
        velocity.x += ax * dt;
        velocity.y += ay * dt;
        cam.x += velocity.x * dt;
        cam.y += velocity.y * dt;
        if (Math.hypot(cam.x - spring.x, cam.y - spring.y) < 0.4 && Math.hypot(velocity.x, velocity.y) < 8) {
          cam.x = spring.x; cam.y = spring.y;
          if (Number.isFinite(spring.zoom)) placeZoom(spring.zoom, { x: cam.x, y: cam.y });
          stopLoop();
        }
      } else { stopLoop(); return; }
      if (![cam.x, cam.y, cam.zoom].every(Number.isFinite)) { stopLoop(); return; }
      render();
      if (active) handle = schedule(tick);
    }

    function start(kind, time) {
      if (reduced) { stopLoop(); return; }
      const continuing = active && mode === kind && handle;
      mode = kind;
      active = true;
      if (!continuing) { started = time; previous = time; }
      if (!handle) handle = schedule(tick);
    }

    function beginPan(point, time) {
      cancel("pan");
      samples = [{ x: point.x, y: point.y, t: time }];
    }

    function updatePan(point, time) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      samples.push({ x: point.x, y: point.y, t: time });
      const cutoff = time - 100;
      samples = samples.filter((sample) => sample.t >= cutoff);
    }

    function endPan(time) {
      const recent = samples.filter((sample) => sample.t >= time - 100);
      samples = [];
      if (reduced || recent.length < 2) { stopLoop(); return false; }
      const first = recent[0], last = recent[recent.length - 1];
      const dt = Math.max(1, last.t - first.t);
      let vx = (last.x - first.x) / dt;
      let vy = (last.y - first.y) / dt;
      const speed = Math.hypot(vx, vy);
      if (speed < 0.05) { stopLoop(); return false; }
      const cap = 2;
      if (speed > cap) { vx = vx / speed * cap; vy = vy / speed * cap; }
      velocity = { x: vx, y: vy };
      start("pan", time);
      return true;
    }

    function onWheel(event, anchor) {
      const cam = camera();
      if (!event || !finiteCamera()) return { inertia: false };
      if (event.kind === "trackpad" || event.kind === "pan") {
        cancel("wheel");
        cam.x -= Number(event.dx) || 0;
        cam.y -= Number(event.dy) || 0;
        render();
        return { inertia: false };
      }
      const delta = Math.max(-240, Math.min(240, Number(event.deltaY) || 0));
      const prefs = root.NeuroMapAppSettings;
      const gain = prefs ? prefs.wheelGain(event.trackpad ? "trackpad" : "mouse") : 0.0013;
      // Consecutive wheel ticks must stack on the requested target, not on
      // the frame that is still catching up.
      const base = !event.trackpad && mode === "zoom" && Number.isFinite(zoomTarget) ? zoomTarget : cam.zoom;
      const next = clampZoom(base * Math.exp(-delta * gain));
      const animate = !event.trackpad && !reduced && (prefs ? prefs.zoom().animate : true);
      if (!animate) {
        cancel("zoom");
        placeZoom(next, anchor);
        render();
        return { inertia: false };
      }
      zoomTarget = next;
      zoomAnchor = anchor;
      start("zoom", now());
      return { inertia: true };
    }

    function animateTo(target) {
      if (!target || !finiteCamera()) return false;
      if (reduced) {
        const cam = camera();
        if (Number.isFinite(target.x)) cam.x = target.x;
        if (Number.isFinite(target.y)) cam.y = target.y;
        if (Number.isFinite(target.zoom)) placeZoom(target.zoom, { x: cam.x, y: cam.y });
        render();
        return false;
      }
      spring = {
        x: Number.isFinite(target.x) ? target.x : camera().x,
        y: Number.isFinite(target.y) ? target.y : camera().y,
        zoom: Number.isFinite(target.zoom) ? clampZoom(target.zoom) : camera().zoom,
      };
      velocity = { x: 0, y: 0 };
      start("spring", now());
      return true;
    }

    function cancel() {
      samples = [];
      stopLoop();
    }

    return {
      beginPan, updatePan, endPan, onWheel,
      beginPinch: cancel, updatePinch() {}, endPinch: cancel,
      animateTo, cancel, setReducedMotion(enabled) { reduced = !!enabled; if (reduced) cancel("reduced"); },
      dispose: cancel,
      inspect() { return { active, mode, reduced, minZoom, maxZoom, velocity: { x: velocity.x, y: velocity.y } }; },
    };
  }

  function install(App, options) {
    if (!App || !App.prototype || App.prototype._nmCameraInstalled) return;
    App.prototype._nmCameraInstalled = true;
    const limits = options || {};
    const bind = App.prototype.bindUI;
    if (typeof bind === "function") {
      App.prototype.bindUI = function (...args) {
        const result = bind.apply(this, args);
        const dynamics = createCameraDynamics(this, limits);
        this._nmCameraDynamics = dynamics;
        if (this.renderer) this.renderer.app = this;
        const canvas = this.canvas;
        if (canvas && !canvas._nmDynamicsBound) {
          canvas._nmDynamicsBound = true;
          let panning = false;
          canvas.addEventListener("wheel", (event) => {
            if (!(event.ctrlKey || event.metaKey)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const trackpad = event.deltaMode === 0 && Math.abs(event.deltaY) < 40;
            const prefs = root.NeuroMapAppSettings?.zoom?.() || { cursor: true };
            const box = canvas.getBoundingClientRect();
            const anchor = prefs.cursor
              ? { x: event.clientX, y: event.clientY }
              : { x: box.left + box.width / 2, y: box.top + box.height / 2 };
            dynamics.onWheel({ kind: "zoom", deltaY: event.deltaY, trackpad }, anchor);
          }, { capture: true, passive: false });
          canvas.addEventListener("pointerdown", (event) => {
            dynamics.cancel("pointer");
            if (event.button !== 0 && event.button !== 1) return;
            panning = true;
            dynamics.beginPan({ x: event.clientX, y: event.clientY }, root.performance ? root.performance.now() : Date.now());
          });
          canvas.addEventListener("pointermove", (event) => {
            if (!panning || !this.drag || this.drag.kind !== "pan") return;
            dynamics.updatePan({ x: event.clientX, y: event.clientY }, root.performance ? root.performance.now() : Date.now());
          });
          const release = (event) => {
            if (!panning) return;
            panning = false;
            const moved = this.drag && this.drag.kind === "pan" && this.drag.moved;
            if (moved) dynamics.endPan(root.performance ? root.performance.now() : Date.now());
            else dynamics.cancel("tap");
            if (event && event.type === "pointercancel") dynamics.cancel("pointercancel");
          };
          canvas.addEventListener("pointerup", release, true);
          canvas.addEventListener("pointercancel", release, true);
        }
        return result;
      };
    }
    for (const name of ["fitToScreen", "undo", "redo", "activateTab"]) {
      const original = App.prototype[name];
      if (typeof original !== "function") continue;
      App.prototype[name] = function (...args) {
        this._nmCameraDynamics && this._nmCameraDynamics.cancel(name);
        this._nmAreaSelection && this._nmAreaSelection.cancel && this._nmAreaSelection.cancel(name);
        return original.apply(this, args);
      };
    }
    const drag = App.prototype.v5DragVisual;
    if (typeof drag === "function") {
      App.prototype.v5DragVisual = function (...args) {
        this._nmCameraDynamics && this._nmCameraDynamics.cancel("drag");
        this._nmAreaSelection && this._nmAreaSelection.cancel && this._nmAreaSelection.cancel("drag");
        return drag.apply(this, args);
      };
    }
  }

  root.NeuroMapCameraDynamics = { install, createCameraDynamics };
})(typeof globalThis === "object" ? globalThis : this);
