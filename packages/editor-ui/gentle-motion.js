/* Transient presentation only: no tree mutations, snapshots, textures or idle loop. */
(function (root) {
  "use strict";
  const KEY = "neuromap.motion.v1",
    DURATION = 360,
    MAX_ACTIVE = 8,
    FOLD_EXPAND = 220,
    FOLD_COLLAPSE = 150,
    FOLD_MAX = 64;
  function preferences(value) {
    return {
      branches: value?.branches !== false,
      interface: value?.interface !== false,
      duration: Number.isFinite(value?.duration)
        ? Math.max(120, Math.min(1000, Math.round(value.duration / 20) * 20))
        : DURATION,
    };
  }
  function progress(start, now, duration = DURATION) {
    return Math.max(0, Math.min(1, (now - start) / duration));
  }
  const ease = (t) => t * t * (3 - 2 * t);
  function install(App, Renderer) {
    if (App.prototype._nmGentleMotionInstalled) return;
    App.prototype._nmGentleMotionInstalled = true;
    const style = document.createElement("style");
    style.id = "nm-gentle-motion-style";
    style.textContent = /* @neuromap-motion-styles */ "";
    document.head.append(style);
    let settings;
    try {
      settings = preferences(JSON.parse(localStorage.getItem(KEY) || "null"));
    } catch {
      settings = preferences();
    }
    const reduced = root.matchMedia?.("(prefers-reduced-motion: reduce)");
    const controllers = new WeakMap();
    const allowed = () => !reduced?.matches && !document.hidden;
    function controller(app) {
      let c = controllers.get(app);
      if (!c) {
        c = { entries: new Map(), fold: new Map(), foldGhosts: null, frames: 0, slowFrames: 0 };
        controllers.set(app, c);
        app.renderer._nmMotion = c;
      }
      return c;
    }
    function clear(app) {
      const c = app && controllers.get(app);
      c?.editorAnimation?.cancel();
      if (c) c.editorAnimation = null;
      if (c?.entries.size || c?.fold?.size || c?.foldGhosts) {
        c.entries.clear();
        c.fold?.clear();
        c.foldGhosts = null;
        app.requestRender();
      }
    }
    function cancelFold(app) {
      const c = app && controllers.get(app);
      if (!c || (!c.fold?.size && !c.foldGhosts)) return;
      c.fold?.clear();
      c.foldGhosts = null;
      app.requestRender?.();
    }
    function countVisible(node) {
      let n = 0;
      const stack = [...(node?.children || [])];
      while (stack.length) {
        const current = stack.pop();
        if (!current || current.isSummary) continue;
        n += 1;
        if (n > FOLD_MAX) return n;
        if (!current.collapsed)
          for (let i = (current.children || []).length - 1; i >= 0; i--)
            stack.push(current.children[i]);
      }
      return n;
    }
    function collectFoldIds(node, out) {
      for (const child of node?.children || []) {
        if (!child || child.isSummary || out.length >= FOLD_MAX) return;
        out.push(child.logicalId || child.id);
        if (!child.collapsed) collectFoldIds(child, out);
      }
    }
    function snapshotFold(node, layout, out) {
      for (const child of node?.children || []) {
        if (!child || child.isSummary || out.length >= FOLD_MAX) return;
        const m = layout.getLayout?.(child.id);
        if (m)
          out.push({
            x: m.x,
            y: m.y,
            w: m.width,
            h: m.height,
            text: String(child.text || "").slice(0, 80),
            color: child.color || "#94a3b8",
            side: child.side,
          });
        if (!child.collapsed) snapshotFold(child, layout, out);
      }
    }
    function runFold(app, state, original, nodeId) {
      const node = state.findNode?.(nodeId);
      const wasCollapsed = !!node?.collapsed;
      const heavy = !!(node && countVisible(node) > FOLD_MAX);
      const ghosts = [];
      if (node && !heavy && !wasCollapsed && app.layout?.getLayout)
        snapshotFold(node, app.layout, ghosts);
      const ok = original.call(state, nodeId);
      if (!ok) return ok;
      if (heavy || !settings.branches || !allowed()) {
        cancelFold(app);
        return ok;
      }
      const c = controller(app);
      c.fold.clear();
      c.foldGhosts = null;
      c.slowFrames = 0;
      if (wasCollapsed) {
        const ids = [];
        collectFoldIds(node, ids);
        const now = performance.now();
        for (const id of ids) c.fold.set(id, now);
      } else if (ghosts.length) {
        c.foldGhosts = { parentId: node.id, start: performance.now(), items: ghosts };
      }
      app._nmFoldLayoutPass = true;
      return ok;
    }
    function armState(app) {
      const state = app?.state;
      if (!state || state._nmFoldArmed || typeof state.toggleCollapse !== "function") return;
      state._nmFoldArmed = true;
      const original = state.toggleCollapse;
      state.toggleCollapse = function (nodeId) {
        return runFold(app, state, original, nodeId);
      };
    }
    function paintGhosts(renderer, node) {
      const pack = renderer._nmMotion?.foldGhosts;
      if (!pack || !node || renderer._nmMotionExport) return;
      if (pack.parentId !== node.id && pack.parentId !== (node.logicalId || node.id)) return;
      const ctx = renderer.ctx;
      if (!ctx?.save) return;
      const alpha = 1 - ease(progress(pack.start, performance.now(), FOLD_COLLAPSE));
      if (alpha <= 0.02) return;
      ctx.save();
      ctx.globalAlpha *= alpha;
      for (const item of pack.items) {
        ctx.beginPath();
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 1.25;
        ctx.strokeRect(item.x - item.w / 2, item.y - item.h / 2, item.w, item.h);
        ctx.fillStyle = item.color;
        ctx.font = "500 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(item.text, item.x, item.y);
      }
      ctx.restore();
    }
    function paintFold(renderer, original, args, node) {
      const id = node?.logicalId || node?.id;
      const foldStart = renderer._nmMotion?.fold?.get(id);
      const ctx = renderer.ctx;
      if (foldStart === undefined || !ctx?.save) {
        const result = original.apply(renderer, args);
        paintGhosts(renderer, node);
        return result;
      }
      const p = ease(progress(foldStart, performance.now(), FOLD_EXPAND));
      ctx.save();
      ctx.globalAlpha *= p;
      ctx.translate((node.side === "left" ? 1 : -1) * 10 * (1 - p), 0);
      try {
        return original.apply(renderer, args);
      } finally {
        ctx.restore();
        paintGhosts(renderer, node);
      }
    }
    function update() {
      document.body.dataset.nmMotion =
        settings.interface && allowed() ? "gentle" : "off";
      document.body.style?.setProperty(
        "--nm-motion-duration",
        Math.min(settings.duration, 320) + "ms",
      );
      if (!settings.branches || !allowed()) clear(root.neuroMapApp);
      const slider = document.getElementById("nm-motion-duration");
      if (slider) {
        slider.value = settings.duration;
        slider.disabled = !settings.branches;
      }
      const output = document.getElementById("nm-motion-duration-value");
      if (output) output.textContent = settings.duration + " ms";
      document
        .querySelectorAll("[data-nm-motion-setting]")
        .forEach((el) => (el.checked = settings[el.dataset.nmMotionSetting]));
    }
    function set(value) {
      settings = preferences({ ...settings, ...value });
      try {
        localStorage.setItem(KEY, JSON.stringify(settings));
      } catch {}
      clear(root.neuroMapApp);
      update();
    }
    function play(app, id) {
      if (!app || !id || !settings.branches || !allowed()) return;
      const c = controller(app);
      while (c.entries.size >= MAX_ACTIVE)
        c.entries.delete(c.entries.keys().next().value);
      c.slowFrames = 0;
      c.entries.set(id, performance.now());
      // Creation immediately opens the text editor over the canvas label.
      // Animate that existing surface too, otherwise it hides the entrance.
      const editor = document.getElementById("inline-editor-container");
      if (editor?.animate && app.editorNodeId === id) {
        c.editorAnimation?.cancel();
        const animation = editor.animate(
          [
            {
              opacity: 0.15,
              transform:
                "translateX(" +
                (app.state.findNode?.(id)?.side === "left" ? 12 : -12) +
                "px)",
            },
            { opacity: 1, transform: "translateX(0)" },
          ],
          { duration: settings.duration, easing: "cubic-bezier(.4,0,.2,1)" },
        );
        c.editorAnimation = animation;
        animation.onfinish = () => {
          if (c.editorAnimation === animation) c.editorAnimation = null;
        };
      }
      app.requestRender();
    }
    const bind = App.prototype.bindUI;
    App.prototype.bindUI = function (...args) {
      const result = bind.apply(this, args);
      controller(this);
      armState(this);
      update();
      const sidebar = document.getElementById("inspector-sidebar");
      if (sidebar && !document.getElementById("nm-motion-settings")) {
        const section = document.createElement("section");
        section.id = "nm-motion-settings";
        section.className = "nm-motion-settings nm6-skiptranslate";
        const title = document.createElement("h3");
        section.append(title);
        const labels = [];
        for (const key of ["branches", "interface"]) {
          const label = document.createElement("label"),
            input = document.createElement("input"),
            text = document.createElement("span");
          input.type = "checkbox";
          input.dataset.nmMotionSetting = key;
          input.checked = settings[key];
          input.addEventListener("change", () => set({ [key]: input.checked }));
          label.append(input, text);
          section.append(label);
          labels.push(text);
        }
        const durationLabel = document.createElement("label"),
          caption = document.createElement("span"),
          duration = document.createElement("input"),
          output = document.createElement("output");
        durationLabel.className = "nm-motion-duration-row";
        duration.id = "nm-motion-duration";
        duration.type = "range";
        duration.min = 120;
        duration.max = 1000;
        duration.step = 20;
        output.id = "nm-motion-duration-value";
        durationLabel.append(caption, output, duration);
        duration.addEventListener("input", () =>
          set({ duration: Number(duration.value) }),
        );
        section.append(durationLabel);
        const hint = document.createElement("p");
        section.append(hint);
        const host=document.getElementById("gl-appearance-park")||(()=>{
          if(!root.NeuroMapSettingsCenter)return sidebar;
          const park=document.createElement("div");
          park.id="gl-appearance-park";
          park.hidden=true;
          document.body.append(park);
          return park;
        })();
        host.append(section);
        const translate = () => {
          const en = document.documentElement.lang === "en";
          title.textContent = (globalThis.GlaukaI18n?.pair("Animazioni","Animations")??(en ? "Animations" : "Animazioni"));
          labels[0].textContent = (globalThis.GlaukaI18n?.pair("Comparsa delicata dei nuovi rami","New branches appear gently")??(en
            ? "New branches appear gently"
            : "Comparsa delicata dei nuovi rami"));
          labels[1].textContent = (globalThis.GlaukaI18n?.pair("Pannelli e riscontro sui pulsanti","Panels and button feedback")??(en
            ? "Panels and button feedback"
            : "Pannelli e riscontro sui pulsanti"));
          caption.textContent = (globalThis.GlaukaI18n?.pair("Durata della comparsa","Branch animation duration")??(en
            ? "Branch animation duration"
            : "Durata della comparsa"));
          duration.setAttribute("aria-label", caption.textContent);
          hint.textContent = (globalThis.GlaukaI18n?.pair("I nuovi rami compaiono con una dissolvenza e un movimento morbido. La durata si applica alla loro creazione. La riduzione del movimento di sistema ha la precedenza.","New branches appear with a smooth fade and slide when you create them. System reduced motion takes priority.")??(en
            ? "New branches appear with a smooth fade and slide when you create them. System reduced motion takes priority."
            : "I nuovi rami compaiono con una dissolvenza e un movimento morbido. La durata si applica alla loro creazione. La riduzione del movimento di sistema ha la precedenza."));
        };
        new MutationObserver(translate).observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["lang"],
        });
        translate();
        update();
      }
      return result;
    };
    for (const name of ["addChild", "addSibling"]) {
      const original = App.prototype[name];
      if (!original) continue;
      App.prototype[name] = function (...args) {
        const before = this.state.selectedNodeId,
          result = original.apply(this, args),
          id = this.state.selectedNodeId;
        if (settings.branches && allowed() && id && id !== before) {
          play(this, id);
        }
        return result;
      };
    }
    for (const name of ["undo", "redo", "activateTab", "importHierarchy"]) {
      const original = App.prototype[name];
      if (original)
        App.prototype[name] = function (...args) {
          clear(this);
          const result = original.apply(this, args);
          if (name === "activateTab") armState(this);
          return result;
        };
    }
    const render = Renderer.prototype.render;
    Renderer.prototype.render = function (ctx, ...args) {
      const previous = this._nmMotionExport;
      this._nmMotionExport = !!ctx;
      const c = this._nmMotion;
      if (ctx && c && (c.fold?.size || c.foldGhosts)) {
        c.fold.clear();
        c.foldGhosts = null;
      }
      const active = !ctx && (c?.entries.size || c?.fold?.size || c?.foldGhosts),
        started = active ? performance.now() : 0;
      if (active) {
        for (const [id, start] of c.entries)
          if (
            !allowed() ||
            !settings.branches ||
            progress(start, started, settings.duration) >= 1
          )
            c.entries.delete(id);
        if (c.fold)
          for (const [id, start] of c.fold)
            if (
              !allowed() ||
              !settings.branches ||
              progress(start, started, FOLD_EXPAND) >= 1
            )
              c.fold.delete(id);
        if (
          c.foldGhosts &&
          (!allowed() ||
            !settings.branches ||
            progress(c.foldGhosts.start, started, FOLD_COLLAPSE) >= 1)
        )
          c.foldGhosts = null;
      }
      try {
        return render.call(this, ctx, ...args);
      } finally {
        this._nmMotionExport = previous;
        if (active) {
          c.frames++;
          c.slowFrames =
            performance.now() - started > 40 ? c.slowFrames + 1 : 0;
          // One expensive layout frame must not erase the entire entrance.
          // Sustained slow rendering still falls back to the static final frame.
          if (c.slowFrames >= 3) {
            c.entries.clear();
            c.fold?.clear();
            c.foldGhosts = null;
            c.editorAnimation?.cancel();
            c.editorAnimation = null;
          }
          // Existing render queue owns the next frame; nothing runs once entries expire.
          root.neuroMapApp?.requestRender();
        }
      }
    };
    for (const name of ["drawNode", "drawTaperingBranch"]) {
      const original = Renderer.prototype[name];
      if (!original) continue;
      Renderer.prototype[name] = function (...args) {
        const n = args[name === "drawNode" ? 0 : 1],
          start = this._nmMotion?.entries.get(n?.logicalId || n?.id);
        if (start === undefined || this._nmMotionExport) {
          if (name !== "drawNode" || this._nmMotionExport)
            return original.apply(this, args);
          return paintFold(this, original, args, n);
        }
        const p = ease(progress(start, performance.now(), settings.duration)),
          ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha *= 0.08 + 0.92 * p;
        if (name === "drawTaperingBranch") {
          const parent = this.layout?.getLayout(args[0]?.id);
          if (parent) {
            ctx.translate(parent.x, parent.y);
            ctx.scale(0.82 + 0.18 * p, 0.82 + 0.18 * p);
            ctx.translate(-parent.x, -parent.y);
          }
        }
        if (name === "drawNode")
          ctx.translate((n.side === "left" ? 1 : -1) * 18 * (1 - p), 0);
        try {
          return original.apply(this, args);
        } finally {
          ctx.restore();
        }
      };
    }
    reduced?.addEventListener?.("change", update);
    document.addEventListener("visibilitychange", update);
    root.addEventListener?.("pagehide", () => clear(root.neuroMapApp));
    root.NeuroMapMotion = {
      get: () => ({ ...settings, reduced: !!reduced?.matches }),
      set,
      cancelFold,
      inspect: (app) => {
        const c = app && controllers.get(app);
        return {
          active: c?.entries.size || 0,
          frames: c?.frames || 0,
          maxActive: MAX_ACTIVE,
          fold: c?.fold?.size || 0,
          ghosts: c?.foldGhosts?.items.length || 0,
        };
      },
    };
  }
  root.NeuroMapGentleMotion = {
    install,
    preferences,
    progress,
    DURATION,
    MAX_ACTIVE,
    FOLD_MAX,
    FOLD_EXPAND,
    FOLD_COLLAPSE,
  };
})(globalThis);
