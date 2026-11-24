"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
require("../gentle-motion.js");
const Motion = globalThis.NeuroMapGentleMotion;
function fixture() {
  let now = 0;
  const callbacks = {};
  globalThis.performance = { now: () => now };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  const media = {
    matches: false,
    addEventListener(type, fn) {
      callbacks.media = fn;
    },
  };
  globalThis.matchMedia = () => media;
  globalThis.document = {
    hidden: false,
    head: { append() {} },
    body: { dataset: {} },
    createElement: () => ({}),
    getElementById: () => null,
    querySelectorAll: () => [],
    addEventListener(type, fn) {
      callbacks[type] = fn;
    },
  };
  class Renderer {
    constructor() {
      this.ctx = {
        globalAlpha: 1,
        save() {
          this.old = this.globalAlpha;
        },
        restore() {
          this.globalAlpha = this.old;
        },
        translate() {},
      };
      this.alphas = [];
    }
    drawNode() {
      this.alphas.push(this.ctx.globalAlpha);
    }
    render(ctx) {
      if (ctx) this.ctx = ctx;
      this.drawNode({ id: this.state.selectedNodeId });
    }
  }
  class App {
    constructor() {
      this.state = { selectedNodeId: "root" };
      this.renderer = new Renderer();
      this.renderer.state = this.state;
      this.queued = 0;
      this.counter = 0;
    }
    bindUI() {}
    requestRender() {
      this.queued++;
    }
    addChild() {
      this.state.selectedNodeId = "n" + ++this.counter;
    }
    addSibling() {
      this.addChild();
    }
    undo() {}
    activateTab() {}
    importHierarchy() {}
  }
  Motion.install(App, Renderer);
  const app = new App();
  globalThis.neuroMapApp = app;
  app.bindUI();
  return {
    app,
    media,
    callbacks,
    time(value) {
      now = value;
    },
  };
}
test("motion preferences accept only booleans and progress is bounded", () => {
  assert.deepEqual(Motion.preferences(null), {
    branches: true,
    interface: true,
    duration: 360,
  });
  assert.deepEqual(Motion.preferences({ branches: false, interface: false }), {
    branches: false,
    interface: false,
    duration: 360,
  });
  assert.equal(Motion.progress(100, 0), 0);
  assert.equal(Motion.progress(0, 500), 1);
});
test("rapid creation keeps at most eight transient entries and frames stop after the configured duration", () => {
  const f = fixture();
  for (let i = 0; i < 200; i++) f.app.addChild();
  assert.equal(NeuroMapMotion.inspect(f.app).active, 8);
  f.time(90);
  f.app.renderer.render();
  assert.ok(f.app.renderer.alphas.at(-1) < 1);
  f.time(370);
  f.app.renderer.render();
  assert.equal(NeuroMapMotion.inspect(f.app).active, 0);
  const queued = f.app.queued;
  for (let i = 0; i < 20; i++) f.app.renderer.render();
  assert.equal(f.app.queued, queued);
  assert.equal(f.app.renderer.alphas.at(-1), 1);
});
test("export is fully opaque during an animation and history operations discard effects", () => {
  const f = fixture();
  f.app.addChild();
  const c = { globalAlpha: 1 };
  f.app.renderer.render(c);
  assert.equal(f.app.renderer.alphas.at(-1), 1);
  assert.equal(NeuroMapMotion.inspect(f.app).active, 1);
  f.app.undo();
  assert.equal(NeuroMapMotion.inspect(f.app).active, 0);
});
test("reduced motion, disabled preferences and a hidden window stop branch and interface effects", () => {
  const f = fixture();
  f.app.addChild();
  f.media.matches = true;
  f.callbacks.media();
  assert.equal(NeuroMapMotion.inspect(f.app).active, 0);
  assert.equal(document.body.dataset.nmMotion, "off");
  f.app.addChild();
  assert.equal(NeuroMapMotion.inspect(f.app).active, 0);
  f.media.matches = false;
  NeuroMapMotion.set({ branches: false, interface: false });
  f.app.addChild();
  assert.equal(NeuroMapMotion.inspect(f.app).active, 0);
  NeuroMapMotion.set({ branches: true, interface: true });
  f.app.addChild();
  document.hidden = true;
  f.callbacks.visibilitychange();
  assert.equal(NeuroMapMotion.inspect(f.app).active, 0);
});
test("sustained slow rendering abandons the animation and leaves only the final frame to paint", () => {
  const f = fixture();
  f.app.addChild();
  const original = f.app.renderer.drawNode;
  f.app.renderer.drawNode = function (...args) {
    f.time(performance.now() + 45);
    return original.apply(this, args);
  };
  f.app.renderer.render();
  assert.equal(NeuroMapMotion.inspect(f.app).active, 1);
  f.app.renderer.render();
  f.app.renderer.render();
  assert.equal(NeuroMapMotion.inspect(f.app).active, 0);
});

test("duration clamps malformed values, persists opt-outs and changes real draw progress", () => {
  assert.equal(Motion.preferences({ duration: NaN }).duration, 360);
  assert.equal(Motion.preferences({ duration: Infinity }).duration, 360);
  assert.equal(Motion.preferences({ duration: -50 }).duration, 120);
  assert.equal(Motion.preferences({ duration: 9000 }).duration, 1000);
  const f = fixture();
  NeuroMapMotion.set({ duration: 1000 });
  f.app.addChild();
  f.time(500);
  f.app.renderer.render();
  assert.ok(f.app.renderer.alphas.at(-1) < 0.9);
  assert.equal(NeuroMapMotion.inspect(f.app).active, 1);
  f.time(1001);
  f.app.renderer.render();
  assert.equal(NeuroMapMotion.inspect(f.app).active, 0);
});
