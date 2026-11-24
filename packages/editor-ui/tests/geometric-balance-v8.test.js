const composeStateSource=require('./helpers/compose-state-source.cjs');
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(
  path.join(__dirname, "../../../apps/desktop-shared/editor/layout.js"),
  "utf8",
);
const start = source.indexOf("      computeGeometryBalancedSplit(root) {");
const end = source.indexOf("      computeDynamicClockwiseSplit(root", start);
assert.ok(start >= 0 && end > start, "balanced algorithm exists");
const method = source.slice(start, end);
const Layout = new Function(
  "return class TestLayout {" +
    "constructor(){this.primaryGroupGap=38;this.lastSplitIndex=0}" +
    "computeSubtreeHeight(node){return node.height}" +
    "propagateSubtreeSide(node,side){node.side=side}" +
    method +
    "}",
)();

test("geometric balance gives distinct interleaved sides for equal-sized branches", () => {
  const engine = new Layout();
  const root = {
    children: Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      height: 60,
    })),
  };
  const result = engine.computeGeometryBalancedSplit(root);
  assert.deepEqual(
    root.children.map((n) => n.side),
    ["right", "left", "right", "left", "right", "left"],
  );
  assert.equal(result.rightCount, 3);
  assert.equal(result.leftCount, 3);
  assert.equal(result.H_R, result.H_L);
});
test("balanced layout respects pinned side and accounts for all regular branches", () => {
  const engine = new Layout();
  for (let seed = 1; seed <= 1000; seed++) {
    let value = seed;
    const random = () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
    const children = Array.from(
      { length: 1 + Math.floor(random() * 35) },
      (_, i) => ({
        id: "n" + i,
        height: 20 + Math.floor(random() * 170),
        sidePinned: i % 19 === 0 ? "left" : i % 23 === 0 ? "right" : undefined,
      }),
    );
    const root = { children },
      result = engine.computeGeometryBalancedSplit(root);
    const all = new Set([...result.rightIds, ...result.leftIds]);
    assert.equal(all.size, children.length);
    assert.equal(result.totalPrimary, children.length);
    assert.equal(result.rightCount + result.leftCount, children.length);
    assert.equal(
      result.H_R,
      children
        .filter((n) => n.side === "right")
        .reduce((sum, n) => sum + n.height, 0) +
        Math.max(0, result.rightCount - 1) * engine.primaryGroupGap,
    );
    assert.equal(
      result.H_L,
      children
        .filter((n) => n.side === "left")
        .reduce((sum, n) => sum + n.height, 0) +
        Math.max(0, result.leftCount - 1) * engine.primaryGroupGap,
    );
    for (const node of children)
      if (node.sidePinned) assert.equal(node.side, node.sidePinned);
  }
});
test("legacy balanced projects stay on the historical algorithm unless explicitly upgraded", () => {
  assert.match(
    source,
    /root\.layoutMode==='balanced'&&root\.layoutBalanceMode==='geometry'/,
  );
  const state = fs.readFileSync(
    path.join(__dirname, "../../../apps/desktop-shared/editor/state.js"),
    "utf8",
  );
  assert.match(
    state,
    /layoutBalanceMode: node\.layoutBalanceMode==='geometry'\?'geometry':undefined/,
  );
});
