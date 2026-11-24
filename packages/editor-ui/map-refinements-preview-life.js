    function cancelPreview(app) {
      const c = state(app);
      clearTimeout(c.timer);
      c.timer = null;
      if (c.preview) {
        c.preview = null;
        c.worldPathLayout = null;
        c.worldPathKey = null;
        c.worldPath = null;
        app.requestRender();
      }
      document
        .querySelectorAll(".nm-map-card[data-nm-preview]")
        .forEach((b) => delete b.dataset.nmPreview);
    }
    function stopArrival(app) {
      const c = state(app);
      clearTimeout(c.arrivalTimer);
      if (c.arrival) {
        c.arrival = null;
        app.requestRender();
      }
    }
    function clearGuides(app) {
      const c = state(app);
      c.anchors = null;
      if (c.guides.length) {
        c.guides = [];
        app.requestRender();
      }
    }
    function releasePath(app) {
      const c = state(app);
      c.pathKey = null;
      c.path = [];
      c.worldPathLayout = null;
      c.worldPathKey = null;
      c.worldPath = [];
    }
    function set(value) {
      prefs = preferences({ ...prefs, ...value });
      try {
        localStorage.setItem(KEY, JSON.stringify(prefs));
      } catch {}
      const app = root.neuroMapApp;
      if (app) {
        if (!prefs.guides) clearGuides(app);
        if (!prefs.path) releasePath(app);
        if (!prefs.travel) app.stopTeleport?.();
        app.requestRender();
      }
    }
