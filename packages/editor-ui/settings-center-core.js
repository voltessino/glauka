/* App-level zoom preference. Never written into a map document. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NeuroMapAppSettings = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const KEY = "glauka.app.zoom.v1";
  // Speed 2 keeps the historic mouse-wheel step of 0.0013.
  const MOUSE_UNIT = 0.00065;
  const TRACKPAD_GAIN = 0.0013;
  const LINKED_UNIT = 0.001;
  const LINKED_TRACKPAD = 0.002;

  function storage() {
    try { return globalThis.localStorage || null; } catch { return null; }
  }
  function clampSpeed(value) {
    const number = Math.round(Number(value) * 10) / 10;
    if (!Number.isFinite(number)) return 2;
    return Math.max(0.5, Math.min(3, number));
  }
  function read() {
    let data = null;
    try { data = JSON.parse(storage()?.getItem(KEY) || "null"); } catch { data = null; }
    if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
    return {
      speed: clampSpeed(data.speed == null ? 2 : data.speed),
      animate: data.animate !== false,
      cursor: data.cursor !== false
    };
  }
  function write(partial) {
    const next = read();
    if (partial && typeof partial === "object") {
      if ("speed" in partial) next.speed = clampSpeed(partial.speed);
      if (typeof partial.animate === "boolean") next.animate = partial.animate;
      if (typeof partial.cursor === "boolean") next.cursor = partial.cursor;
    }
    try { storage()?.setItem(KEY, JSON.stringify(next)); } catch { /* the screen still uses the value */ }
    return read();
  }
  function reset() {
    try { storage()?.removeItem(KEY); } catch { /* ignore */ }
    return read();
  }
  // Mouse wheel uses the slider. Trackpad and pinch keep a fixed precise step.
  function wheelGain(kind) {
    if (kind === "trackpad" || kind === "pinch") return TRACKPAD_GAIN;
    return MOUSE_UNIT * read().speed;
  }
  function linkedGain(kind) {
    if (kind === "trackpad" || kind === "pinch") return LINKED_TRACKPAD;
    return LINKED_UNIT * read().speed;
  }
  return Object.freeze({
    KEY, read, write, reset, zoom: read, zoomSpeed: () => read().speed,
    wheelGain, linkedGain, clampSpeed
  });
});
