/* Creative boundaries: shared desktop/Android component. */
(function (root) {
  "use strict";
  const { tr } = root.NeuroMapCreativeModules.ui;
  function positionEditor(app) {
    const input = document.getElementById("nm-boundary-title-input");
    if (!input || input._app !== app) return;
    const node =
      app.state === input._owner && app.state.findNode(input._node.id);
    if (node !== input._node || !node.boundary?.enabled) {
      // Finish blur before removal: its handler may remove this same input.
      input.blur();
      input.remove();
      return;
    }
    const selection = app._nmBoundarySelection;
    const view = app.layout.viewNodes?.get(selection?.view?.id) || node;
    const box = app.layout.getSubtreeBoundingBox(view, false);
    if (!box) {
      // Finish blur before removal: its handler may remove this same input.
      input.blur();
      input.remove();
      return;
    }
    const point = app.renderer.worldToScreen(box.minX - 2, box.minY - 41);
    const width = Math.min(
      340,
      Math.max(170, (box.width + 32) * app.renderer.camera.zoom),
    );
    input.style.left =
      Math.max(8, Math.min(innerWidth - width - 8, point.x)) + "px";
    input.style.top = Math.max(8, Math.min(innerHeight - 44, point.y)) + "px";
    input.style.width = width + "px";
  }
  function boundaryDialog(app, node) {
    if (!node || node === app.state.root || !node.boundary?.enabled) return;
    document.getElementById("nm-boundary-title-input")?.blur();
    const input = document.createElement("input");
    input.id = "nm-boundary-title-input";
    input.className = "nm6-skiptranslate";
    input.maxLength = 110;
    input.value = node.boundary.title || "";
    input.placeholder = tr("Titolo del recinto", "Boundary title");
    input.setAttribute("aria-label", input.placeholder);
    input._app = app;
    input._owner = app.state;
    input._node = node;
    let finished = false;
    const finish = (save, focus = false) => {
      if (finished) return;
      finished = true;
      if (
        save &&
        app.state === input._owner &&
        app.state.findNode(node.id) === node &&
        node.boundary?.enabled
      ) {
        const title = input.value.trim();
        if (title !== (node.boundary.title || "")) {
          app.state.pushHistory();
          node.boundary = { ...node.boundary, title };
          app.markChanged();
        }
      }
      input.remove();
      if (focus) app.canvas.focus({ preventScroll: true });
    };
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if(e.isComposing||e.keyCode===229)return;
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true, true);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false, true);
      }
    });
    input.addEventListener("blur", () => finish(true));
    document.body.append(input);
    positionEditor(app);
    input.focus();
    input.select();
  }
  function boundaryHit(app, x, y) {
    const p = app.renderer.screenToWorld(x, y),
      slop = Math.max(10, 10 / app.renderer.camera.zoom);
    const nodes = app.layout.presentationRoot
      ? [...app.layout.viewNodes.values()]
      : app.state.getAllNodes();
    for (const n of [...nodes].reverse()) {
      if (!n.boundary?.enabled) continue;
      const b = app.layout.getSubtreeBoundingBox(n, false);
      if (!b) continue;
      const l = b.minX - 16,
        r = b.maxX + 16,
        t = b.minY - 14,
        bt = b.maxY + 14;
      const near =
        p.x >= l - slop &&
        p.x <= r + slop &&
        p.y >= t - slop &&
        p.y <= bt + slop &&
        Math.min(
          Math.abs(p.x - l),
          Math.abs(p.x - r),
          Math.abs(p.y - t),
          Math.abs(p.y - bt),
        ) <= slop;
      const ctx = app.layout.measureCtx;
      ctx.save();
      ctx.font = "600 13px Inter,system-ui,sans-serif";
      const width = Math.min(
        Math.max(85, ctx.measureText(n.boundary.title || "").width + 24),
        Math.max(110, b.width + 32),
      );
      ctx.restore();
      const title =
        n.boundary.title &&
        p.x >= l + 14 - slop &&
        p.x <= l + 14 + width + slop &&
        p.y >= t - 27 - slop &&
        p.y <= t - 3 + slop;
      if (near || title)
        return {
          node: app.state.findNode(n.logicalId || n.id),
          title: !!title,
          view: n,
        };
    }
    return null;
  }
  root.NeuroMapCreativeModules.boundaries = {
    boundaryDialog,
    boundaryHit,
    positionEditor,
  };
})(globalThis);
