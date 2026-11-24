/* Illustrated, keyboard-accessible view picker. The original select owns the value. */
(function (root) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const previews = {
    mindmap: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM7 7l2.5 3M7 17l2.5-3M17 7l-2.5 3M17 17l-2.5-3M3 4h4v4H3zM3 16h4v4H3zM17 4h4v4h-4zM17 16h4v4h-4z",
    orgchart: "M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-4h12v4",
    "concept-tree": "M3 10h5v5H3zM16 3h5v5h-5zM16 16h5v5h-5zM8 12.5h4V5.5h4M12 12.5v6h4",
    "concept-network": "M5 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM19 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM12 11a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM4 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM20 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM7 7l3 4M17 5l-3 6M10 16l-4 3M14 16l4 2M7 7l10-2",
    flowchart: "M2 9h6v6H2zM9 12h0M13 8l4 4-4 4-4-4zM17 12h2M19 9h4v6h-4z",
    kanban: "M2 3h6v18H2zM9 3h6v18H9zM16 3h6v18h-6zM3.5 7h3M10.5 7h3M17.5 7h3M3.5 11h3M10.5 11h3M17.5 11h3M3.5 15h3M17.5 15h3",
    timeline: "M5 3v18M5 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM9 7h12M9 13h8M9 19h11",
  };
  const hints = {
    mindmap: ["Idee intorno a un centro", "Ideas around a center"],
    orgchart: [
      "Una gerarchia dall’alto in basso",
      "A hierarchy from top to bottom",
    ],
    "concept-tree": ["Dal generale al dettaglio", "From overview to detail"],
    "concept-network": ["Concetti e relazioni", "Concepts and relationships"],
    flowchart: ["Passaggi e decisioni", "Steps and decisions"],
    kanban: ["Attività divise per stato", "Tasks grouped by status"],
    timeline: ["Attività disposte per data", "Tasks arranged by date"],
  };
  const tr = (it, en) => (globalThis.GlaukaI18n?.pair(it,en) ?? ((document.documentElement.lang === "en" ? en : it)));
  function icon(mode) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", previews[mode] || previews.mindmap);
    svg.append(path);
    return svg;
  }
  function styles() {
    if (document.getElementById("nm-view-picker-css")) return;
    const s = document.createElement("style");
    s.id = "nm-view-picker-css";
    s.textContent = `
.nm-view-trigger{display:flex;align-items:center;gap:7px;min-width:0;max-width:100%;padding:5px 9px;border:1px solid var(--nm-skin-stroke,#74869e);border-radius:10px;background:var(--nm-skin-top,#1f2d48);color:var(--nm-skin-ink,#edf2fa);font:12px system-ui;cursor:pointer}
.nm-view-trigger svg{width:24px;height:24px;flex:0 0 24px}.nm-view-trigger span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nm-view-trigger::after{content:'⌄';margin-left:auto;color:var(--nm-theme-focus,#b5a6ff)}
.nm-view-trigger svg,.nm-view-choice svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;background:none;border:0;border-radius:0;box-shadow:none;padding:0}
.nm-view-popup{position:fixed;inset:auto;margin:0;box-sizing:border-box;width:min(390px,calc(100vw - 20px));padding:10px;border:1px solid var(--nm-skin-stroke,#74869e);border-radius:15px;background:var(--nm-skin-surface,#132139);color:var(--nm-skin-ink,#edf2fa);box-shadow:var(--nm-skin-shadow,0 18px 60px #0005);z-index:3100;overflow:auto;overscroll-behavior:contain;font:12px system-ui}
.nm-view-popup[hidden]{display:none!important}.nm-view-popup h3{font:600 13px system-ui;margin:3px 4px 10px}.nm-view-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
.nm-view-choice{display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:8px;min-width:0;min-height:64px;padding:8px;border:1px solid var(--nm-skin-stroke,#74869e);border-radius:10px;background:var(--nm-skin-top,#1f2d48);color:var(--nm-skin-ink,#edf2fa);text-align:left;cursor:pointer;font:12px system-ui}
.nm-view-choice svg{width:28px;height:28px}.nm-view-choice strong{display:block;font-size:12px;font-weight:600}.nm-view-choice small{display:block;font-size:10px;line-height:1.4;color:var(--nm-skin-muted,#b8c5d9);margin-top:4px;overflow-wrap:anywhere}.nm-view-choice[aria-checked=true]{background:var(--nm-theme-action,#6654ca);color:var(--nm-theme-on-action,#fff);border-color:var(--nm-theme-focus,#b5a6ff)}.nm-view-choice[aria-checked=true] strong{font-weight:700}.nm-view-choice[aria-checked=true] small{color:inherit}.nm-view-choice[aria-checked=true] svg{background:none;border:0;border-radius:0;box-shadow:none}.nm-view-choice:hover{border-color:var(--nm-theme-focus,#b5a6ff)}.nm-view-choice:focus-visible,.nm-view-trigger:focus-visible{outline:2px solid var(--nm-theme-focus,#b5a6ff);outline-offset:2px}
@media(max-width:420px){.nm-view-gallery{grid-template-columns:minmax(0,1fr)}.nm-view-choice{min-height:60px}}
#nm-view-switch{flex-wrap:wrap}#nm-view-switch label{flex-basis:100%}#nm-view-switch .nm-view-trigger{flex:1}#nm-view-overlay .nm-view-trigger{padding:5px 8px;background:var(--nm-skin-top,#1f2d48);font:12px system-ui}
`;
    document.head.append(s);
  }
  let active;
  function create(select) {
    styles();
    select.hidden = true;
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "nm-view-trigger";
    trigger.id = select.id + "-trigger";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    const popup = document.createElement("div");
    popup.id = select.id + "-gallery";
    popup.className = "nm-view-popup nm6-skiptranslate";
    popup.hidden = true;
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "false");
    trigger.setAttribute("aria-controls", popup.id);
    for (const label of select.labels || []) label.htmlFor = trigger.id;
    select.after(trigger);
    document.body.append(popup);
    let opened = false;
    const close = (restore = false) => {
      if (!opened) return;
      opened = false;
      if (
        typeof popup.hidePopover === "function" &&
        popup.matches(":popover-open")
      )
        popup.hidePopover();
      popup.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      if (active === close) active = null;
      if (restore) trigger.focus();
    };
    const sync = () => {
      const option =
        [...select.options].find((o) => o.value === select.value) ||
        select.options[0];
      if (!option) return;
      const currentHint = hints[option.value] ? tr(...hints[option.value]) : "";
      trigger.title = currentHint
        ? option.textContent + " — " + currentHint
        : option.textContent;
      const text = document.createElement("span");
      text.textContent = option.textContent;
      trigger.replaceChildren(icon(option.value), text);
      trigger.setAttribute(
        "aria-label",
        (select.getAttribute("aria-label") || tr("Visualizzazione", "View")) + ": " + option.textContent,
      );
      if (!opened) return;
      popup.replaceChildren();
      const title = document.createElement("h3");
      title.textContent = tr("Scegli la visualizzazione", "Choose a view");
      popup.append(title);
      popup.setAttribute("aria-label", title.textContent);
      const grid = document.createElement("div");
      grid.className = "nm-view-gallery";
      grid.setAttribute("role", "radiogroup");
      grid.setAttribute("aria-label", title.textContent);
      for (const item of select.options) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "nm-view-choice";
        b.dataset.view = item.value;
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(item.value === select.value));
        b.tabIndex = item.value === select.value ? 0 : -1;
        const label = document.createElement("span"),
          name = document.createElement("strong"),
          hint = document.createElement("small");
        name.textContent = item.textContent;
        const hintText = hints[item.value] ? tr(...hints[item.value]) : "";
        hint.textContent = hintText;
        b.title = hintText ? item.textContent + " — " + hintText : item.textContent;
        label.append(name, hint);
        b.append(icon(item.value), label);
        b.onclick = () => {
          select.value = item.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          close(true);
          sync();
        };
        grid.append(b);
      }
      popup.append(grid);
    };
    const position = () => {
      const r = trigger.getBoundingClientRect();
      popup.style.maxHeight = Math.max(100, innerHeight - 24) + "px";
      const box = popup.getBoundingClientRect();
      popup.style.left =
        Math.max(12, Math.min(innerWidth - box.width - 12, r.left)) + "px";
      popup.style.top =
        Math.max(12, Math.min(innerHeight - box.height - 12, r.bottom + 6)) +
        "px";
    };
    trigger.onclick = () => {
      if (opened) {
        close(true);
        return;
      }
      active?.();
      opened = true;
      active = close;
      popup.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      sync();
      if (typeof popup.showPopover === "function") {
        popup.setAttribute("popover", "manual");
        popup.showPopover();
      }
      position();
      popup.querySelector("[aria-checked=true]")?.focus();
    };
    popup.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
        return;
      }
      const choices = [...popup.querySelectorAll("button")],
        index = choices.indexOf(document.activeElement);
      let next;
      if (e.key === "ArrowRight") next = index + 1;
      if (e.key === "ArrowLeft") next = index - 1;
      if (e.key === "ArrowDown") next = index + 2;
      if (e.key === "ArrowUp") next = index - 2;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = choices.length - 1;
      if (next !== undefined) {
        e.preventDefault();
        choices[(next + choices.length) % choices.length].focus();
      }
      if (e.key === "Tab") {
        close(false);
        trigger.focus();
      }
    });
    trigger.addEventListener("keydown", (e) => {
      if (!e.ctrlKey && !e.metaKey) e.stopPropagation();
    });
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (opened && !popup.contains(e.target) && !trigger.contains(e.target))
          close(false);
      },
      true,
    );
    root.addEventListener("resize", () => {
      if (opened) position();
    });
    select.addEventListener("change", sync);
    select.nmViewPicker = { sync, close };
    sync();
    return select.nmViewPicker;
  }
  root.NeuroMapViewPicker = { create, previewIcon: icon };
})(globalThis);
