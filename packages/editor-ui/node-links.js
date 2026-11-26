/* Note and link marks on a node. They sit outside the label box, so a map
   without notes or links keeps the same sizes and positions. */
(function (root) {
  "use strict";
  const EXEC = /\.(exe|bat|cmd|ps1|vbs|msi|sh|app|command|com|scr)$/i;
  const tr = (it, en) => root.GlaukaI18n?.pair?.(it, en) ?? (document.documentElement.lang === "en" ? en : it);
  function marks(node, metrics) {
    if (!node || !metrics) return [];
    const notes = String(node.notes || "").trim();
    const link = classify(node.linkUrl);
    const size = 14;
    let x = metrics.x + metrics.width / 2 + 8;
    const y = metrics.y - metrics.height / 2 - 2;
    const out = [];
    if (notes) {
      out.push({ kind: "note", x, y, s: size });
      x += size + 3;
    }
    if (link.ok) out.push({ kind: "link", x, y, s: size, file: link.kind === "file" });
    return out;
  }
  function classify(raw) {
    const text = String(raw || "").trim();
    if (!text || text.length > 2048 || text.includes("\0")) return { ok: false };
    if (/^(javascript|data|vbscript):/i.test(text)) return { ok: false };
    if (/^https?:\/\//i.test(text)) {
      try {
        const url = new URL(text);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.host) return { ok: false };
        return { ok: true, kind: "web", value: url.href, executable: false };
      } catch {
        return { ok: false };
      }
    }
    let path = text;
    if (/^(?:[a-zA-Z]:[\\/]|\\\\)/.test(text)) {
      path = text;
    } else if (/^file:/i.test(text)) {
      try {
        const url = new URL(text);
        if (url.protocol !== "file:" || (url.hostname && url.hostname !== "localhost")) return { ok: false };
        path = decodeURIComponent(url.pathname || "");
        if (/^\/[a-zA-Z]:/.test(path)) path = path.slice(1);
      } catch {
        return { ok: false };
      }
    } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(text)) return { ok: false };
    const absolute = /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(path);
    if (!absolute || path.includes("..")) return { ok: false };
    return { ok: true, kind: "file", value: path, executable: EXEC.test(path) };
  }
  function paint(renderer, node, metrics) {
    const ctx = renderer?.ctx;
    const boxes = marks(node, metrics);
    if (!ctx || !boxes.length) return;
    ctx.save();
    ctx.lineWidth = 1.2;
    for (const box of boxes) {
      ctx.beginPath();
      ctx.fillStyle = "rgba(15,23,42,.92)";
      ctx.strokeStyle = "#c4b5fd";
      ctx.rect(box.x, box.y, box.s, box.s);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 1.15;
      if (box.kind === "note") {
        ctx.moveTo(box.x + 3.2, box.y + 3);
        ctx.lineTo(box.x + 8, box.y + 3);
        ctx.lineTo(box.x + 11, box.y + 6);
        ctx.lineTo(box.x + 11, box.y + 11);
        ctx.lineTo(box.x + 3.2, box.y + 11);
        ctx.closePath();
        ctx.moveTo(box.x + 8, box.y + 3);
        ctx.lineTo(box.x + 8, box.y + 6);
        ctx.lineTo(box.x + 11, box.y + 6);
      } else {
        ctx.moveTo(box.x + 4, box.y + 7);
        ctx.bezierCurveTo(box.x + 4, box.y + 4, box.x + 10, box.y + 4, box.x + 10, box.y + 7);
        ctx.moveTo(box.x + 4, box.y + 7);
        ctx.bezierCurveTo(box.x + 4, box.y + 10, box.x + 10, box.y + 10, box.x + 10, box.y + 7);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function svgMarks(node, metrics) {
    return marks(node, metrics).map((box) => {
      const body = box.kind === "note"
        ? `<path d="M${(box.x + 3.2).toFixed(1)} ${(box.y + 3).toFixed(1)} H${(box.x + 8).toFixed(1)} L${(box.x + 11).toFixed(1)} ${(box.y + 6).toFixed(1)} V${(box.y + 11).toFixed(1)} H${(box.x + 3.2).toFixed(1)} Z M${(box.x + 8).toFixed(1)} ${(box.y + 3).toFixed(1)} V${(box.y + 6).toFixed(1)} H${(box.x + 11).toFixed(1)}" fill="none" stroke="#f8fafc" stroke-width="1.15"/>`
        : `<path d="M${(box.x + 4).toFixed(1)} ${(box.y + 7).toFixed(1)} C${(box.x + 4).toFixed(1)} ${(box.y + 4).toFixed(1)} ${(box.x + 10).toFixed(1)} ${(box.y + 4).toFixed(1)} ${(box.x + 10).toFixed(1)} ${(box.y + 7).toFixed(1)} C${(box.x + 10).toFixed(1)} ${(box.y + 10).toFixed(1)} ${(box.x + 4).toFixed(1)} ${(box.y + 10).toFixed(1)} ${(box.x + 4).toFixed(1)} ${(box.y + 7).toFixed(1)}" fill="none" stroke="#f8fafc" stroke-width="1.15"/>`;
      return `<g><rect x="${box.x.toFixed(2)}" y="${box.y.toFixed(2)}" width="${box.s}" height="${box.s}" rx="2" fill="#0f172a" stroke="#c4b5fd" stroke-width="1.2"/>${body}</g>`;
    }).join("");
  }
  function hit(app, clientX, clientY) {
    const point = app.renderer?.screenToWorld?.(clientX, clientY);
    const map = app.layout?.nodeLayoutMap;
    if (!point || !map) return null;
    const zoom = Math.max(0.05, app.renderer.camera?.zoom || 1);
    const slop = 3 / zoom;
    for (const [id, metrics] of map) {
      const node = app.state.findNode?.(metrics.logicalId || id) || app.state.findNode?.(id);
      if (!node) continue;
      for (const box of marks(node, metrics)) {
        if (point.x >= box.x - slop && point.x <= box.x + box.s + slop && point.y >= box.y - slop && point.y <= box.y + box.s + slop)
          return { type: box.kind, item: node };
      }
    }
    return null;
  }
  function tip(node, kind) {
    const title = String(node?.text || "").trim();
    if (kind === "note") {
      const preview = String(node.notes || "").trim().replace(/\s+/g, " ").slice(0, 140);
      return (title ? title + " — " : "") + preview;
    }
    return String(node?.linkUrl || "");
  }
  function ensureDialog() {
    let dialog = document.getElementById("nm-node-link-dialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "nm-node-link-dialog";
    dialog.className = "nm6-skiptranslate";
    const form = document.createElement("form");
    form.method = "dialog";
    const title = document.createElement("h2");
    title.id = "nm-node-link-title";
    const field = document.createElement("input");
    field.id = "nm-node-link-input";
    field.type = "text";
    field.autocomplete = "off";
    field.spellcheck = false;
    const pick = document.createElement("button");
    pick.type = "button";
    pick.id = "nm-node-link-pick";
    const note = document.createElement("p");
    note.id = "nm-node-link-note";
    const row = document.createElement("div");
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.value = "cancel";
    const save = document.createElement("button");
    save.type = "submit";
    save.value = "save";
    row.append(cancel, save);
    form.append(title, field, pick, note, row);
    dialog.append(form);
    const style = document.createElement("style");
    style.textContent = "#nm-node-link-dialog{border:1px solid var(--nm-skin-stroke,#334155);border-radius:14px;padding:18px;max-width:460px;width:min(460px,calc(100vw - 32px));background:var(--nm-skin-surface,#10182b);color:var(--nm-skin-ink,#e8eefc);box-shadow:var(--nm-skin-shadow,0 24px 60px rgba(0,0,0,.45))}#nm-node-link-dialog::backdrop{background:rgba(5,10,20,.58)}#nm-node-link-dialog h2{margin:0 0 10px;font-size:16px;font-weight:700}#nm-node-link-input{width:100%;box-sizing:border-box;margin:0 0 8px;padding:9px 11px;border-radius:9px;border:1px solid var(--nm-skin-stroke,#475569);background:var(--nm-skin-top,#1e293b);color:var(--nm-skin-ink,#f8fafc);font:13px system-ui}#nm-node-link-dialog p{font-size:12px;line-height:1.45;color:var(--nm-skin-muted,#94a3b8);margin:8px 0 0}#nm-node-link-dialog div{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}#nm-node-link-dialog button{padding:7px 12px;border-radius:9px;border:1px solid var(--nm-skin-stroke,#475569);background:var(--nm-skin-top,#1e293b);color:var(--nm-skin-ink,#e2e8f0);font:600 12.5px system-ui;cursor:pointer}#nm-node-link-dialog button[type=submit]{background:#6366f1;border-color:#6366f1;color:#fff}#nm-node-link-panel{margin:12px 0 8px;padding:12px;border:1px solid var(--nm-skin-stroke,rgba(129,140,248,.22));background:var(--nm-skin-top,rgba(12,20,39,.5));border-radius:13px;display:flex;flex-direction:column;gap:8px}#nm-node-link-panel[hidden]{display:none}#nm-node-link-panel h3{margin:0;font-size:12px;font-weight:700;color:var(--nm-skin-ink,#dce5fa)}#nm-node-link-current{font-size:11.5px;color:var(--nm-skin-muted,#94a3b8);overflow-wrap:anywhere;line-height:1.35}#nm-node-link-panel .nm-node-link-actions{display:flex;flex-wrap:wrap;gap:6px}#nm-node-link-panel button{padding:7px 10px;border-radius:9px;border:1px solid var(--nm-skin-stroke,rgba(126,147,203,.27));background:var(--nm-skin-surface,#19253d);color:var(--nm-skin-ink,#dae3fa);font:600 11.5px system-ui;cursor:pointer}#nm-node-link-panel button:disabled{opacity:.48;cursor:default}";
    document.head.append(style);
    document.body.append(dialog);
    return dialog;
  }
  function apply(app, node, raw) {
    const next = String(raw || "").trim() ? classify(raw) : { ok: true, value: "" };
    if (!next.ok) {
      app.showToast?.(tr("Indirizzo non consentito. Usa https, http o un file del computer.", "That address is not allowed. Use https, http, or a file on this computer."), tr("Collegamento", "Link"));
      return false;
    }
    const value = next.value || "";
    if (String(node.linkUrl || "") === value) return true;
    app.state.pushHistory?.();
    if (value) node.linkUrl = value;
    else delete node.linkUrl;
    app.markChanged?.();
    app.requestRender?.();
    refreshInspector(app);
    return true;
  }
  async function edit(app, node) {
    const logical = app.state.findNode?.(node?.logicalId || node?.id) || node;
    if (!logical) return;
    const dialog = ensureDialog();
    dialog.querySelector("#nm-node-link-title").textContent = tr("Collega link o file", "Link a page or file");
    dialog.querySelector("#nm-node-link-note").textContent = tr(
      "Sul ramo compare solo l’icona. Un file si apre soltanto da quell’icona. Programmi e script chiedono una conferma.",
      "The branch shows only the icon. A file opens only from that icon. Programs and scripts ask for confirmation.",
    );
    const field = dialog.querySelector("#nm-node-link-input");
    const pick = dialog.querySelector("#nm-node-link-pick");
    const cancel = dialog.querySelector("button[value=cancel]");
    const save = dialog.querySelector("button[value=save]");
    field.value = logical.linkUrl || "";
    field.placeholder = "https://";
    pick.textContent = tr("Scegli un file sul computer…", "Choose a file on this computer…");
    cancel.textContent = tr("Annulla", "Cancel");
    save.textContent = tr("Salva collegamento", "Save link");
    pick.onclick = async () => {
      if (!root.neuromapDesktop?.pickLinkFile) {
        app.showToast?.(tr("La scelta del file è disponibile nell’app Desktop.", "Choosing a file is available in the desktop app."), tr("Collegamento", "Link"));
        return;
      }
      try {
        const result = await root.neuromapDesktop.pickLinkFile();
        if (result && !result.cancelled && result.path) field.value = result.path;
      } catch (error) {
        app.showToast?.(error.message || tr("File non scelto", "File not chosen"), tr("Collegamento", "Link"));
      }
    };
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.hidden = false;
    field.focus();
    const form = dialog.querySelector("form");
    form.onsubmit = (event) => {
      event.preventDefault();
      if (apply(app, logical, field.value)) dialog.close();
    };
    cancel.onclick = () => dialog.close();
  }
  async function open(app, node) {
    const logical = app.state.findNode?.(node?.logicalId || node?.id) || node;
    const info = classify(logical?.linkUrl);
    if (!info.ok) return;
    if (!root.neuromapDesktop?.openLinkedTarget) {
      if (info.kind === "web") window.open(info.value, "_blank", "noopener,noreferrer");
      else app.showToast?.(tr("I file del computer si aprono dall’app Desktop.", "Files on this computer open from the desktop app."), tr("Collegamento", "Link"));
      return;
    }
    let confirm = false;
    if (info.executable) {
      const answer = await app.nmAsk?.({
        title: tr("Aprire questo file?", "Open this file?"),
        message: tr("Questo file può essere un programma o uno script. Si apre solo se lo confermi adesso.", "This file may be a program or a script. It opens only if you confirm now."),
        choices: [
          { value: "cancel", text: tr("Annulla", "Cancel") },
          { value: "open", text: tr("Apri", "Open"), primary: true },
        ],
      });
      if (answer !== "open") return;
      confirm = true;
    }
    try {
      const result = await root.neuromapDesktop.openLinkedTarget({ target: info.value, confirm });
      if (result?.needsConfirm) app.showToast?.(tr("Conferma necessaria prima di aprire il file.", "Confirmation is required before opening the file."), tr("Collegamento", "Link"));
    } catch (error) {
      app.showToast?.(error.message || tr("Impossibile aprire il collegamento", "The link could not be opened"), tr("Collegamento", "Link"));
    }
  }
  function refreshInspector(app) {
    const host = document.getElementById("nm-node-link-panel");
    if (!host) return;
    const node = app.state.findNode?.(app.state.selectedNodeId);
    host.hidden = !node;
    const info = classify(node?.linkUrl);
    const shown = host.querySelector("output");
    if (shown) shown.textContent = info.ok ? String(node.linkUrl) : tr("Nessun collegamento", "No link");
    const openBtn = host.querySelector("#nm-node-link-open");
    if (openBtn) openBtn.disabled = !info.ok;
    const clearBtn = host.querySelector("#nm-node-link-clear");
    if (clearBtn) clearBtn.disabled = !info.ok;
  }
  function install(App) {
    if (!App || App.prototype._nmNodeLinks) return;
    App.prototype._nmNodeLinks = true;
    App.prototype.openNodeLink = function (node) { return open(this, node); };
    App.prototype.editNodeLink = function (node) {
      return edit(this, node || this.state.findNode(this.state.selectedNodeId));
    };
    const find = App.prototype.findHit;
    if (find) {
      App.prototype.findHit = function (x, y) {
        const mark = hit(this, x, y);
        if (mark) return mark;
        return find.apply(this, arguments);
      };
    }
    const bind = App.prototype.bindUI;
    if (bind) {
      App.prototype.bindUI = function (...args) {
        const result = bind.apply(this, args);
        this.canvas?.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          const mark = this.findHit?.(event.clientX, event.clientY);
          if (mark?.type !== "note" && mark?.type !== "link") return;
          event.preventDefault();
          event.stopImmediatePropagation();
          const id = mark.item.logicalId || mark.item.id;
          this.selectNode?.(id);
          if (mark.type === "note") this.nm67OpenNotes?.();
          else this.openNodeLink?.(mark.item);
        }, true);
        this.canvas?.addEventListener("pointermove", (event) => {
          const mark = hit(this, event.clientX, event.clientY);
          const next = mark ? tip(mark.item, mark.type) : "";
          if (this.canvas.title !== next) this.canvas.title = next;
        }, true);
        return result;
      };
    }
    const select = App.prototype.selectNode;
    if (select) {
      App.prototype.selectNode = function (...args) {
        const result = select.apply(this, args);
        refreshInspector(this);
        return result;
      };
    }
    const show = App.prototype.showContextMenu;
    if (show) {
      App.prototype.showContextMenu = function (...args) {
        const result = show.apply(this, args);
        const group = document.getElementById("ctx-group-node");
        if (group && !document.getElementById("ctx-node-link")) {
          const button = document.createElement("button");
          button.type = "button";
          button.id = "ctx-node-link";
          button.className = "ctx-item";
          button.textContent = tr("Collega link o file…", "Link a page or file…");
          button.addEventListener("click", () => {
            this.hideMenus?.();
            this.editNodeLink?.();
          });
          const notes = document.getElementById("nm67-notes-context");
          if (notes?.parentElement === group) notes.after(button);
          else group.append(button);
        }
        return result;
      };
    }
    const sidebar = document.getElementById("inspector-sidebar");
    if (sidebar && !document.getElementById("nm-node-link-panel")) {
      const panel = document.createElement("section");
      panel.id = "nm-node-link-panel";
      panel.className = "nm6-skiptranslate";
      const heading = document.createElement("h3");
      heading.textContent = tr("Collegamento", "Link");
      const shown = document.createElement("output");
      shown.id = "nm-node-link-current";
      const actions = document.createElement("div");
      actions.className = "nm-node-link-actions";
      const button = document.createElement("button");
      button.type = "button";
      button.id = "nm-node-link-edit";
      button.textContent = tr("Collega link o file…", "Link a page or file…");
      button.addEventListener("click", () => {
        const live = root.neuroMapApp;
        live?.editNodeLink?.();
      });
      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.id = "nm-node-link-open";
      openBtn.disabled = true;
      openBtn.textContent = tr("Apri", "Open");
      openBtn.addEventListener("click", () => {
        const live = root.neuroMapApp;
        const node = live?.state?.findNode?.(live.state.selectedNodeId);
        if (node) live.openNodeLink?.(node);
      });
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.id = "nm-node-link-clear";
      clearBtn.disabled = true;
      clearBtn.textContent = tr("Rimuovi", "Remove");
      clearBtn.addEventListener("click", () => {
        const live = root.neuroMapApp;
        const node = live?.state?.findNode?.(live.state.selectedNodeId);
        if (live && node) apply(live, node, "");
      });
      actions.append(button, openBtn, clearBtn);
      panel.append(heading, shown, actions);
      sidebar.append(panel);
    }
  }
  root.GlaukaNodeLinks = { install, classify, marks, paint, svgMarks, hit };
})(typeof globalThis === "object" ? globalThis : this);
