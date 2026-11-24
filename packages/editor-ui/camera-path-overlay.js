/* Temporary camera-route overlay. It is not part of the map and is skipped on export. */
(function (root) {
  "use strict";

  function attach(app, path) {
    if (!app) return false;
    if (!path || !Array.isArray(path.points) || !path.points.length || path.available === false) {
      app._nmCameraPath = null;
      return false;
    }
    app._nmCameraPath = path;
    if (typeof app.requestRender === "function") app.requestRender();
    return true;
  }

  function clear(app) {
    if (!app) return;
    app._nmCameraPath = null;
    if (typeof app.requestRender === "function") app.requestRender();
  }

  function paint(renderer) {
    const path = renderer && renderer.app && renderer.app._nmCameraPath;
    const ctx = renderer && renderer.ctx;
    if (!ctx || !path || !Array.isArray(path.points) || renderer._nmNavExport) return;
    const points = path.points.filter((point) => Number.isFinite(point.worldX) && Number.isFinite(point.worldY));
    if (points.length < 1) return;
    const zoom = renderer.camera && renderer.camera.zoom || 1;
    ctx.save();
    ctx.strokeStyle = "rgba(100,65,223,.85)";
    ctx.fillStyle = "rgba(100,65,223,.9)";
    ctx.lineWidth = 1.25 / zoom;
    ctx.setLineDash([5 / zoom, 4 / zoom]);
    ctx.beginPath();
    ctx.moveTo(points[0].worldX, points[0].worldY);
    for (const point of points) ctx.lineTo(point.worldX, point.worldY);
    ctx.stroke();
    ctx.setLineDash([]);
    points.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point.worldX, point.worldY, (point.kind === "current" ? 5 : 2.5) / zoom, 0, Math.PI * 2);
      ctx.fill();
      if (point.kind === "start" || point.kind === "end" || point.kind === "hold") {
        ctx.font = (11 / zoom) + "px sans-serif";
        ctx.fillText(String(index + 1), point.worldX + 6 / zoom, point.worldY - 6 / zoom);
      }
    });
    ctx.restore();
  }

  root.NeuroMapCameraPath = { attach, clear, paint };
})(typeof globalThis === "object" ? globalThis : this);
