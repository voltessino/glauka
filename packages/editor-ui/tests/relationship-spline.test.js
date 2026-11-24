"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
require("../canvas-geometry.js");
const geo = globalThis.NeuroMapCanvasGeometry;

function finiteCurve(curve) {
  for (const key of ["x1", "y1", "cp1x", "cp1y", "cp2x", "cp2y", "x2", "y2", "labelX", "labelY", "tangentX", "tangentY"])
    assert.equal(Number.isFinite(curve[key]), true, key);
}

test("smart splines leave the facing edge and keep a real midpoint", () => {
  const left = { x: 0, y: 0, w: 40, h: 20 };
  const right = { x: 180, y: 30, w: 40, h: 20 };
  const curve = geo.computeSmartSpline(left, right);
  finiteCurve(curve);
  assert.equal(curve.sourceSide, "right");
  assert.ok(curve.x1 >= left.x + left.w);
  assert.ok(curve.x2 <= right.x);
  const mid = geo.bezierPoint(curve, 0.5);
  assert.ok(Math.abs(mid.x - curve.labelX) < 0.001);
  assert.ok(Math.abs(mid.y - curve.labelY) < 0.001);
  const tangent = geo.bezierTangent(curve, 0.78);
  assert.ok(Math.abs(tangent.x - curve.tangentX) < 0.001);
  const back = geo.computeSmartSpline(right, left);
  assert.equal(back.sourceSide, "left");
  const close = geo.computeSmartSpline({ x: 0, y: 0, w: 10, h: 10 }, { x: 2, y: 1, w: 10, h: 10 });
  finiteCurve(close);
  const far = geo.computeSmartSpline({ x: 0, y: 0, w: 20, h: 10 }, { x: 4000, y: -20, w: 20, h: 10 });
  finiteCurve(far);
  assert.ok(Math.hypot(far.cp1x - far.x1, far.cp1y - far.y1) < 200);
  assert.equal(left.w, 40);
});
