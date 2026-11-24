/* Offline marker catalogue shared by the shelf, canvas and vector export. */
(function (root) {
  "use strict";
  const { tr, locale } = root.NeuroMapCreativeModules.ui;
/* @neuromap-creative-markers-catalog */
/* @neuromap-creative-markers-actions */
/* @neuromap-creative-markers-mount */
  root.NeuroMapMarkers = {
    symbols,
    entries,
    groups,
    fontCSS: /* @neuromap-marker-font */ "",
  };
  root.NeuroMapCreativeModules.markers = { install };
})(globalThis);
