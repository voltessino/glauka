/* A bounded font list prevents arbitrary CSS/XML injection in saved documents. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GlaukaNodeText = api;
})(globalThis, () => {
  "use strict";
  const FONTS = Object.freeze([
    "Inter",
    "Arial",
    "Verdana",
    "Georgia",
    "Times New Roman",
    "Courier New",
  ]);
  const family = (node) =>
    FONTS.includes(node?.fontFamily) ? node.fontFamily : "Inter";
  const cssFamily = (node) =>
    family(node) === "Inter"
      ? "Inter, -apple-system, sans-serif"
      : '"' +
        family(node) +
        '", ' +
        (["Georgia", "Times New Roman"].includes(family(node))
          ? "serif"
          : family(node) === "Courier New"
            ? "monospace"
            : "sans-serif");
  const svgFamily = (node) =>
    family(node) === "Inter"
      ? "Inter, -apple-system, sans-serif"
      : family(node) +
        ", " +
        (["Georgia", "Times New Roman"].includes(family(node))
          ? "serif"
          : family(node) === "Courier New"
            ? "monospace"
            : "sans-serif");
  const color = (node) =>
    /^#[0-9a-f]{6}$/i.test(node?.fontColor || "") ? node.fontColor : null;
  return Object.freeze({ FONTS, family, cssFamily, svgFamily, color });
});
