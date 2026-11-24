/* A single viewport-bound tooltip, outside scrolling panels and native title bubbles. */
(function (root) {
  "use strict";
  function install() {
    if (document.getElementById("nm-help-tooltip")) return;
    const tip = document.createElement("div");
    tip.id = "nm-help-tooltip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    document.body.append(tip);
    let owner = null,
      muted = new Map();
    // Observe only the active owner while the tip is open. A permanent
    // document.body MutationObserver would wake on every class/title change.
    const observer =
      typeof MutationObserver === "function"
        ? new MutationObserver(() => {
            if (!owner) return;
            if (owner.hasAttribute("title")) {
              const next = owner.getAttribute("title");
              muted.set(owner, next);
              owner.removeAttribute("title");
              if (tip.textContent !== next) tip.textContent = next;
            }
            position();
          })
        : null;
    const watchOwner = () => {
      if (!observer || !owner) return;
      observer.disconnect();
      observer.observe(owner, {
        attributes: true,
        attributeFilter: ["title", "hidden", "class"],
      });
    };
    const hide = () => {
      if (owner?.closest("#nm614-right-dock") && typeof owner.matches === "function" && owner.matches(":hover")) {
        tip.hidden = true;
        if (tip.hasAttribute("popover") && tip.matches(":popover-open")) tip.hidePopover();
        return;
      }
      observer?.disconnect();
      if (owner) {
        const ids = (owner.getAttribute("aria-describedby") || "")
          .split(/\s+/)
          .filter((id) => id && id !== tip.id);
        if (ids.length) owner.setAttribute("aria-describedby", ids.join(" "));
        else owner.removeAttribute("aria-describedby");
      }
      owner = null;
      tip.hidden = true;
      for (const [el, text] of muted)
        if (!el.hasAttribute("title")) el.setAttribute("title", text);
      muted.clear();
      if (tip.hasAttribute("popover") && tip.matches(":popover-open"))
        tip.hidePopover();
    };
    if (typeof tip.showPopover === "function")
      tip.setAttribute("popover", "manual");
    const position = () => {
      if (!owner) return;
      const r = owner.getBoundingClientRect();
      if (
        !owner.isConnected ||
        !r.width ||
        !r.height ||
        owner.closest("[hidden],.hidden")
      ) {
        hide();
        return;
      }
      const vv = window.visualViewport,
        x = vv?.offsetLeft || 0,
        y = vv?.offsetTop || 0,
        w = vv?.width || innerWidth,
        h = vv?.height || innerHeight;
      tip.style.maxWidth = Math.max(0, Math.min(270, w - 24)) + "px";
      tip.style.maxHeight = Math.max(0, h - 24) + "px";
      const b = tip.getBoundingClientRect();
      const covers = (left, top) => {
        const rect = {
          left,
          top,
          right: left + b.width,
          bottom: top + b.height,
        };
        for (const panel of document.querySelectorAll(
          "#inspector-sidebar,#nm-learn-panel,#nm-ai-studio,#nm-view-overlay,#nm-knowledge-panel,.hud-bottom-left",
        )) {
          if (
            panel.hidden ||
            panel.classList.contains("hidden") ||
            panel.classList.contains("collapsed")
          )
            continue;
          const box = panel.getBoundingClientRect();
          if (box.width < 2 || box.height < 2) continue;
          const across =
            Math.min(rect.right, box.right) - Math.max(rect.left, box.left);
          const down =
            Math.min(rect.bottom, box.bottom) - Math.max(rect.top, box.top);
          if (across > 4 && down > 4) return true;
        }
        return false;
      };
      let left = Math.max(
        x + 12,
        Math.min(r.right - b.width, x + w - b.width - 12),
      );
      const below = r.bottom + 8;
      let top = Math.max(
        y + 12,
        Math.min(
          below + b.height <= y + h - 12 ? below : r.top - b.height - 8,
          y + h - b.height - 12,
        ),
      );
      if (owner.closest("#nm614-right-dock")) {
        const open = (typeof document.querySelectorAll === "function" ? [...document.querySelectorAll("#inspector-sidebar,#nm-learn-panel,#nm-ai-studio,#nm-knowledge-panel")] : []).find((panel) => {
          if (!panel || panel.hidden || panel.classList.contains("hidden") || panel.classList.contains("collapsed")) return false;
          const box = panel.getBoundingClientRect();
          return box.width > 40 && box.height > 40;
        });
        if (open) {
          const box = open.getBoundingClientRect();
          const beside = box.left - b.width - 10;
          const aligned = Math.max(y + 12, Math.min(r.top, y + h - b.height - 12));
          if (beside >= x + 12 && !covers(beside, aligned)) {
            left = beside;
            top = aligned;
          } else if (covers(left, top)) {
            tip.hidden = true;
            return;
          }
        } else if (covers(left, top)) {
          const above = r.top - b.height - 8;
          if (above >= y + 12 && !covers(left, above)) top = above;
          else {
            tip.hidden = true;
            return;
          }
        }
      }
      tip.hidden = false;
      tip.style.left = left + "px";
      tip.style.top = top + "px";
    };
    const onTouchUi = () =>
      !!(
        root.GlaukaMobile ||
        document.body?.classList?.contains("glauka-mobile-app")
      );
    const show = (target) => {
      if (onTouchUi()) {
        hide();
        return;
      }
      const el = target instanceof Element ? target.closest("[title]") : null;
      if (!el || !el.getAttribute("title").trim()) {
        if (!owner?.contains(target)) hide();
        return;
      }
      if (el === owner) return;
      hide();
      const text = el.getAttribute("title");
      owner = el;
      // A titled parent can otherwise produce a second browser tooltip as well.
      for (let ancestor = el; ancestor; ancestor = ancestor.parentElement)
        if (ancestor.hasAttribute("title")) {
          muted.set(ancestor, ancestor.getAttribute("title"));
          ancestor.removeAttribute("title");
        }
      tip.textContent = text;
      tip.hidden = false;
      const ids = (el.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter(Boolean);
      ids.push(tip.id);
      el.setAttribute("aria-describedby", ids.join(" "));
      if (tip.hasAttribute("popover") && !tip.matches(":popover-open"))
        tip.showPopover();
      watchOwner();
      position();
    };
    document.addEventListener(
      "pointerover",
      (e) => {
        if (e.pointerType === "touch" || onTouchUi()) {
          hide();
          return;
        }
        if (!owner?.contains(e.target)) show(e.target);
      },
      true,
    );
    document.addEventListener(
      "pointerout",
      (e) => {
        if (owner?.contains(e.target) && !owner.contains(e.relatedTarget))
          hide();
      },
      true,
    );
    document.addEventListener("focusin", (e) => show(e.target), true);
    document.addEventListener("focusout", () => hide(), true);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("keydown", hide, true);
    document.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    window.visualViewport?.addEventListener("resize", hide);
  }
  root.NeuroMapCreativeModules.help = { install };
})(globalThis);
