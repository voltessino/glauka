/* Plain text and bounded style ranges; no HTML is stored in projects. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NeuroMapCaption = api;
})(globalThis, function () {
  "use strict";
  const MAX = 2000,
    MAX_SPANS = 256;
  const colour = (value) =>
    typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
      ? value.toLowerCase()
      : null;
  const style = (value) =>
    Object.assign(
      {},
      ...["bold", "italic", "underline"]
        .filter((k) => value?.[k] === true)
        .map((k) => ({ [k]: true })),
      ...(colour(value?.color) ? [{ color: colour(value.color) }] : []),
    );
  const key = (value) => JSON.stringify(style(value));
/* @neuromap-rich-caption-core-text */
/* @neuromap-rich-caption-core-render */
/* @neuromap-rich-caption-core-bind */
  return Object.freeze({
    MAX,
    sanitize,
    edit,
    replace,
    apply,
    selectedStyle,
    marker,
    listKind,
    continueList,
    list,
    layout,
    paint,
    height,
    bindListInput,
    automaticListsEnabled,
    setAutomaticLists,
  });
});
