const test = require("node:test");
const assert = require("node:assert/strict");
require("../node-links.js");
const api = globalThis.GlaukaNodeLinks;

test("web links stay web and unsafe schemes are refused", () => {
  assert.equal(api.classify("https://example.com/a").value, "https://example.com/a");
  assert.equal(api.classify("javascript:alert(1)").ok, false);
  assert.equal(api.classify("data:text/html,x").ok, false);
  assert.equal(api.classify("vbscript:run").ok, false);
  assert.equal(api.classify("notes.txt").ok, false);
});

test("a note or link icon does not change the node box", () => {
  const metrics = { x: 100, y: 80, width: 120, height: 40 };
  const plain = api.marks({ text: "Ramo", notes: "", linkUrl: "" }, metrics);
  assert.deepEqual(plain, []);
  const marked = api.marks({ text: "Ramo", notes: " Promemoria ", linkUrl: "https://example.com/m" }, metrics);
  assert.equal(marked.length, 2);
  assert.ok(marked[0].x >= metrics.x + metrics.width / 2);
  assert.ok(marked[0].y <= metrics.y - metrics.height / 2);
  assert.equal(marked[0].s, 14);
  assert.equal(marked[1].kind, "link");
});

test("programs are marked so a click can ask before opening", () => {
  const file = api.classify("C:\\mappe\\setup.exe");
  assert.equal(file.ok, true);
  assert.equal(file.executable, true);
  const page = api.classify("C:\\mappe\\appunti.txt");
  assert.equal(page.executable, false);
});
