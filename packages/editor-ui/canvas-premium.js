/* Presentation-only canvas chrome. Nothing here is saved, undone or written onto nodes. */
(function (root) {
  "use strict";
  const TOKEN = {
    focus: "--gv-canvas-focus",
    focusHalo: "--gv-canvas-focus-halo",
    hover: "--gv-canvas-hover",
    dropValid: "--gv-canvas-drop-valid",
    dropInvalid: "--gv-canvas-drop-invalid",
    badgeSurface: "--gv-canvas-badge-surface",
    badgeText: "--gv-canvas-badge-text",
  };
  const FALLBACK = {
    focus: "#6441df",
    focusHalo: "rgba(100,65,223,0.40)",
    hover: "rgba(100,65,223,0.24)",
    dropValid: "#1c8f62",
    dropInvalid: "#ad2039",
    badgeSurface: "#1e293b",
    badgeText: "#f8fafc",
    separator: "rgba(255,255,255,0.92)",
  };
  let cache = null;
  let cacheKey = "";
  let pumpId = 0;

  function reduced() {
    try {
      return !!root.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    } catch {
      return false;
    }
  }
  function skinKey() {
    const body = root.document?.body;
    if (!body) return "none";
    const data = body.dataset || {};
    return [data.nmSkin, data.nmSkinContrast, data.nmOrbitAccent, root.document.documentElement?.dataset?.nmTheme].join("|");
  }
  function usable(value, fallback) {
    if (!value || /var\(|color-mix|unset|initial/.test(value)) return fallback;
    return value;
  }
  function probe(name, fallback) {
    const doc = root.document;
    const body = doc?.body;
    if (!body || typeof doc.createElement !== "function" || typeof root.getComputedStyle !== "function")
      return fallback;
    const el = doc.createElement("span");
    el.style.cssText = "position:absolute;left:-9999px;background-color:var(" + name + "," + fallback + ")";
    body.append(el);
    let resolved = "";
    try {
      resolved = root.getComputedStyle(el).backgroundColor || "";
    } catch {
      resolved = "";
    }
    el.remove?.();
    if (!resolved || resolved === "rgba(0, 0, 0, 0)" || resolved === "transparent") return fallback;
    return usable(resolved, fallback);
  }
  function colors() {
    const key = skinKey() + (reduced() ? "|reduce" : "");
    if (cache && cacheKey === key) return cache;
    const light = !!root.NeuroMapGraphics?.light?.();
    cache = {
      focus: probe(TOKEN.focus, FALLBACK.focus),
      focusHalo: probe(TOKEN.focusHalo, FALLBACK.focusHalo),
      hover: probe(TOKEN.hover, FALLBACK.hover),
      dropValid: probe(TOKEN.dropValid, FALLBACK.dropValid),
      dropInvalid: probe(TOKEN.dropInvalid, FALLBACK.dropInvalid),
      badgeSurface: probe(TOKEN.badgeSurface, FALLBACK.badgeSurface),
      badgeText: probe(TOKEN.badgeText, light ? "#152139" : FALLBACK.badgeText),
      separator: light ? "rgba(15,23,42,0.88)" : FALLBACK.separator,
    };
    cacheKey = key;
    return cache;
  }
  function invalidatePalette() {
    cache = null;
    cacheKey = "";
  }
  function badgeLabel(count, collapsed) {
    void count;
    return collapsed ? "+" : "−";
  }
  function badgeBox(node, m, state) {
    const label = badgeLabel(node.children.length, !!node.collapsed);
    const rx = label.length > 2 ? 16 : label.length > 1 ? 13 : 10;
    const ry = 10;
    const dir = state?.branchStyle === "radial" ? (m.x >= 0 ? 1 : -1) : node.side === "right" ? 1 : -1;
    return {
      cx: m.x + dir * (m.width / 2 + rx + 4),
      cy: m.y + m.height / 2 - 2,
      rx,
      ry,
      label,
    };
  }
  function ease(t) {
    return t * t * (3 - 2 * t);
  }
  function amount(renderer, key, active) {
    if (reduced() || typeof performance === "undefined") return active ? 1 : 0;
    const slot = renderer._nmChrome || (renderer._nmChrome = {});
    const now = performance.now();
    let cur = slot[key];
    if (!active && !cur) return 0;
    if (!cur || cur.active !== !!active) {
      cur = {
        active: !!active,
        from: cur ? cur.value : active ? 0.4 : 0,
        start: now,
        value: cur ? cur.value : active ? 0.4 : 0,
      };
      slot[key] = cur;
      pump(renderer);
    }
    const dur = key === "hover" ? 120 : 160;
    const t = Math.max(0, Math.min(1, (now - cur.start) / dur));
    const target = cur.active ? 1 : 0;
    cur.value = cur.from + (target - cur.from) * ease(t);
    if (t < 1) pump(renderer);
    return cur.value;
  }
  function pump(renderer) {
    if (pumpId || typeof requestAnimationFrame !== "function") return;
    const app = root.neuroMapApp;
    pumpId = requestAnimationFrame(() => {
      pumpId = 0;
      app?.requestRender?.();
      if (renderer && renderer !== app?.renderer) renderer.requestRender?.();
    });
  }
  function traceShape(renderer, x, y, w, h, shape) {
    const ctx = renderer.ctx;
    if (shape === "hex" || shape === "circuit") {
      const cut = shape === "hex" ? Math.min(22, h * 0.36, w * 0.17) : Math.min(14, h * 0.28);
      ctx.beginPath();
      if (shape === "hex") {
        ctx.moveTo(x + cut, y);
        ctx.lineTo(x + w - cut, y);
        ctx.lineTo(x + w, y + h / 2);
        ctx.lineTo(x + w - cut, y + h);
        ctx.lineTo(x + cut, y + h);
        ctx.lineTo(x, y + h / 2);
      } else {
        ctx.moveTo(x + cut, y);
        ctx.lineTo(x + w - cut, y);
        ctx.lineTo(x + w, y + cut);
        ctx.lineTo(x + w, y + h - cut);
        ctx.lineTo(x + w - cut, y + h);
        ctx.lineTo(x + cut, y + h);
        ctx.lineTo(x, y + h - cut);
        ctx.lineTo(x, y + cut);
      }
      ctx.closePath();
      return;
    }
    const radius = shape === "pill" ? h / 2 : shape === "card" ? 7 : shape === "outline" ? 4 : shape === "glass" ? 18 : 11;
    if (typeof renderer.roundRectPath === "function") renderer.roundRectPath(x, y, w, h, radius);
    else ctx.rect?.(x, y, w, h);
  }
  function zoomWidth(renderer, px) {
    return px / Math.max(0.5, renderer.camera?.zoom || 1);
  }
  function paintBranch(renderer, spec) {
    const ctx = renderer?.ctx;
    const { node, m, x, y, shape, plain, isSelected, isHovered } = spec || {};
    if (!ctx || !node || !m || node.side === "root") return false;
    if (renderer._nmNavExport || renderer._nmMotionExport) return false;
    const palette = colors();
    const primary = !!isSelected && renderer.state?.selectedNodeId === (spec.logicalId || node.logicalId || node.id);
    const selectedAmt = amount(renderer, "select:" + (node.id || ""), !!isSelected);
    const hoverAmt = amount(renderer, "hover:" + (node.id || ""), !!isHovered && !isSelected);
    const focused = !!renderer.canvas && root.document?.activeElement === renderer.canvas;
    ctx.save();
    try {
      if (!plain) {
        const light = !!root.NeuroMapGraphics?.light?.();
        const h = m.height - 3;
        traceShape(renderer, x, y, m.width, h, shape);
        if (isSelected) {
          const rgba = root.ColorUtils?.rgba;
          ctx.fillStyle = rgba ? rgba(node.color, 0.16) : palette.hover;
          ctx.shadowColor = palette.focusHalo;
          ctx.shadowBlur = 6 * selectedAmt;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.lineWidth = zoomWidth(renderer, 1.25);
          ctx.strokeStyle = node.color;
          ctx.stroke();
        } else if (isHovered && hoverAmt > 0.02) {
          const rgba = root.ColorUtils?.rgba;
          ctx.fillStyle = rgba ? rgba(node.color, 0.1) : palette.hover;
          ctx.shadowColor = palette.hover;
          ctx.shadowBlur = 4 * hoverAmt;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.lineWidth = zoomWidth(renderer, 1.15);
          ctx.strokeStyle = rgba ? rgba(node.color, 0.55) : palette.focus;
          ctx.globalAlpha *= hoverAmt;
          ctx.stroke();
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = shape === "glass"
            ? (root.ColorUtils?.rgba ? root.ColorUtils.rgba(node.color, light ? 0.14 : 0.18) : palette.hover)
            : shape === "outline"
              ? (light ? "rgba(249,251,255,.96)" : "rgba(9,15,29,.83)")
              : (light ? "rgba(229,234,246,.96)" : "rgba(15,23,42,.78)");
          ctx.fill();
          if (["outline", "glass", "hex", "circuit"].includes(shape)) {
            ctx.strokeStyle = root.ColorUtils?.rgba
              ? root.ColorUtils.rgba(node.color, shape === "glass" ? 0.55 : 0.78)
              : node.color;
            ctx.lineWidth = shape === "outline" ? 1.5 : 1.15;
            ctx.stroke();
          }
        }
      }
      if (plain && (isSelected || isHovered)) {
        const amt = isSelected ? selectedAmt : hoverAmt;
        if (amt > 0.02 && typeof renderer.paintPlainSelection === "function") {
          // The soft capsule around the label, as before the premium painter.
          ctx.globalAlpha *= amt;
          renderer.paintPlainSelection(x, y, m.width, m.height, !!isSelected);
        } else if (amt > 0.02) {
          ctx.beginPath();
          ctx.moveTo(x + 8, y + m.height - 2);
          ctx.lineTo(x + m.width - 8, y + m.height - 2);
          ctx.lineWidth = isSelected ? 2 : 1.25;
          ctx.strokeStyle = isSelected ? palette.focus : palette.hover;
          ctx.globalAlpha *= amt;
          ctx.shadowColor = palette.focusHalo;
          ctx.shadowBlur = isSelected ? 5 : 0;
          ctx.stroke();
          if (isSelected && focused && primary) {
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.moveTo(x + 6, y + m.height + 1);
            ctx.lineTo(x + m.width - 6, y + m.height + 1);
            ctx.lineWidth = 1;
            ctx.strokeStyle = palette.separator;
            ctx.stroke();
          }
        }
      }
      if (!plain && isSelected && selectedAmt > 0.02) {
        ctx.shadowBlur = 0;
        ctx.globalAlpha = selectedAmt * (primary ? 1 : 0.72);
        traceShape(renderer, x - 3, y - 3, m.width + 6, m.height + 2, shape);
        ctx.lineWidth = zoomWidth(renderer, 5);
        ctx.strokeStyle = palette.focusHalo;
        ctx.stroke();
        ctx.lineWidth = zoomWidth(renderer, primary ? 2 : 1.5);
        ctx.strokeStyle = palette.focus;
        ctx.stroke();
        if (focused && primary) {
          ctx.lineWidth = zoomWidth(renderer, 1);
          ctx.strokeStyle = palette.separator;
          traceShape(renderer, x - 6, y - 6, m.width + 12, m.height + 8, shape);
          ctx.stroke();
        }
      }
    } finally {
      ctx.restore();
    }
    return true;
  }
  function ellipse(ctx, box) {
    ctx.beginPath();
    if (ctx.ellipse) ctx.ellipse(box.cx, box.cy, box.rx, box.ry, 0, 0, Math.PI * 2);
    else ctx.arc(box.cx, box.cy, Math.max(box.rx, box.ry), 0, Math.PI * 2);
  }
  function paintAffordances(renderer, spec) {
    const ctx = renderer?.ctx;
    const { node, m, isDragTarget, isSnapTarget } = spec || {};
    if (!ctx || !node || !m) return false;
    const palette = colors();
    const exporting = !!(renderer._nmNavExport || renderer._nmMotionExport);
    if (!exporting && (isDragTarget || isSnapTarget)) {
      ctx.save();
      traceShape(renderer, spec.x - 6, spec.y - 6, m.width + 12, m.height + 12, "card");
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = zoomWidth(renderer, 1.75);
      ctx.strokeStyle = palette.dropValid;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    if (node.side !== "root" && node.children && node.children.length > 0) {
      const box = badgeBox(node, m, renderer.state);
      const id = spec.logicalId || node.logicalId || node.id;
      if (!renderer._nmBadgeGeom) renderer._nmBadgeGeom = new Map();
      renderer._nmBadgeGeom.set(id, box);
      ctx.save();
      ellipse(ctx, box);
      ctx.fillStyle = palette.badgeSurface;
      ctx.fill();
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = palette.focus;
      ctx.stroke();
      ctx.fillStyle = palette.badgeText;
      ctx.font = '600 11px ui-monospace, "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const glyph = typeof renderer.devicePoint === "function"
        ? renderer.devicePoint(box.cx, box.cy + 0.5)
        : { x: box.cx, y: box.cy };
      ctx.fillText(box.label, glyph.x, glyph.y);
      ctx.restore();
    }
    root.GlaukaNodeLinks?.paint?.(renderer, node, m);
    return true;
  }
  function paintRootFocus(renderer, box) {
    const ctx = renderer?.ctx;
    if (!ctx || !box || renderer._nmNavExport || renderer._nmMotionExport) return false;
    const palette = colors();
    const amt = amount(renderer, "root-focus", true);
    ctx.save();
    ctx.globalAlpha *= 0.9 * amt;
    ctx.shadowBlur = 0;
    if (typeof renderer.roundRectPath === "function")
      renderer.roundRectPath(box.x - 5, box.y - 5, box.w + 10, box.h + 10, (box.h + 10) / 2);
    ctx.lineWidth = zoomWidth(renderer, 5);
    ctx.strokeStyle = palette.focusHalo;
    ctx.stroke();
    ctx.lineWidth = zoomWidth(renderer, 2);
    ctx.strokeStyle = palette.focus;
    ctx.stroke();
    ctx.restore();
    return true;
  }
  function badgeAt(app, clientX, clientY) {
    const geom = app.renderer?._nmBadgeGeom;
    if (!geom || typeof app.renderer.screenToWorld !== "function") return null;
    const p = app.renderer.screenToWorld(clientX, clientY);
    const zoom = Math.max(0.05, app.renderer.camera?.zoom || 1);
    const slop = 12 / zoom;
    for (const [id, box] of geom) {
      const dx = (p.x - box.cx) / (box.rx + slop);
      const dy = (p.y - box.cy) / (box.ry + slop);
      if (dx * dx + dy * dy <= 1) return app.state.findNode?.(id) || null;
    }
    return null;
  }
  function install(App, Renderer) {
    if (!App || App.prototype._nmCanvasPremium) return;
    App.prototype._nmCanvasPremium = true;
    invalidatePalette();
    const body = root.document?.body;
    if (body && typeof MutationObserver === "function") {
      new MutationObserver(invalidatePalette).observe(body, {
        attributes: true,
        attributeFilter: ["data-nm-skin", "data-nm-skin-contrast", "data-nm-orbit-accent"],
      });
    }
    if (Renderer?.prototype) {
      const render = Renderer.prototype.render;
      if (render) {
        Renderer.prototype.render = function (...args) {
          this._nmBadgeGeom = new Map();
          return render.apply(this, args);
        };
      }
    }
    const find = App.prototype.findHit;
    if (find) {
      App.prototype.findHit = function (x, y) {
        const hit = find.apply(this, arguments);
        if (hit) return hit;
        const badge = badgeAt(this, x, y);
        if (badge) return { type: "badge", item: badge };
        return hit;
      };
    }
    const bind = App.prototype.bindUI;
    if (bind) {
      App.prototype.bindUI = function (...args) {
        const result = bind.apply(this, args);
        this.canvas?.addEventListener("pointerdown", (event) => {
          if (event.button !== 0 || event.altKey) return;
          const hit = this.findHit?.(event.clientX, event.clientY);
          if (hit?.type !== "badge") return;
          event.preventDefault();
          event.stopImmediatePropagation();
          const id = hit.item?.logicalId || hit.item?.id;
          if (id && this.state.toggleCollapse?.(id)) this.markChanged?.();
        }, true);
        return result;
      };
    }
    const recalc = App.prototype.recalculateAndRender;
    if (recalc) {
      App.prototype.recalculateAndRender = function (...args) {
        const pass = this._nmFoldLayoutPass;
        this._nmFoldLayoutPass = false;
        if (!pass) root.NeuroMapMotion?.cancelFold?.(this);
        return recalc.apply(this, args);
      };
    }
    const visual = App.prototype.v5DragVisual;
    if (visual) {
      App.prototype.v5DragVisual = function (...args) {
        root.NeuroMapMotion?.cancelFold?.(this);
        return visual.apply(this, args);
      };
    }
  }
  root.NeuroMapCanvasPremium = {
    install,
    colors,
    badgeLabel,
    badgeBox,
    invalidatePalette,
    paintBranch,
    paintAffordances,
    paintRootFocus,
    FALLBACK,
  };
})(typeof globalThis === "object" ? globalThis : this);
