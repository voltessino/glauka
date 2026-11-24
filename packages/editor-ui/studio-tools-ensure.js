/* Load Studio wiki / knowledge / dashboard UI only when those sections open. */
(function (root) {
  "use strict";
  let pending = null;
  function url() {
    if (typeof root.NeuroMapStudioToolsUrl === "string" && root.NeuroMapStudioToolsUrl)
      return root.NeuroMapStudioToolsUrl;
    return root.GlaukaMobile ? "/assets/studio-tools.js" : "/studio/studio-tools.js";
  }
  function ready() {
    return !!(root.NeuroMapWikiUI && root.NeuroMapKnowledgeDBUI && root.NeuroMapDashboardUI82);
  }
  function ensure() {
    if (ready()) return Promise.resolve(true);
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
      const fail = () =>
        reject(
          Error(
            root.GlaukaI18n?.pair?.(
              "Impossibile caricare gli strumenti Studio.",
              "Could not load Studio tools.",
            ) || "Could not load Studio tools.",
          ),
        );
      const done = () => {
        if (!ready()) {
          fail();
          return;
        }
        resolve(true);
      };
      const existing = document.querySelector("script[data-neuromap-studio-tools]");
      if (existing) {
        if (ready()) {
          done();
          return;
        }
        existing.addEventListener("load", done, { once: true });
        existing.addEventListener("error", fail, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = url();
      script.async = true;
      script.dataset.neuromapStudioTools = "1";
      script.addEventListener("load", done, { once: true });
      script.addEventListener("error", fail, { once: true });
      document.head.append(script);
    }).catch((error) => {
      pending = null;
      throw error;
    });
    return pending;
  }
  root.NeuroMapStudioToolsEnsure = Object.freeze({ ensure });
})(globalThis);
