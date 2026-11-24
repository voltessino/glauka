/* One product identity. Legacy storage keys and native data directories stay compatible. */
(function (root) {
  "use strict";
  const svg = /* @glauka-mark */ "";
  root.GlaukaBrand = Object.freeze({ name: "Glauka", svg });
  if (typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = /* @glauka-brand-styles */ "";
  document.head.append(style);
  root.addEventListener("DOMContentLoaded", () => {
    document.title = "Glauka";
    const brand = document.querySelector(".brand-Mini");
    if (brand) {
      brand.setAttribute("aria-label", "Glauka");
      const icon = brand.querySelector(".brand-icon");
      if (icon) icon.innerHTML = svg;
    }
    document.querySelectorAll(".nm6-hero").forEach((el) => {
      el.innerHTML = svg;
      el.setAttribute("aria-hidden", "true");
    });
  });
})(globalThis);
