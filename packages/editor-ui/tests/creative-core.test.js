const { test } = require("node:test");
const assert = require("node:assert/strict");
const c = require('./helpers/compose-creative-core.cjs')();
test("URLs inside labels retain query parameters and handle surrounding prose", () => {
  const url =
    "https://www.google.com/search?client=opera&q=google&sourceid=opera&ie=UTF-8&oe=UTF-8";
  assert.equal(c.url(url), url);
  assert.equal(c.url("Vedi (" + url + ")."), url);
  assert.equal(c.url("www.example.org/path"), "https://www.example.org/path");
  for (const input of [
    "javascript:alert(1)",
    "file:///tmp/x",
    "https://user:secret@example.org",
    "not a link",
  ])
    assert.equal(c.url(input), "");
});
test("shapes retain editable text and escape XML markup", () => {
  const g = c.graphic({
      kind: "shape",
      tool: "ellipse",
      width: 240,
      height: 120,
      text: '<script>&"',
      color: "#38bdf8",
    }),
    svg = c.shapeSVG(g);
  assert.ok(svg.includes("<ellipse"));
  assert.ok(svg.includes("&lt;script&gt;&amp;&quot;"));
  assert.ok(!svg.includes("<script>"));
  const clone = JSON.parse(JSON.stringify(g));
  assert.deepEqual(clone, g);
});
test("invalid graphic geometry and excessive strokes have finite bounded values", () => {
  const g = c.graphic({
    kind: "shape",
    width: Infinity,
    stroke: 999,
    points: [
      [NaN, Infinity],
      [-Infinity, "bad"],
    ],
  });
  assert.equal(g.stroke, 40);
  assert.ok(Number.isFinite(g.width));
  assert.deepEqual(g.points, [
    [0, 0],
    [0, 0],
  ]);
  assert.equal(c.graphic({ kind: "unknown" }), null);
});

test("18 native SVG shapes retain geometry and can be saved and reopened",()=>{
 const types=[
  "rect","roundrect","ellipse","circle","diamond","triangle","hexagon",
  "parallelogram","pill","cloud","speech","star","line","arrow",
  "double-arrow","dashed","curve","elbow"
 ];
 const outputs=[];
 for(const tool of types){
  const meta=c.graphic({kind:"shape",tool,width:160,height:96,color:"#a5b4fc",stroke:3});
  assert.equal(meta.tool,tool,"unrecognized SVG tool "+tool);
  const svg=c.shapeSVG(meta);
  assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.doesNotMatch(svg,/<script|onload=|href=/i);
  assert.ok(svg.includes('stroke="#a5b4fc"')||svg.includes('fill="#a5b4fc"'));
  const saved=JSON.parse(JSON.stringify(meta));
  assert.equal(c.graphic(saved).tool,tool);
  outputs.push(svg);
 }
 assert.equal(new Set(outputs).size,types.length,"shape previews must have distinct geometry");
 assert.match(c.shapeSVG({kind:"shape",tool:"double-arrow"}),/polygon[^>]*polygon|<polygon/g);
 assert.match(c.shapeSVG({kind:"shape",tool:"dashed"}),/stroke-dasharray/);
 assert.match(c.shapeSVG({kind:"shape",tool:"curve"}),/ Q /);
});
