/* Shared settings panels: explicit scope, per-property transactions and reviewed defaults. */
(function (root) {
  "use strict";
  const { tr, button, locale } = root.NeuroMapCreativeModules.ui;
  const { specs, clean, load, write, rootSpec, KEY } =
    root.NeuroMapCreativeModules.formatting;
  function label(el, it, en) {
    el.dataset.it = it;
    el.dataset.en = en;
    el.textContent = tr(it, en);
    return el;
  }
  function note(it, en) {
    return label(document.createElement("small"), it, en);
  }
  const layoutIDs = new Set([
    "layout",
    "balance",
    "vertical",
    "gap",
    "wrap",
    "continuation",
  ]);
  // These fields are read directly by Canvas/SVG and never enter text measurement.
  const paintOnlyNodeFields = new Set(["color", "fontColor", "fontStrike", "fontUnderline"]);
  const valuesEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* @neuromap-settings-values */
  function mount(app) {
    const sidebar = document.getElementById("inspector-sidebar"),
      hud = document.querySelector(".hud-bottom-left");
    if (!sidebar || !hud || app.nmSettings) return;
    const style = document.createElement("style");
    style.textContent = /* @neuromap-formatting-styles */ "";
/* @neuromap-creative-settings-mount-body */
  }
/* @neuromap-creative-settings-organize */
  root.NeuroMapCreativeModules.settings = { mount };
})(globalThis);
