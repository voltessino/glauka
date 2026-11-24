/* Load OCR engines only when the user opens scan reading. */
(function (root) {
  "use strict";
  let pending = null;
  function url() {
    if (typeof root.NeuroMapOcrToolsUrl === "string" && root.NeuroMapOcrToolsUrl)
      return root.NeuroMapOcrToolsUrl;
    return root.GlaukaMobile ? "/assets/ocr-tools.js" : "/ocr/ocr-tools.js";
  }
  function ensure() {
    if (root.NeuroMapOCR && root.NeuroMapOCRUI) return Promise.resolve(root.NeuroMapOCRUI);
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
      const fail = () =>
        reject(
          Error(
            root.GlaukaI18n?.pair?.(
              "Impossibile caricare il lettore delle scansioni.",
              "Could not load the scan reader.",
            ) || "Could not load the scan reader.",
          ),
        );
      const ready = () => {
        if (!root.NeuroMapOCR || !root.NeuroMapOCRUI) {
          fail();
          return;
        }
        resolve(root.NeuroMapOCRUI);
      };
      const existing = document.querySelector("script[data-neuromap-ocr-tools]");
      if (existing) {
        if (root.NeuroMapOCR && root.NeuroMapOCRUI) {
          ready();
          return;
        }
        existing.addEventListener("load", ready, { once: true });
        existing.addEventListener("error", fail, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = url();
      script.async = true;
      script.dataset.neuromapOcrTools = "1";
      script.addEventListener("load", ready, { once: true });
      script.addEventListener("error", fail, { once: true });
      document.head.append(script);
    }).catch((error) => {
      pending = null;
      throw error;
    });
    return pending;
  }
  async function open(app) {
    const ui = await ensure();
    ui.mount(app || root.neuroMapApp);
    (app || root.neuroMapApp)?._nmOCR?.open?.();
  }
  root.NeuroMapOCREnsure = Object.freeze({ ensure, open });
})(globalThis);
