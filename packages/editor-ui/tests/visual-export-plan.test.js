"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
new Function(require('./helpers/compose-graphics.cjs')())();
const { exportPlan } = globalThis.NeuroMapGraphics;
test("graphical PDF defaults to one page with every padded edge inside the printable area", () => {
  for (const [w, h] of [
    [300, 200],
    [8000, 1100],
    [1100, 8000],
    [120000, 90000],
  ])
    for (const paper of ["a3", "a4"])
      for (const orientation of ["landscape", "portrait"]) {
        const p = exportPlan(
          { minX: -400, minY: 100, width: w, height: h },
          { paper, orientation },
        );
        assert.equal(p.cols * p.rows, 1);
        assert.ok(p.startX <= p.mapX && p.startY <= p.mapY);
        assert.ok(p.startX + p.innerW * p.worldPerPt >= p.mapX + p.mapW - 1e-8);
        assert.ok(p.startY + p.innerH * p.worldPerPt >= p.mapY + p.mapH - 1e-8);
        assert.equal(p.pageW > p.pageH, orientation === "landscape");
      }
});
test("tiling is explicit, bounded and covers the entire map", () => {
  const box = { minX: -500, minY: -20, width: 12000, height: 9000 };
  const p = exportPlan(box, { pagination: "tiles" });
  assert.ok(p.cols * p.rows > 1 && p.cols * p.rows <= 48);
  assert.equal(p.startX, p.mapX);
  assert.equal(p.startY, p.mapY);
  assert.ok(p.cols * p.innerW * p.worldPerPt >= p.mapW);
  assert.ok(p.rows * p.innerH * p.worldPerPt >= p.mapH);
});
test("PNG quality options respect canvas memory limits without cropping", () => {
  for (const [w, h] of [
    [1000, 500],
    [120000, 90000],
    [1000000, 300],
  ])
    for (const scale of [1, 2, 3]) {
      const p = exportPlan(
        { minX: -80, minY: -90, width: w, height: h },
        { format: "png", scale },
      );
      assert.ok(p.width <= 10000 && p.height <= 10000);
      assert.ok(p.width * p.height <= 32000000);
      assert.ok(p.scale <= scale);
      assert.equal(p.mapX, -140);
      assert.equal(p.mapY, -150);
    }
});
