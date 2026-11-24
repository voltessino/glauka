/* Screen-only refinements. Transient previews never enter the saved project. */
(function (root) {
  "use strict";
  const KEY = "neuromap.map-refinements.v1";
/* @neuromap-map-refinements-helpers */
  function install(App, Renderer, Layout) {
    if (App.prototype._nmRefinementsInstalled) return;
    App.prototype._nmRefinementsInstalled = true;
    let prefs;
    try {
      prefs = preferences(JSON.parse(localStorage.getItem(KEY) || "null"));
    } catch {
      prefs = preferences();
    }
    const controllers = new WeakMap(),
      media = root.matchMedia?.("(prefers-reduced-motion: reduce)");
    const tr = (it, en) => (globalThis.GlaukaI18n?.pair(it,en) ?? ((document.documentElement.lang === "en" ? en : it)));
    const state = (app) => {
      let c = controllers.get(app);
      if (!c) {
        c = {
          preview: null,
          timer: null,
          guides: [],
          anchors: null,
          arrival: null,
        };
        controllers.set(app, c);
      }
      return c;
    };
/* @neuromap-map-refinements-preview */
    function drawOverlays(app, r, c) {
      const ctx = r.ctx;
      ctx.save();
      ctx.setTransform(r.dpr || 1, 0, 0, r.dpr || 1, 0, 0);
      if (
        prefs.path &&
        app.state.selectedNodeId &&
        !app.state.selectedImageId &&
        !app.state.selectedRelationshipId
      ) {
        const key = [
          app.state,
          app.state.selectedNodeId,
          app._nmDragRevision,
          app.layout._preferredViews?.get(app.state.selectedNodeId),
        ];
        if (!c.pathKey || key.some((v, i) => v !== c.pathKey[i])) {
          c.pathKey = key;
          c.path = pathIds(app.state.root, app.state.selectedNodeId);
        }
        ctx.strokeStyle = root.NeuroMapGraphics.light()
          ? "rgba(55,65,135,.65)"
          : "rgba(182,170,255,.7)";
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        if (c.worldPathLayout !== r.layout || c.worldPathKey !== c.pathKey) {
          c.worldPathLayout = r.layout;
          c.worldPathKey = c.pathKey;
          c.worldPath = [];
          let child = r.layout.getLayout(c.path.at(-1));
          for (let i = c.path.length - 2; i >= 0 && child; i--) {
            let parent = r.layout.getLayout(c.path[i]);
            if (r.layout.presentationRoot && i > 0) {
              const rootMetric = r.layout.getLayout(app.state.root.id),
                side = child.x < rootMetric.x ? "left" : "right";
              let nearest = Infinity;
              for (const [id, view] of r.layout.viewNodes || []) {
                if (view.logicalId !== c.path[i] || view.side !== side)
                  continue;
                const m = r.layout.getLayout(id);
                if (m && Math.abs(m.y - child.y) < nearest) {
                  parent = m;
                  nearest = Math.abs(m.y - child.y);
                }
              }
            }
            if (!parent) break;
            const left = child.x < parent.x;
            const start = {
              x:
                i === 0
                  ? parent.x + (left ? -1 : 1) * parent.width * 0.36
                  : (parent.attachOutX ?? parent.x),
              y: i === 0 ? parent.y : (parent.attachOutY ?? parent.y),
            };
            const end = {
              x: child.attachInX ?? child.x,
              y: child.attachInY ?? child.y,
            };
            c.worldPath.push({ start, end, parent, child });
            child = parent;
          }
        }
        for (const segment of c.worldPath) {
          const { start, end, parent, child } = segment,
            from = r.worldToScreen(start.x, start.y),
            to = r.worldToScreen(end.x, end.y);
          // Keep the trace outside node surfaces and text.
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, innerWidth, innerHeight);
          for (const box of [parent, child]) {
            const p = r.worldToScreen(box.x, box.y),
              z = r.camera.zoom;
            ctx.rect(
              p.x - (box.width * z) / 2 - 1,
              p.y - (box.height * z) / 2 - 1,
              box.width * z + 2,
              box.height * z + 2,
            );
          }
          ctx.clip("evenodd");
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          if (r.state.branchStyle === "radial") {
            const p = r.worldToScreen(parent.x, parent.y),
              q = r.worldToScreen(child.x, child.y);
            ctx.moveTo(p.x, p.y);
            ctx.quadraticCurveTo((p.x + q.x) / 2, (p.y + q.y) / 2, q.x, q.y);
          } else {
            const dir = end.x >= start.x ? 1 : -1,
              dx = Math.abs(end.x - start.x),
              a = r.worldToScreen(
                start.x + dir * Math.max(24, dx * 0.45),
                start.y,
              ),
              b = r.worldToScreen(end.x - dir * Math.max(12, dx * 0.48), end.y);
            ctx.bezierCurveTo(a.x, a.y, b.x, b.y, to.x, to.y);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
      if (c.arrival?.owner === app.state) {
        const m = r.layout.getLayout(c.arrival.id);
        if (m) {
          const p = r.worldToScreen(m.x, m.y),
            z = r.camera.zoom;
          ctx.strokeStyle = root.NeuroMapGraphics.light()
            ? "#6351ab"
            : "#b9a8ff";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(
            p.x - (m.width * z) / 2 - 6,
            p.y - (m.height * z) / 2 - 6,
            m.width * z + 12,
            m.height * z + 12,
          );
          ctx.setLineDash([]);
        }
      }
      if (prefs.guides && c.guides.length) {
        ctx.strokeStyle = root.NeuroMapGraphics.light() ? "#6952ae" : "#c0a8ff";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        for (const line of c.guides) {
          ctx.beginPath();
          const p = r.worldToScreen(
            line.axis === "x" ? line.value : 0,
            line.axis === "y" ? line.value : 0,
          );
          if (line.axis === "x") {
            ctx.moveTo(p.x, 0);
            ctx.lineTo(p.x, innerHeight);
          } else {
            ctx.moveTo(0, p.y);
            ctx.lineTo(innerWidth, p.y);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    function mount(app) {
      const sidebar = document.getElementById("inspector-sidebar");
      if (!sidebar || document.getElementById("nm-map-refinements")) return;
      const style = document.createElement("style");
      style.textContent = /* @neuromap-refinement-styles */ "";
      document.head.append(style);
      const section = document.createElement("section");
      section.id = "nm-map-refinements";
      section.className = "nm-refinements nm6-skiptranslate";
      const title = document.createElement("h3");
      section.append(title);
      const labels = [];
      const row = (control, it, en) => {
        const label = document.createElement("label"),
          text = document.createElement("span");
        labels.push([text, it, en]);
        label.append(text, control);
        section.append(label);
        return label;
      };
      const pattern = document.createElement("select");
      pattern.id = "nm-background-pattern";
      for (const [id, it, en] of [
        ["none", "Pulito", "Plain"],
        ["dots", "Puntini", "Dots"],
        ["grid", "Griglia fine", "Fine grid"],
      ]) {
        const opt = document.createElement("option");
        opt.value = id;
        labels.push([opt, it, en]);
        pattern.append(opt);
      }
      pattern.value = prefs.pattern;
      pattern.addEventListener("change", () => {
        set({ pattern: pattern.value });
        intensity.disabled = pattern.value === "none";
      });
      row(pattern, "Trama di lavoro", "Workspace texture");
      const intensity = document.createElement("input");
      intensity.id = "nm-pattern-intensity";
      intensity.type = "range";
      intensity.min = 0;
      intensity.max = 30;
      intensity.value = prefs.intensity;
      intensity.disabled = prefs.pattern === "none";
      const output = document.createElement("output");
      output.setAttribute("for", intensity.id);
      output.textContent = prefs.intensity + "%";
      intensity.addEventListener("input", () => {
        set({ intensity: Number(intensity.value) });
        output.textContent = intensity.value + "%";
      });
      const limit = row(intensity, "Intensità (0–30%)", "Intensity (0–30%)");
      limit.append(output);
      const note = document.createElement("p");
      labels.push([
        note,
        "Solo sullo schermo. Le esportazioni restano pulite.",
        "On screen only. Exports stay plain.",
      ]);
      section.append(note);
      const translate = () => {
        title.textContent = tr(
          "Trama",
          "Texture",
        );
        for (const [el, it, en] of labels) el.textContent = tr(it, en);
      };
      new MutationObserver(translate).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
      });
      translate();
      const canvas=document.getElementById("gl-format-map-canvas");
      const mobile=sidebar.querySelector(".glauka-map-background");
      if(globalThis.GlaukaMobile)(mobile||sidebar).append(section);
      else if(canvas)canvas.append(section);
      else sidebar.append(section);
    }
    root.NeuroMapRefinements = {
      get: () => ({ ...prefs }),
      set,
      preview,
      cancelPreview,
      inspect: (app) => {
        const c = state(app);
        return {
          preview: !!c.preview,
          guideCount: c.guides.length,
          path: [...(c.path || [])],
          arriving: !!c.arrival,
        };
      },
      alignment,
      pathIds,
      preferences,
    };
  }
  root.NeuroMapRefinementsInstall = {
    install,
    preferences,
    alignment,
    pathIds,
  };
})(globalThis);
