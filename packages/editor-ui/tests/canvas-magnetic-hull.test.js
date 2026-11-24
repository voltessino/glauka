"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
require("../canvas-geometry.js");
const geo = globalThis.NeuroMapCanvasGeometry;

test("convex hull is deterministic and padding stays outside the nodes", () => {
  const square = geo.convexHull([
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 5, y: 5 },
  ]);
  assert.equal(square.length, 4);
  const again = geo.convexHull(square.map((point) => ({ x: point.x, y: point.y })).reverse());
  assert.deepEqual(again.map((point) => point.x).sort(), square.map((point) => point.x).sort());
  const padded = geo.expandHull(square, 12);
  const center = padded.reduce((sum, point) => sum + point.x, 0) / padded.length;
  assert.ok(Math.max(...padded.map((point) => point.x)) > 10);
  assert.ok(center > 0 && center < 10);
  const many = [];
  for (let i = 0; i < 1000; i++) many.push({ x: (i * 17) % 200, y: (i * 13) % 80 });
  const hull = geo.convexHull(many);
  assert.ok(hull.length >= 3 && hull.length < 100);
  assert.equal(many.length, 1000);
});
