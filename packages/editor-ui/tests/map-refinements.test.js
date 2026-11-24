"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module");
(() => {
  const dir = path.join(__dirname, "..");
  const filename = path.join(dir, "map-refinements.js");
  const source = fs
    .readFileSync(filename, "utf8")
    .replace(
      "/* @neuromap-map-refinements-helpers */\n",
      fs.readFileSync(path.join(dir, "map-refinements-helpers.js"), "utf8"),
    )
    .replace(
      "/* @neuromap-map-refinements-preview */\n",
      fs.readFileSync(path.join(dir, "map-refinements-preview.js"), "utf8")
        .replace(
          "/* @neuromap-map-refinements-preview-life */\n",
          fs.readFileSync(path.join(dir, "map-refinements-preview-life.js"), "utf8"),
        )
        .replace(
          "/* @neuromap-map-refinements-preview-draw */\n",
          fs.readFileSync(path.join(dir, "map-refinements-preview-draw.js"), "utf8"),
        ),
    );
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dir);
  mod._compile(source, filename);
})();
const C = globalThis.NeuroMapRefinementsInstall;
test("refinement settings clamp opacity, preserve opt-outs and reject unknown patterns", () => {
  assert.deepEqual(
    C.preferences({
      pattern: "evil",
      intensity: 99,
      path: false,
      guides: false,
      travel: false,
    }),
    {
      pattern: "dots",
      intensity: 30,
      path: false,
      guides: false,
      travel: false,
    },
  );
  assert.equal(C.preferences({ pattern: "none", intensity: -4 }).intensity, 0);
});
test("alignment compares centers and edges at a zoom-independent tolerance without moving objects", () => {
  const moving = { x: 100, y: 200, w: 80, h: 40 },
    targets = [
      { x: 102, y: 500, w: 50, h: 30 },
      { x: 800, y: 201, w: 80, h: 40 },
    ],
    before = JSON.stringify([moving, targets]);
  const guides = C.alignment(moving, targets, 3);
  assert.deepEqual(
    guides.map((g) => g.axis),
    ["x", "y"],
  );
  assert.equal(guides[0].value, 102);
  assert.equal(guides[1].value, 181);
  assert.equal(JSON.stringify([moving, targets]), before);
  assert.equal(C.alignment(moving, targets, 0.1).length, 0);
});
test("selected path is precise, bounded, handles cycles and never mutates the hierarchy", () => {
  const tree = {
    id: "root",
    children: [
      { id: "a", children: [{ id: "b", children: [] }] },
      { id: "c", children: [] },
    ],
  };
  const before = JSON.stringify(tree);
  assert.deepEqual(C.pathIds(tree, "b"), ["root", "a", "b"]);
  assert.deepEqual(C.pathIds(tree, "c"), ["root", "c"]);
  assert.deepEqual(C.pathIds(tree, "missing"), []);
  assert.equal(JSON.stringify(tree), before);
  tree.children[1].children.push(tree);
  assert.deepEqual(C.pathIds(tree, "b"), ["root", "a", "b"]);
  let node = { id: "d0", children: [] },
    root = node;
  for (let i = 1; i <= 300; i++) {
    const child = { id: "d" + i, children: [] };
    node.children.push(child);
    node = child;
  }
  assert.equal(C.pathIds(root, "d300").length, 256);
});

test("retired path, guide and travel effects cannot be re-enabled by saved preferences", () => {
  assert.deepEqual(C.preferences({ path: true, guides: true, travel: true }), {
    pattern: "dots",
    intensity: 13,
    path: false,
    guides: false,
    travel: false,
  });
});
