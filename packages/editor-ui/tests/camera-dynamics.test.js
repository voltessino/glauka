"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
require("../camera-dynamics.js");

function harness(limits) {
  let clock = 80;
  let queued = null;
  let history = 0;
  const app = {
    renderer: { camera: { x: 100, y: 40, zoom: 1 } },
    requestRender() {},
    state: { pushHistory() { history++; } },
  };
  const dynamics = globalThis.NeuroMapCameraDynamics.createCameraDynamics(app, {
    ...limits,
    now: () => clock,
    schedule(fn) { queued = fn; return 1; },
    cancelSchedule() { queued = null; },
  });
  return { app, dynamics, history: () => history, step(ms) { clock += ms; if (queued) queued(clock); } };
}

test("a quick pan glides and then stops without history", () => {
  const box = harness({ minZoom: 0.001, maxZoom: 3.5 });
  box.dynamics.beginPan({ x: 0, y: 0 }, 0);
  box.dynamics.updatePan({ x: 80, y: 0 }, 40);
  assert.equal(box.dynamics.endPan(80), true);
  assert.equal(box.dynamics.inspect().active, true);
  const start = box.app.renderer.camera.x;
  for (let i = 0; i < 50 && box.dynamics.inspect().active; i++) box.step(16);
  assert.ok(box.app.renderer.camera.x > start);
  assert.equal(box.dynamics.inspect().active, false);
  assert.equal(box.history(), 0);
  assert.ok(Number.isFinite(box.app.renderer.camera.x));
});

test("slow pan, reduced motion, trackpad and zoom limits stay exact", () => {
  const slow = harness({ minZoom: 0.001, maxZoom: 3.5 });
  slow.dynamics.beginPan({ x: 0, y: 0 }, 0);
  slow.dynamics.updatePan({ x: 2, y: 0 }, 80);
  assert.equal(slow.dynamics.endPan(80), false);
  assert.equal(slow.dynamics.inspect().active, false);
  const wheel = harness({ minZoom: 0.12, maxZoom: 3.5 });
  const before = { ...wheel.app.renderer.camera };
  const anchor = { x: 100, y: 40 };
  const worldX = (anchor.x - before.x) / before.zoom;
  assert.equal(wheel.dynamics.onWheel({ kind: "zoom", deltaY: -80, trackpad: true }, anchor).inertia, false);
  const cam = wheel.app.renderer.camera;
  assert.ok(cam.zoom >= 0.12 && cam.zoom <= 3.5);
  assert.ok(Math.abs((anchor.x - cam.x) / cam.zoom - worldX) < 0.001);
  assert.equal(wheel.dynamics.onWheel({ kind: "trackpad", dx: 12, dy: -3 }, anchor).inertia, false);
  wheel.dynamics.setReducedMotion(true);
  assert.equal(wheel.dynamics.animateTo({ x: 10, y: 10, zoom: 2 }), false);
  assert.equal(wheel.app.renderer.camera.x, 10);
  wheel.dynamics.beginPinch();
  assert.equal(wheel.dynamics.inspect().active, false);
  wheel.dynamics.cancel("undo");
  assert.equal(wheel.history(), 0);
});

test("consecutive mouse-wheel ticks reach the full zoom while the picture is still moving", () => {
  const box = harness({ minZoom: 0.12, maxZoom: 3.5 });
  const start = box.app.renderer.camera.zoom;
  const anchor = { x: 100, y: 40 };
  assert.equal(box.dynamics.onWheel({ kind: "zoom", deltaY: -80 }, anchor).inertia, true);
  assert.equal(box.app.renderer.camera.zoom, start);
  box.step(16);
  const first = start * Math.exp(80 * 0.0013);
  const mid = box.app.renderer.camera.zoom;
  assert.ok(mid > start && mid < first, "one frame eases toward the target instead of jumping");
  assert.equal(box.dynamics.onWheel({ kind: "zoom", deltaY: -40 }, anchor).inertia, true);
  for (let i = 0; i < 90 && box.dynamics.inspect().active; i++) box.step(16);
  const expected = start * Math.exp(80 * 0.0013) * Math.exp(40 * 0.0013);
  assert.equal(box.dynamics.inspect().active, false);
  assert.ok(Math.abs(box.app.renderer.camera.zoom - expected) < 0.001);
});
