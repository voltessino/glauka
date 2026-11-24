/* One workspace language and one active side panel. Document state is untouched. */
(function (root) {
  "use strict";
  function coordinator() {
    const entries = new Map();
    return {
      register(id, adapter) {
        entries.set(id, adapter);
      },
      claim(id) {
        const othersOpen = () => [...entries].filter(
          ([key, e]) => key !== id && e.isOpen(),
        );
        const blockedBy = (open) => open.find(([, e]) => e.canLeave?.() === false);
        // Closing a study panel can reopen another inspector, including one
        // with a protected unsaved draft. Revalidate *after every close*.
        // The limit also prevents a buggy panel from reopening indefinitely.
        for (let pass = 0; pass < Math.max(2, entries.size * 2); pass++) {
          const open = othersOpen();
          const blocked = blockedBy(open);
          if (blocked) {
            blocked[1].focus?.();
            return false;
          }
          if (!open.length) return true;
          for (const [key, e] of open) {
            if (!e.isOpen()) continue;
            const newlyBlocked = blockedBy(othersOpen());
            if (newlyBlocked) {
              newlyBlocked[1].focus?.();
              return false;
            }
            e.close();
          }
        }
        // Never claim success when a panel is still visible.
        return othersOpen().length === 0;
      },
    };
  }
  const listKinds = [
    ["none", "Nessuno", "None", "Aa"],
    ["disc", "Punti pieni", "Solid dots", "•"],
    ["circle", "Cerchi", "Circles", "○"],
    ["square", "Quadrati", "Squares", "▪"],
    ["dash", "Trattini", "Dashes", "–"],
    ["number", "Numeri", "Numbers", "1."],
    ["letter", "Lettere", "Letters", "a."],
  ];
  function formatList(text, kind) {
    if (!listKinds.some((item) => item[0] === kind)) return String(text || "");
    let index = 0;
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => {
        if (!line.trim()) return line;
        const clean = line.replace(
          /^([ \t]*)(?:[•●○◦▪■–*\-]|\d+[.)]|[a-zA-Z]{1,4}[.)])\s+/,
          "$1",
        );
        if (kind === "none") return clean;
        index++;
        let letters = "",
          n = index;
        while (n > 0) {
          n--;
          letters = String.fromCharCode(97 + (n % 26)) + letters;
          n = Math.floor(n / 26);
        }
        const marker =
          kind === "number"
            ? index + "."
            : kind === "letter"
              ? letters + "."
              : listKinds.find((item) => item[0] === kind)[3];
        const indent = clean.match(/^[ \t]*/)[0];
        return indent + marker + " " + clean.slice(indent.length);
      })
      .join("\n");
  }
  // A document.body popover must be anchored without covering its trigger,
  // including when the inspector has scrolled close to the bottom of a screen.
  // Pure geometry keeps IT/EN/theme and device-independent layout testable.
  function placeListMenu(anchor, measuredHeight, viewport) {
    const margin = 8, gap = 5;
    const width = Math.max(0, Math.min(240, viewport.width - margin * 2));
    const left = Math.max(margin,
      Math.min(anchor.left, viewport.width - width - margin));
    const below = Math.max(0, viewport.height - anchor.bottom - gap - margin);
    const above = Math.max(0, anchor.top - gap - margin);
    const side = below >= measuredHeight || below >= above ? "below" : "above";
    const available = side === "below" ? below : above;
    const maxHeight = Math.max(0, Math.min(measuredHeight, available));
    const top = side === "below" ? anchor.bottom + gap :
      Math.max(margin, anchor.top - gap - maxHeight);
    return { width, left, top, maxHeight, side };
  }
  if (typeof module === "object" && module.exports)
    module.exports = { coordinator, formatList, placeListMenu };
  const states = new WeakMap(),
    tr = (it, en) => (globalThis.GlaukaI18n?.pair(it,en) ?? ((document.documentElement.lang === "en" ? en : it)));
  function claim(app, id) {
    const state = states.get(app);
    if (!state) return true;
    const previous = globalThis._nmWorkspaceClaiming || 0;
    globalThis._nmWorkspaceClaiming = previous + 1;
    try {
      const ok = state.claim(id);
      // The list-format palette lives under document.body (for clipping safety).
      // A programmatic switch must dismiss it before another panel takes focus.
      if (ok && id !== "inspector") app._nmCloseListPicker?.();
      return ok;
    } finally {
      globalThis._nmWorkspaceClaiming = previous;
    }
  }
  const iconPaths = {
    "btn-spotlight": ["M21 21l-5-5", "M18 10a8 8 0 1 1-16 0a8 8 0 0 1 16 0"],
    "btn-flashcards": ["M3 5h14v14H3z", "M7 2h14v14", "M7 10h6M7 14h4"],
    "btn-illustrate": ["M3 3h18v18H3z", "M3 17l6-6 4 4 3-3 5 5", "M9 7h.01"],
    "nm62-toolbar-assets": ["M3 7h18v14H3z", "M7 7V3h10v4", "M9 12h6"],
    "btn-ai-settings": [
      "M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
    ],
  };
  function icons() {
    for (const [id, paths] of Object.entries(iconPaths)) {
      const b = document.getElementById(id);
      if (!b || b.dataset.nmLineIcon) continue;
      if (b.querySelector(":scope>svg")) {
        b.dataset.nmLineIcon = "1";
        continue;
      }
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "1.7");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      svg.setAttribute("aria-hidden", "true");
      svg.classList.add("nm-workspace-icon");
      for (const d of paths) {
        const path = document.createElementNS(svg.namespaceURI, "path");
        path.setAttribute("d", d);
        svg.append(path);
      }
      // Preserve the accessible name before removing decorative glyph text.
      const label = b.getAttribute('aria-label') || b.title || b.textContent?.trim() || id;
      for (const child of [...b.childNodes])
        if (child.nodeType === 3) child.remove();
      b.prepend(svg);
      b.dataset.nmLineIcon = "1";
      if (!b.getAttribute("aria-label"))
        b.setAttribute("aria-label", label);
    }
  }
/* @neuromap-workspace-layout-lists */
  function install(App) {
    const assets = App.prototype.nm62OpenAssets;
    if (assets)
      App.prototype.nm62OpenAssets = function (...args) {
        if (!claim(this, "markers")) return;
        return assets.apply(this, args);
      };
    const tabs = App.prototype.renderTabBar;
    App.prototype.renderTabBar = function (...args) {
      const result = tabs.apply(this, args);
      document
        .querySelectorAll("#tabs-list .tab-item")
        .forEach((element, index) => {
          const tab = this.tabs[index];
          if (!tab) return;
          const label = element.querySelector(".tab-title");
          if (label) label.textContent = tab.title;
          element.dataset.nmDirty = String(!!tab.state.isDirty);
          if (tab.state.isDirty) {
            const dot = document.createElement("span");
            dot.className = "nm-workspace-dirty";
            dot.setAttribute("role", "img");
            dot.setAttribute(
              "aria-label",
              tr("Modifiche non salvate", "Unsaved changes"),
            );
            dot.title = dot.getAttribute("aria-label");
            element.insertBefore(dot, element.querySelector(".tab-close-btn"));
          }
        });
      return result;
    };
    const show = App.prototype.showToast;
    App.prototype.showToast = function (message, label, ...args) {
      const result = show.call(this, message, label, ...args),
        el = document.getElementById("toast-notification");
      if (el) {
        const error =
          /errore|error|attenzione|warning|avviso/i.test(label || "") ||
          /^(Impossibile|Recupero non riuscito|Autosalvataggio.*non riuscito|Failed|Unable)/i.test(
            String(message),
          );
        el.dataset.nmToastKind = error ? "error" : "status";
        el.setAttribute("role", error ? "alert" : "status");
        el.setAttribute("aria-live", error ? "assertive" : "polite");
        if (error) clearTimeout(this.toastTimer);
        const action = document.getElementById("nm-toast-save-action");
        if (action)
          action.hidden =
            !error ||
            !/salvat|salva|backup|recuper|save|recovery/i.test(String(message));
      }
      return result;
    };
    const updateStatus = App.prototype.updateStatus;
    App.prototype.updateStatus = function (...args) {
      const result = updateStatus.apply(this, args);
      this._nmSyncLists?.();
      return result;
    };
    const bind = App.prototype.bindUI;
    App.prototype.bindUI = function (...args) {
      const result = bind.apply(this, args);
      mount(this);
      return result;
    };
  }

  function syncInkTools(app){
    const inkPark=document.getElementById('nm-ink-park');
    const inkTools=document.getElementById('nm-insert-ink-tools');
    const inkStyle=document.getElementById('nm-ink-style');
    if(inkPark){
      if(inkTools&&inkTools.parentElement!==inkPark)inkPark.append(inkTools);
      if(inkStyle&&inkStyle.parentElement!==inkPark)inkPark.append(inkStyle);
      if(inkTools)inkTools.hidden=true;
    }
    const active=app._nmDraw?.active&&app._nmDraw.owner===app.state?app._nmDraw.tool:null;
    for(const button of document.querySelectorAll('#nm-insert-ink-tools > button')){
      const pressed=String(button.id==='nm-text-tool-'+active);
      if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
    }
    const row=document.getElementById('nm-ink-style');
    if(!row)return;
    const strokeTool=active==='pen'||active==='pencil'||active==='highlight';
    const eraser=active==='eraser';
    row.hidden=!(strokeTool||eraser);
    const title=document.getElementById('nm-ink-style-title');
    if(title)title.textContent=eraser
      ? (document.documentElement.lang==='en'?'Eraser size':'Dimensione gomma')
      : (document.documentElement.lang==='en'?'Stroke style':'Stile del tratto');
    const colors=row.querySelector('.nm-ink-colors');
    if(colors)colors.hidden=eraser;
    const current=Number(document.getElementById('nm-draw-stroke')?.value);
    row.querySelectorAll('.nm-ink-width').forEach(button=>{
      button.setAttribute('aria-pressed',String(Number(button.dataset.width)===current));
    });
  }
  root.NeuroMapWorkspaceLayout = {
    syncInkTools,
    install, claim, coordinator,
    // Optional desktop panels can join the existing close/unsaved-draft rules.
    // Do not expose the coordinator internals or recreate one per panel.
    registerPanel(app, id, adapter) {
      const state = states.get(app);
      if (!state || !id || !adapter ||
          typeof adapter.isOpen !== "function" ||
          typeof adapter.close !== "function") return false;
      state.register(id, adapter);
      return true;
    },
  };
})(globalThis);
