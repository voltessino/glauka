"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");

function memory() {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
  return data;
}

const settings = require("../settings-center-core.js");

test("zoom speed starts at 2 and stays inside the slider", () => {
  memory();
  assert.deepEqual(settings.read(), { speed: 2, animate: true, cursor: true });
  assert.equal(settings.clampSpeed(9), 3);
  assert.equal(settings.clampSpeed(0.1), 0.5);
  assert.equal(settings.write({ speed: 2.26 }).speed, 2.3);
  assert.equal(settings.zoomSpeed(), 2.3);
});

test("the choice is kept on this computer and is not written into a map", () => {
  const data = memory();
  const map = { id: "map-1", nodes: [{ id: "root", text: "Ciao" }] };
  const before = JSON.stringify(map);
  settings.write({ speed: 3, animate: false, cursor: false });
  assert.equal(JSON.stringify(map), before);
  assert.deepEqual(JSON.parse(data.get(settings.KEY)), { speed: 3, animate: false, cursor: false });
  assert.equal(data.has("map-1"), false);
  assert.equal(settings.read().speed, 3);
  assert.equal(settings.reset().speed, 2);
  assert.equal(data.has(settings.KEY), false);
});

test("mouse wheel follows the slider and trackpad keeps its own step", () => {
  memory();
  settings.write({ speed: 2 });
  assert.equal(settings.wheelGain("mouse"), 0.0013);
  assert.equal(settings.linkedGain("mouse"), 0.002);
  settings.write({ speed: 3 });
  assert.equal(settings.wheelGain("mouse"), 0.00195);
  assert.equal(settings.linkedGain("mouse"), 0.003);
  assert.equal(settings.wheelGain("trackpad"), 0.0013);
  assert.equal(settings.wheelGain("pinch"), 0.0013);
  assert.equal(settings.linkedGain("trackpad"), 0.002);
  assert.equal(settings.linkedGain("pinch"), 0.002);
});

test("quickSpeech defaults away from native when HD voice exists and persists selected engine and voice", () => {
  const data = memory();
  const deskRoot = { neuromapDesktop: { edgeTts: true }, document: { documentElement: { lang: "it" } } };
  const initial = settings.quickSpeech.read(deskRoot, {});
  assert.equal(initial.mode, "edge");
  assert.equal(initial.voice, "isabella");
  settings.quickSpeech.write({ mode: "edge", voice: "diego" });
  settings.quickSpeech.write({ mode: "api", voice: "nova" });
  const stored = settings.quickSpeech.read(deskRoot, { aiStudio: {} });
  assert.equal(stored.mode, "api");
  assert.equal(stored.voice, "nova");
  assert.equal(stored.voices.edge, "diego");
  assert.equal(data.get(settings.quickSpeech.MODE_KEY), "api");
});
