"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

require("../canvas-premium.js");
const Premium = globalThis.NeuroMapCanvasPremium;

test("collapsed branches show a plus and open branches show a minus", () => {
  assert.equal(Premium.badgeLabel(0, true), "+");
  assert.equal(Premium.badgeLabel(1, true), "+");
  assert.equal(Premium.badgeLabel(12, true), "+");
  assert.equal(Premium.badgeLabel(99, true), "+");
  assert.equal(Premium.badgeLabel(100, true), "+");
  assert.equal(Premium.badgeLabel(240, false), "−");
  const node = { children: Array.from({ length: 120 }, () => ({})), collapsed: true, side: "left" };
  const box = Premium.badgeBox(node, { x: 0, y: 0, width: 80, height: 28 }, { branchStyle: "balanced" });
  assert.equal(box.label, "+");
  assert.equal(node.children.length, 120);
  assert.equal(node.collapsed, true);
  assert.ok(box.cx < 0);
});

test("palette falls back without reading computed style per node", () => {
  const colors = Premium.colors();
  for (const key of ["focus", "focusHalo", "hover", "dropValid", "dropInvalid", "badgeSurface", "badgeText"])
    assert.equal(typeof colors[key], "string");
  assert.match(fs.readFileSync(path.join(__dirname, "../interface-theme.css"), "utf8"), /--gv-canvas-focus:var\(--nm-theme-action\)/);
  assert.match(fs.readFileSync(path.join(__dirname, "../../../scripts/release/prepare.py"), "utf8"), /canvas-premium\.js/);
});

test("plain branches do not receive a filled card from the premium painter", () => {
  const source = fs.readFileSync(path.join(__dirname, "../canvas-premium.js"), "utf8");
  assert.match(source, /if \(!plain && isSelected/);
  assert.match(source, /type !== "badge"/);
  assert.match(source, /stopImmediatePropagation/);
});

test("folding animates only the presentation and keeps a single history step", () => {
  require("../gentle-motion.js");
  const Motion = globalThis.NeuroMapGentleMotion;
  let now = 0;
  globalThis.performance = { now: () => now };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  const callbacks = {};
  const media = { matches: false, addEventListener(type, fn) { callbacks[type] = fn; } };
  globalThis.matchMedia = () => media;
  globalThis.document = {
    hidden: false,
    head: { append() {} },
    body: { dataset: {}, style: { setProperty() {} } },
    createElement: () => ({}),
    getElementById: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    documentElement: { lang: "it" },
  };
  class Renderer {
    constructor() {
      this.ctx = {
        globalAlpha: 1,
        save() {},
        restore() {},
        translate() {},
        beginPath() {},
        strokeRect() {},
        fillText() {},
      };
      this.alphas = [];
    }
    drawNode(node) { this.alphas.push(this.ctx.globalAlpha); this.last = node && node.id; }
    render() { this.drawNode({ id: "child", side: "right" }); }
  }
  class App {
    constructor() {
      this.renderer = new Renderer();
      this.queued = 0;
      this.passes = 0;
    }
    bindUI() {}
    requestRender() { this.queued++; }
    recalculateAndRender() { this.passes++; }
    undo() {}
    redo() {}
    activateTab() {}
    importHierarchy() {}
    v5DragVisual() { this.dragged = true; }
  }
  Motion.install(App, Renderer);
  Premium.install(App, Renderer);
  const app = new App();
  globalThis.neuroMapApp = app;
  const child = { id: "child", text: "Figlio", side: "right", color: "#88a", collapsed: true, children: [], isSummary: false };
  const node = { id: "parent", collapsed: false, side: "right", children: [child] };
  app.state = {
    history: 0,
    findNode(id) { return id === "parent" ? node : child; },
    toggleCollapse(id) {
      this.history += 1;
      const target = this.findNode(id);
      target.collapsed = !target.collapsed;
      return true;
    },
  };
  app.layout = { getLayout: () => ({ x: 10, y: 20, width: 40, height: 16 }) };
  app.renderer.state = app.state;
  app.bindUI();
  assert.equal(app.state.toggleCollapse("parent"), true);
  assert.equal(node.collapsed, true);
  assert.equal(app.state.history, 1);
  assert.equal(globalThis.NeuroMapMotion.inspect(app).ghosts, 1);
  app.recalculateAndRender();
  assert.equal(globalThis.NeuroMapMotion.inspect(app).ghosts, 1);
  app.recalculateAndRender();
  assert.equal(globalThis.NeuroMapMotion.inspect(app).ghosts, 0);
  node.collapsed = true;
  child.collapsed = false;
  assert.equal(app.state.toggleCollapse("parent"), true);
  assert.equal(node.collapsed, false);
  assert.equal(app.state.history, 2);
  assert.equal(globalThis.NeuroMapMotion.inspect(app).fold, 1);
  app.undo();
  assert.equal(globalThis.NeuroMapMotion.inspect(app).fold, 0);
  assert.equal(app.state.history, 2);
  node.collapsed = true;
  node.children = [{ id: "only", text: "Solo", side: "right", collapsed: true, children: [], isSummary: false }];
  app.state.toggleCollapse("parent");
  assert.equal(globalThis.NeuroMapMotion.inspect(app).fold, 1);
  app.v5DragVisual();
  assert.equal(app.dragged, true);
  assert.equal(globalThis.NeuroMapMotion.inspect(app).fold, 0);
  node.collapsed = false;
  node.children = Array.from({ length: 70 }, (_, i) => ({
    id: "n" + i, text: "n", side: "right", collapsed: true, children: [], isSummary: false,
  }));
  const before = app.state.history;
  assert.equal(app.state.toggleCollapse("parent"), true);
  assert.equal(globalThis.NeuroMapMotion.inspect(app).fold, 0);
  assert.equal(globalThis.NeuroMapMotion.inspect(app).ghosts, 0);
  assert.equal(app.state.history, before + 1);
  assert.equal(node.children.length, 70);
  node.collapsed = false;
  node.children = [{ id: "only", text: "Solo", side: "right", collapsed: true, children: [], isSummary: false }];
  media.matches = true;
  const reducedBefore = app.state.history;
  assert.equal(app.state.toggleCollapse("parent"), true);
  assert.equal(node.collapsed, true);
  assert.equal(globalThis.NeuroMapMotion.inspect(app).ghosts, 0);
  assert.equal(app.state.history, reducedBefore + 1);
});
