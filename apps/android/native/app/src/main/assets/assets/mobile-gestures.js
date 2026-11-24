/* One gesture owner for the map. Document capture runs before node/image dragging. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else if (root.document) {
    const canvas = root.document.getElementById("mindmap-canvas");
    if (canvas) root.GlaukaMobileGesture = factory(root, canvas);
  }
})(globalThis, function (root, canvas) {
  "use strict";
  const points = new Map();
  let session = null,
    blocked = false,
    frame = 0,
    longTimer = 0,
    longStart = null,
    suppressUntil = 0;
  const app = () => root.neuroMapApp;
  const stop = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const pair = () => [...points.values()].slice(0, 2);
  const center = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function cancelDrag() {
    const a = app();
    if (!a) return;
    a.stopTeleport?.();
    a.nmCancelDrag?.();
    if (a.drag?.historyTaken) a.markChanged?.();
    a.drag = null;
  }
  function clearLong() {
    root.clearTimeout(longTimer);
    longTimer = 0;
    longStart = null;
  }
  function begin() {
    const a = app(),
      [p, q] = pair();
    if (!a || !p || !q) return;
    cancelDrag();
    clearLong();
    const mid = center(p, q),
      camera = a.renderer.camera;
    session = {
      owner: a.state,
      tabId: a.activeTabId,
      distance: Math.max(6, distance(p, q)),
      zoom: camera.zoom,
      worldX: (mid.x - camera.x) / camera.zoom,
      worldY: (mid.y - camera.y) / camera.zoom,
    };
    blocked = true;
  }
  function apply() {
    frame = 0;
    const a = app(),
      [p, q] = pair();
    if (!a || !session || !p || !q) return;
    if (a.state !== session.owner || a.activeTabId !== session.tabId) {
      cancel();
      return;
    }
    const mid = center(p, q),
      zoom = Math.max(
        0.12,
        Math.min(3.5, (session.zoom * distance(p, q)) / session.distance),
      );
    const camera = a.renderer.camera;
    camera.zoom = zoom;
    camera.x = mid.x - session.worldX * zoom;
    camera.y = mid.y - session.worldY * zoom;
    a.updateStatus?.();
    a.requestRender();
    a.positionEditor?.();
  }
  function down(e) {
    if (e.pointerType !== "touch" || e.target !== canvas) return;
    app()?.stopTeleport?.();
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (points.size >= 2) {
      if (points.size === 2) begin();
      stop(e);
      return;
    }
    longStart = { id: e.pointerId, x: e.clientX, y: e.clientY };
    longTimer = root.setTimeout(() => {
      if (points.size !== 1 || blocked) return;
      const p = longStart;
      if (!p) return;
      cancelDrag();
      blocked = true;
      suppressUntil = Date.now() + 500;
      root.GlaukaMobileShell?.nodeAt(p.x, p.y);
    }, 650);
  }
  function move(e) {
    if (e.pointerType !== "touch" || !points.has(e.pointerId)) return;
    if (
      longStart?.id === e.pointerId &&
      Math.hypot(e.clientX - longStart.x, e.clientY - longStart.y) > 10
    )
      clearLong();
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (points.size >= 2) {
      if (!session) begin();
      if (!frame) frame = root.requestAnimationFrame(apply);
      stop(e);
    } else if (blocked) stop(e);
  }
  function end(e) {
    if (e.pointerType !== "touch" || !points.has(e.pointerId)) return;
    clearLong();
    if (session) {
      if (frame) root.cancelAnimationFrame(frame);
      apply();
    }
    points.delete(e.pointerId);
    if (blocked) {
      stop(e);
      suppressUntil = Date.now() + 450;
    }
    if (points.size >= 2) begin();
    else session = null;
    if (!points.size) blocked = false;
  }
  function cancel() {
    clearLong();
    if (frame) root.cancelAnimationFrame(frame);
    frame = 0;
    points.clear();
    session = null;
    blocked = false;
    cancelDrag();
  }
  const document = root.document;
  document.addEventListener("pointerdown", down, {
    capture: true,
    passive: false,
  });
  document.addEventListener("pointermove", move, {
    capture: true,
    passive: false,
  });
  document.addEventListener("pointerup", end, {
    capture: true,
    passive: false,
  });
  document.addEventListener("pointercancel", end, {
    capture: true,
    passive: false,
  });
  document.addEventListener(
    "click",
    (e) => {
      if (e.target === canvas && Date.now() < suppressUntil) stop(e);
    },
    true,
  );
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancel();
  });
  root.addEventListener?.("blur", cancel);
  return Object.freeze({
    cancel,
    inspect: () => ({
      pointers: points.size,
      pinching: !!session,
      blocked,
      pendingFrame: !!frame,
    }),
  });
});
