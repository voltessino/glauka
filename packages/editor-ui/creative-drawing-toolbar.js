  function drawingToolbar(app,requestedTool=null) {
    if (root.NeuroMapWorkspaceLayout?.claim(app, "drawing") === false) return;
    const sidebar = document.getElementById("inspector-sidebar");
    if (sidebar && !sidebar.classList.contains("collapsed")) {
      app._nmDrawingRestoreInspector = true;
      sidebar.classList.add("collapsed");
    }
    let panel = document.getElementById("nm-drawing-toolbar");
    if (panel) {
      panel.hidden = false;
      app._nmDraw.active = true;
      app._nmDraw.owner = app.state;
      app.canvas.style.cursor =
        app._nmDraw.tool === "select" ? "default" : "crosshair";
      if(requestedTool)document.getElementById('nm-draw-'+requestedTool)?.click();
      root.NeuroMapWorkspaceLayout?.syncInkTools?.(app);
      return;
    }
    const state = (app._nmDraw = {
      active: true,
      owner: app.state,
      tool: "pen",
      path: null,
      selected: new Set(),
    });
    panel = document.createElement("section");
    panel.id = "nm-drawing-toolbar";
    panel.className = "nm6-skiptranslate";
    const tools = document.createElement("div");
    tools.className = "nm-drawing-tools";
    const shapeTrigger = button(
      "glauka-shapes-trigger",
      "Forme ▾",
      "Shapes ▾",
      () => {
        if (!shapeMenu.hidden) {
          closeShapes();
          return;
        }
        shapeMenu.hidden = false;
        if (nativePopover) shapeMenu.showPopover();
        const box = shapeTrigger.getBoundingClientRect();
        shapeMenu.style.left =
          Math.max(12, Math.min(innerWidth - 232, box.left)) + "px";
        shapeMenu.style.top =
          Math.max(12, Math.min(innerHeight - 190, box.bottom + 6)) + "px";
        shapeTrigger.setAttribute("aria-expanded", "true");
        shapeMenu.querySelector("button")?.focus();
      },
    );
    shapeTrigger.setAttribute("aria-haspopup", "menu");
    shapeTrigger.setAttribute("aria-expanded", "false");
    shapeTrigger.setAttribute("aria-controls", "glauka-shapes-menu");
    const shapeMenu = document.createElement("div");
    shapeMenu.id = "glauka-shapes-menu";
    shapeMenu.className = "glauka-shapes-menu";
    shapeMenu.hidden = true;
    shapeMenu.setAttribute("role", "menu");
    const nativePopover = typeof shapeMenu.showPopover === "function";
    if (nativePopover) shapeMenu.setAttribute("popover", "auto");
    const closeShapes = () => {
      if (nativePopover && shapeMenu.matches(":popover-open"))
        shapeMenu.hidePopover();
      shapeMenu.hidden = true;
      shapeTrigger.setAttribute("aria-expanded", "false");
    };
    state.closeShapes = closeShapes;
    shapeMenu.addEventListener("toggle", () => {
      if (nativePopover && !shapeMenu.matches(":popover-open")) {
        shapeMenu.hidden = true;
        shapeTrigger.setAttribute("aria-expanded", "false");
      }
    });
    shapeMenu.addEventListener("keydown", (e) => {
      e.stopPropagation();
      const items = [...shapeMenu.querySelectorAll("button")],
        i = items.indexOf(document.activeElement);
      if (e.key === "Escape") {
        e.preventDefault();
        closeShapes();
        shapeTrigger.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        items[
          (i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length
        ]?.focus();
      }
    });
    panel.append(shapeMenu);
    const choices = [
      ["select", "Seleziona più elementi", "Select multiple objects"],
      ["pen", "Penna", "Pen"],
      ["pencil", "Matita", "Pencil"],
      ["lasso", "Lazo", "Lasso"],
      ["eraser", "Gomma", "Eraser"],
      ["highlight", "Evidenziatore", "Highlighter"],
      ["rect", "Rettangolo", "Rectangle"],
      ["ellipse", "Ellisse", "Ellipse"],
      ["line", "Linea", "Line"],
      ["arrow", "Freccia", "Arrow"],
      ["text", "Testo", "Text"],
    ];
    for (const [id, it, en] of choices) {
      const b = button("nm-draw-" + id, it, en, () => {
        state.tool = id;
        root.NeuroMapWorkspaceLayout?.syncInkTools?.(app);
        state.path = null;
        for (const other of [
          ...tools.querySelectorAll("button"),
          ...shapeMenu.querySelectorAll("button"),
        ])
          other.setAttribute("aria-pressed", String(other === b));
        app.canvas.style.cursor = id === "select" ? "default" : "crosshair";
        text.label.hidden = !["rect", "ellipse", "text"].includes(id);
        shapeTrigger.setAttribute(
          "aria-pressed",
          String(["rect", "ellipse", "line", "arrow"].includes(id)),
        );
        closeShapes();
        drawPreview();
      });
      const mark = (body) =>
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
      const icons = {
        select: mark('<path d="M5.2 3.2v15.2l4.2-4.1 2.5 5.6 2.4-1.1-2.5-5.5h6.3z"/>'),
        pen: mark('<path d="M12 3.2c2 2.2 3.2 4.2 3.2 6 0 2.4-1.4 3.8-3.2 3.8S8.8 11.6 8.8 9.2c0-1.8 1.2-3.8 3.2-6z"/><path d="M12 13v6.2"/><path d="M9.4 19.6h5.2"/>'),
        pencil: mark('<path d="M15.4 3.6 20.4 8.6 8.6 20.4 3.4 21.2 4.2 16z"/><path d="M13.2 5.8 18.2 10.8"/><path d="M4.6 18.8 6.4 20.6"/>'),
        lasso: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.85\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><ellipse cx=\"12\" cy=\"9.5\" rx=\"7.5\" ry=\"5.5\" stroke-dasharray=\"3.2 2.4\"/><circle cx=\"9.5\" cy=\"15.2\" r=\"2\"/><path d=\"M8.1 16.7c-1.4 1.2-2.5 2.5-3.1 3.8\"/></svg>",
        eraser: mark('<path d="M4.2 14.2 10.8 7.6a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8l-4.8 4.8H7.2z"/><path d="M8.8 10.2 15.2 16.6"/><path d="M13.4 18.6H20"/>'),
        highlight: mark('<path d="M14.2 3.6 20.2 8.6 11.4 19 5.4 14z"/><path d="M7.2 14.4 12 18.6"/><path d="M3.4 21h13" stroke-width="2.6"/>'),
        rect: "□",
        ellipse: "○",
        line: "╱",
        arrow: "➜",
        text: "T",
      };
      const icon = document.createElement("span");
      icon.className = "nm-draw-tool-icon";
      if (String(icons[id]).startsWith("<svg")) icon.innerHTML = icons[id];
      else icon.textContent = icons[id];
      icon.setAttribute("aria-hidden", "true");
      const caption = document.createElement("span");
      caption.dataset.it = id === "select" ? "Seleziona" : it;
      caption.dataset.en = id === "select" ? "Select" : en;
      caption.textContent = tr(caption.dataset.it, caption.dataset.en);
      delete b.dataset.it;
      delete b.dataset.en;
      b.replaceChildren(icon, caption);
      b.setAttribute("aria-label", tr(it, en));
      if (id === "lasso") {
        const help = tr(
          "Lazo: seleziona più immagini e disegni racchiudendoli in un'area",
          "Lasso: select multiple images and drawings inside an outline",
        );
        b.title = help;
        b.setAttribute("aria-description", help);
      }
      b.setAttribute("aria-pressed", String(id === "pen"));
      if (["rect", "ellipse", "line", "arrow"].includes(id)) {
        b.setAttribute("role", "menuitem");
        shapeMenu.append(b);
      } else tools.append(b);
    }
    tools.append(shapeTrigger);
    const fields = document.createElement("div");
    fields.className = "nm-draw-fields";
    const color = field("nm-draw-color", "Colore", "Color", "color"),
      stroke = field("nm-draw-stroke", "Spessore", "Stroke width", "number"),
      text = field("nm-draw-text-input", "Testo nella forma", "Text in shape");
    color.input.value = "#38bdf8";
    stroke.input.value = 3;
    stroke.input.min = 1;
    stroke.input.max = 40;
    text.input.maxLength = 500;
    text.label.hidden = true;
    fields.append(color.label, stroke.label, text.label);
    const actions = document.createElement("div");
    actions.className = "nm-draw-actions";
    actions.append(
      button("nm-draw-group", "Raggruppa", "Group", () => group(app)),
      button("nm-draw-ungroup", "Separa", "Ungroup", () => ungroup(app)),
      button(
        "nm-draw-layer",
        "Davanti / dietro ai rami",
        "In front / behind branches",
        () => {
          const image = app.state.findImage(app.state.selectedImageId);
          if (image) {
            app.state.toggleImageZLayer(image.id);
            app.markChanged();
          }
        },
      ),
      button("nm-draw-edit", "Modifica elemento", "Edit object", () =>
        editGraphic(app),
      ),
      button("nm-draw-library", "Libreria personale", "Personal library", () =>
        libraryDialog(app),
      ),
      button("nm-draw-done", "Fine disegno", "Done drawing", () =>
        stopDrawing(app),
      ),
    );
    const help = document.createElement("small");
    help.dataset.it =
      "Trascina sulla mappa per disegnare. Usa Seleziona più elementi per raggrupparli. Esc termina il disegno.";
    help.dataset.en =
      "Drag on the map to draw. Use Select multiple objects to group them. Esc exits drawing.";
    help.textContent = tr(help.dataset.it, help.dataset.en);
    if(root.GlaukaTouchGuidance){
      help.removeAttribute("data-it");help.removeAttribute("data-en");
      help.dataset.glaukaTouchKey="drawing";
      help.textContent=root.GlaukaTouchGuidance.text("drawing");
    }
    const header = document.createElement("header");
    header.className = "nm-draw-header nm-side-panel-heading";
    const title = document.createElement("span");
    title.dataset.it = "Strumenti di disegno";
    title.dataset.en = "Drawing tools";
    title.textContent = tr(title.dataset.it, title.dataset.en);
    const close = button("nm-draw-close", "×", "×", () => stopDrawing(app));
    close.className = "nm-draw-close nm-panel-header-button";
    close.setAttribute(
      "aria-label",
      tr("Chiudi strumenti di disegno", "Close drawing tools"),
    );
    header.append(title, close);
    panel.append(header, tools, fields, help, actions);
    document.body.append(panel);
    app.canvas.style.cursor = "crosshair";
    const overlay = () => {
      let c = document.getElementById("nm-draw-preview");
      if (!c) {
        c = document.createElement("canvas");
        c.id = "nm-draw-preview";
        document.body.append(c);
      }
      c.width = innerWidth;
      c.height = innerHeight;
      return c;
    };
    const spec = (points) => {
      const minX = Math.min(...points.map((p) => p.x)),
        minY = Math.min(...points.map((p) => p.y)),
        maxX = Math.max(...points.map((p) => p.x)),
        maxY = Math.max(...points.map((p) => p.y)),
        pad = Math.max(20, Number(stroke.input.value) * 2),
        w = Math.max(40, maxX - minX + pad * 2),
        h = Math.max(40, maxY - minY + pad * 2);
      return {
        meta: core.graphic({
          kind: "shape",
          tool: state.tool==='pencil'?'pen':state.tool,
          color: color.input.value,
          stroke: state.tool==='pencil'?1.5:stroke.input.value,
          text: text.input.value,
          width: w,
          height: h,
          points: points.map((p) => [p.x - minX + pad, p.y - minY + pad]),
        }),
        position: { x: minX - pad + w / 2, y: minY - pad + h / 2 },
      };
    };
    const drawPreview = () => {
      const selected = app.state.findImage(app.state.selectedImageId);
      document.getElementById("nm-draw-group").disabled =
        state.selected.size < 2;
      document.getElementById("nm-draw-ungroup").disabled =
        selected?.graphic?.kind !== "group";
      document.getElementById("nm-draw-edit").disabled = !selected?.graphic;
      document.getElementById("nm-draw-layer").disabled = !selected;

      const c = overlay(),
        ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.strokeStyle = "#c4b5fd";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      for (const id of state.selected) {
        const image = app.state.findImage(id),
          r = image && app.renderer.resolveImageWorldRect(image);
        if (r) {
          const p = app.renderer.worldToScreen(r.x, r.y),
            z = app.renderer.camera.zoom;
          ctx.strokeRect(p.x - 4, p.y - 4, r.w * z + 8, r.h * z + 8);
        }
      }
      if (state.path?.length > 1) {
        const points = state.path.map((p) =>
          app.renderer.worldToScreen(p.x, p.y),
        );
        ctx.setLineDash([]);
        ctx.strokeStyle = color.input.value;
        ctx.lineWidth = Number(stroke.input.value) * app.renderer.camera.zoom;
        ctx.beginPath();
        if (state.tool === "rect")
          ctx.rect(
            Math.min(points[0].x, points.at(-1).x),
            Math.min(points[0].y, points.at(-1).y),
            Math.abs(points.at(-1).x - points[0].x),
            Math.abs(points.at(-1).y - points[0].y),
          );
        else if (state.tool === "ellipse")
          ctx.ellipse(
            (points[0].x + points.at(-1).x) / 2,
            (points[0].y + points.at(-1).y) / 2,
            Math.abs(points.at(-1).x - points[0].x) / 2,
            Math.abs(points.at(-1).y - points[0].y) / 2,
            0,
            0,
            Math.PI * 2,
          );
        else {
          ctx.moveTo(points[0].x, points[0].y);
          for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
    };
    app.canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (!state.active || state.owner !== app.state || e.button !== 0)
          return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (state.tool === "select"||state.tool==='eraser') {
          if(state.tool==='eraser'){
            const hit=app.findHit(e.clientX,e.clientY);
            let im=(hit?.type==='image'||hit?.type==='image-handle')&&hit.item?.graphic?hit.item:null;
            if(!im&&app.renderer?.screenToWorld&&app.renderer.resolveImageWorldRect){
              const point=app.renderer.screenToWorld(e.clientX,e.clientY);
              const radius=(Number(state.eraserSize)||18)/Math.max(.25,app.renderer.camera.zoom||1);
              let best=radius*radius;
              for(const image of app.state.images||[]){
                if(!image?.graphic)continue;
                const box=app.renderer.resolveImageWorldRect(image);
                if(!box)continue;
                const dx=box.cx-point.x,dy=box.cy-point.y,d=dx*dx+dy*dy;
                if(d<=best){best=d;im=image;}
              }
            }
            if(im&&app.state.deleteImage(im.id)){state.selected.delete(im.id);app.markChanged();}
            drawPreview();return;
          }
          const h = app.findHit(e.clientX, e.clientY);
          if (
            (h?.type === "image" || h?.type === "image-handle") &&
            h.item.graphic
          ) {
            state.selected.has(h.item.id)
              ? state.selected.delete(h.item.id)
              : state.selected.add(h.item.id);
            app.selectImage(h.item.id);
          }
          drawPreview();
          return;
        }
        app.closeEditor(true);
        state.path = [app.renderer.screenToWorld(e.clientX, e.clientY)];
        state.pointer = e.pointerId;
        state.tab = app.activeTabId;
        app.canvas.setPointerCapture(e.pointerId);
      },
      true,
    );
    app.canvas.addEventListener(
      "pointermove",
      (e) => {
        if (!state.active || !state.path || e.pointerId !== state.pointer)
          return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const p = app.renderer.screenToWorld(e.clientX, e.clientY);
        if (["pen", "pencil", "highlight", "lasso"].includes(state.tool)) {
          if (state.path.length < 4000) state.path.push(p);
        } else state.path = [state.path[0], p];
        drawPreview();
      },
      true,
    );
    const finish = (e, cancel) => {
      if (!state.active || !state.path || e.pointerId !== state.pointer) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const points = state.path;
      state.path = null;
      if(!cancel&&state.tool==='lasso'&&points.length>=3&&state.owner===app.state&&state.tab===app.activeTabId){
        const inside=(x,y)=>{let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
          const a=points[i],b=points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)hit=!hit;
        }return hit};
        state.selected.clear();
        for(const im of app.state.images){
          if(!im.graphic)continue;const r=app.renderer.resolveImageWorldRect(im);
          if(r&&inside(r.x+r.w/2,r.y+r.h/2))state.selected.add(im.id);
        }
        const last=state.selected.values().next().value;
        if(last)app.selectImage(last);
      }else if (
        !cancel &&
        state.owner === app.state &&
        state.tab === app.activeTabId &&
        (points.length > 1 || state.tool === "text")
      ) {
        if (points.length === 1)
          points.push({ x: points[0].x + 180, y: points[0].y + 60 });
        const { meta, position } = spec(points);
        addGraphic(
          app,
          core.shapeSVG(meta),
          meta.width,
          meta.height,
          meta,
          position,
        );
      }
      if (app.canvas.hasPointerCapture(e.pointerId))
        app.canvas.releasePointerCapture(e.pointerId);
      drawPreview();
    };
    app.canvas.addEventListener("pointerup", (e) => finish(e, false), true);
    app.canvas.addEventListener("pointercancel", (e) => finish(e, true), true);
    root.addEventListener(
      "keydown",
      (e) => {
        if (
          e.key === "Escape" &&
          state.active &&
          !document.querySelector(".nm-creative-shade")
        ) {
          e.preventDefault();
          stopDrawing(app);
        }
      },
      true,
    );
    root.addEventListener("blur", () => {
      state.path = null;
      if (state.active) drawPreview();
    });
    drawPreview();
    if(requestedTool)document.getElementById('nm-draw-'+requestedTool)?.click();
    root.NeuroMapWorkspaceLayout?.syncInkTools?.(app);
  }
