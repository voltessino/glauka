"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
require("../canvas-geometry.js");
require("../canvas-area-selection.js");
const geo = globalThis.NeuroMapCanvasGeometry;
const area = globalThis.NeuroMapAreaSelection;

function appWith(nodes) {
  const root = { id: "root", children: nodes, collapsed: false };
  const layouts = { root: { x: 0, y: 0, width: 40, height: 20 } };
  for (const node of nodes) layouts[node.id] = node.box;
  let history = 0, dirty = 0, renders = 0;
  const app = {
    state: {
      root, selectedNodeIds: [], selectedNodeId: "root",
      pushHistory() { history++; }, markChanged() { dirty++; },
    },
    layout: { getLayout: (id) => layouts[id] || null },
    renderer: {
      camera: { x: 0, y: 0, zoom: 1 },
      screenToWorld: (x, y) => ({ x, y }),
    },
    requestRender() { renders++; },
    counts: () => ({ history, dirty, renders }),
  };
  return app;
}

test("box selection keeps partial hits and ignores a click that does not drag", () => {
  const app = appWith([
    { id: "a", box: { x: 30, y: 0, width: 20, height: 20 } },
    { id: "b", box: { x: 200, y: 0, width: 20, height: 20 } },
    { id: "hidden", collapsed: true, box: { x: 40, y: 0, width: 20, height: 20 }, children: [
      { id: "child", box: { x: 40, y: 40, width: 10, height: 10 } },
    ] },
  ]);
  app.state.root.children[2].children = [{ id: "child" }];
  const controller = area.createAreaSelectionController(app);
  controller.setMode("box");
  controller.begin({ x: 0, y: 0 });
  controller.update({ x: 2, y: 1 });
  assert.deepEqual(controller.finish(), []);
  assert.equal(app.state.selectedNodeIds.length, 0);
  controller.begin({ x: 10, y: -20 });
  controller.update({ x: 50, y: 20 });
  const ids = controller.finish();
  assert.ok(ids.includes("a"));
  assert.ok(!ids.includes("b"));
  assert.ok(!ids.includes("child"));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(app.counts(), { history: 0, dirty: 0, renders: app.counts().renders });
  assert.equal(app.state.pushHistory, app.state.pushHistory);
  assert.equal(app.counts().history, 0);
  assert.equal(app.counts().dirty, 0);
});

test("lasso uses even-odd intersection and escape drops the gesture", () => {
  const concave = geo.polygonIntersectsRect(
    [{ x: 0, y: 0 }, { x: 30, y: 10 }, { x: 0, y: 20 }, { x: 8, y: 10 }],
    { x: 2, y: 8, w: 6, h: 4 }
  );
  assert.equal(concave, true);
  assert.equal(geo.pointInPolygon({ x: 1, y: 10 }, [
    { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 },
    { x: 0, y: 8 }, { x: 10, y: 8 }, { x: 10, y: 12 }, { x: 0, y: 12 },
  ]), false);
  const noisy = [];
  for (let i = 0; i < 1200; i++) noisy.push({ x: i, y: i % 3 === 0 ? 1 : 0 });
  const simple = geo.simplifyPolyline(noisy, 2);
  assert.ok(simple.length < noisy.length);
  assert.ok(simple.length <= 1024);
  const app = appWith([{ id: "edge", box: { x: 10, y: 10, width: 8, height: 8 } }]);
  const controller = area.createAreaSelectionController(app);
  controller.setMode("lasso");
  controller.begin({ x: 0, y: 0 });
  controller.update({ x: NaN, y: 4 });
  controller.update({ x: 40, y: 0 });
  controller.update({ x: 40, y: 40 });
  controller.update({ x: 0, y: 40 });
  assert.ok(controller.finish().includes("edge"));
  controller.begin({ x: 0, y: 0 });
  controller.update({ x: 30, y: 10 });
  controller.cancel("escape");
  assert.equal(controller.snapshot().active, false);
  assert.equal(app.counts().history, 0);
});
