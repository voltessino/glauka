const { test } = require("node:test"),
  assert = require("node:assert/strict");
const create = require("../native/app/src/main/assets/assets/mobile-gestures.js");
function harness() {
  const handlers = new Map(),
    frames = new Map(),
    timers = new Map();
  let id = 0,
    renders = 0;
  const canvas = {},
    camera = { x: 0, y: 0, zoom: 1 };
  const state = {
    root: { id: "root", children: [{ id: "child", text: "Keep me" }] },
  };
  const app = {
    state,
    renderer: { camera },
    drag: { kind: "pan" },
    requestRender() {
      renders++;
    },
    nmCancelDrag() {
      this._v5Candidate = null;
    },
    stopTeleport() {},
    updateStatus() {},
    positionEditor() {},
  };
  const root = {
    neuroMapApp: app,
    document: {
      hidden: false,
      addEventListener(type, fn) {
        handlers.set(type, fn);
      },
    },
    addEventListener() {},
    setTimeout(fn) {
      timers.set(++id, fn);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    requestAnimationFrame(fn) {
      frames.set(++id, fn);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  };
  const api = create(root, canvas);
  const send = (type, id, x, y, target = canvas) => {
    const e = {
      pointerType: "touch",
      pointerId: id,
      clientX: x,
      clientY: y,
      target,
      preventDefault() {
        this.prevented = true;
      },
      stopImmediatePropagation() {
        this.stopped = true;
      },
    };
    handlers.get(type)(e);
    return e;
  };
  const flush = () => {
    for (const [id, fn] of [...frames]) {
      frames.delete(id);
      fn();
    }
  };
  return {
    root,
    app,
    camera,
    state,
    api,
    send,
    flush,
    frames,
    timers,
    renders: () => renders,
  };
}
test("pinch uses a fixed world anchor, coalesces frames and never changes the map", () => {
  const h = harness(),
    original = JSON.stringify(h.state);
  h.send("pointerdown", 1, 100, 200);
  assert.equal(h.send("pointerdown", 2, 200, 200).stopped, true);
  h.send("pointermove", 1, 50, 200);
  h.send("pointermove", 2, 250, 200);
  assert.equal(h.frames.size, 1);
  h.flush();
  assert.deepEqual(h.camera, { x: -150, y: -200, zoom: 2 });
  for (let i = 0; i < 200; i++) {
    h.send("pointermove", 1, 50, 200);
    h.send("pointermove", 2, 250, 200);
    h.flush();
  }
  assert.deepEqual(h.camera, { x: -150, y: -200, zoom: 2 });
  assert.equal(JSON.stringify(h.state), original);
  assert.equal(h.app.drag, null);
});
test("lifting one finger cannot resume the stale one-finger drag", () => {
  const h = harness();
  h.send("pointerdown", 1, 100, 200);
  h.send("pointerdown", 2, 200, 200);
  h.send("pointermove", 2, 300, 200);
  h.flush();
  h.send("pointerup", 2, 300, 200);
  const camera = { ...h.camera };
  assert.equal(h.send("pointermove", 1, 900, 800).stopped, true);
  h.flush();
  assert.deepEqual(h.camera, camera);
  h.send("pointerup", 1, 900, 800);
  assert.deepEqual(h.api.inspect(), {
    pointers: 0,
    pinching: false,
    blocked: false,
    pendingFrame: false,
  });
  assert.equal(h.send("pointerdown", 3, 50, 50).stopped, undefined);
});
test("cancel and three-finger transitions clear timers and keep finite camera values", () => {
  const h = harness();
  h.send("pointerdown", 1, 100, 200);
  h.send("pointerdown", 2, 200, 200);
  h.send("pointerdown", 3, 250, 220);
  h.send("pointermove", 2, 300, 210);
  h.flush();
  h.send("pointerup", 1, 100, 200);
  h.send("pointermove", 3, 250, 220);
  h.flush();
  assert.ok(Object.values(h.camera).every(Number.isFinite));
  h.api.cancel();
  assert.equal(h.frames.size, 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.api.inspect().pointers, 0);
});
test("touches on scrollable app panels never enter map gestures", () => {
  const h = harness();
  h.send("pointerdown", 1, 100, 100, {});
  h.send("pointerdown", 2, 200, 100, {});
  assert.equal(h.api.inspect().pointers, 0);
  assert.equal(h.renders(), 0);
});

test("long press cancels branch dragging and opens mobile actions once", () => {
  const h = harness();
  let shown = 0;
  h.root.GlaukaMobileShell = {
    nodeAt(x, y) {
      shown++;
      assert.deepEqual([x, y], [100, 200]);
    },
  };
  h.send("pointerdown", 1, 100, 200);
  [...h.timers.values()][0]();
  assert.equal(shown, 1);
  assert.equal(h.app.drag, null);
  assert.equal(h.api.inspect().blocked, true);
  assert.equal(h.send("pointerup", 1, 100, 200).stopped, true);
  assert.equal(h.timers.size, 0);
});

test("switching projects during a pinch cancels it without moving the new project", () => {
  const h = harness();
  h.send("pointerdown", 1, 100, 200);
  h.send("pointerdown", 2, 200, 200);
  const camera = { ...h.camera };
  h.app.state = { root: { id: "other" } };
  h.app.activeTabId = "other";
  h.send("pointermove", 2, 350, 200);
  h.flush();
  assert.deepEqual(h.camera, camera);
  assert.equal(h.api.inspect().pointers, 0);
  assert.equal(h.api.inspect().pendingFrame, false);
});
