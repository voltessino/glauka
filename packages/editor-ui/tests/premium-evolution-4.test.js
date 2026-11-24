"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
require("../canvas-geometry.js");
require("../camera-path-overlay.js");

test("relationship geometry is shared and the camera path is not stored on the map", () => {
  const desktop = fs.readFileSync(path.join(__dirname, "../../../apps/desktop-shared/editor/renderer.js"), "utf8");
  const android = fs.readFileSync(path.join(__dirname, "../../../apps/android/editor/renderer.js"), "utf8");
  for (const source of [desktop, android]) {
    assert.match(source, /computeSmartSpline/);
    assert.match(source, /NeuroMapAreaSelection\?\.paint/);
    assert.match(source, /NeuroMapCameraPath\?\.paint/);
  }
  const prepare = fs.readFileSync(path.join(__dirname, "../../../scripts/release/prepare.py"), "utf8");
  for (const name of ["canvas-geometry.js", "canvas-area-selection.js", "camera-dynamics.js", "camera-path-overlay.js"])
    assert.match(prepare, new RegExp(name));
  const app = { requestRender() {}, state: { nodes: [{ id: "keep" }] } };
  const attached = globalThis.NeuroMapCameraPath.attach(app, {
    available: true,
    points: [{ frame: 0, worldX: 10, worldY: 20, kind: "start" }],
  });
  assert.equal(attached, true);
  assert.equal(app.state.nodes.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(app.state.nodes[0], "cameraPath"), false);
  globalThis.NeuroMapCameraPath.clear(app);
  assert.equal(app._nmCameraPath, null);
});
