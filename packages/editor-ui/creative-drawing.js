/* Creative drawing: shared desktop/Android component. */
(function (root) {
  "use strict";
  const { core, tr, data, button, field, dialog, addGraphic, appliedBadge } =
    root.NeuroMapCreativeModules.ui;
  const { formulaDialog } = root.NeuroMapCreativeModules.formulas;
  function editGraphic(app) {
    const image = app.state.findImage(app.state.selectedImageId);
    if (!image?.graphic) return;
    if (image.graphic.kind === "formula") return formulaDialog(app, image);
    if (image.graphic.kind === "chart") return chartDialog(app,image);
    if (image.graphic.kind === "wordart") return wordArtDialog(app,image);
    if (image.graphic.kind === "group") return drawingToolbar(app);
    const d = dialog(
        app,
        "nm-shape-dialog",
        "Modifica disegno",
        "Edit drawing",
      ),
      text = field(
        "nm-shape-text",
        "Testo nella forma",
        "Text in shape",
        "textarea",
      ),
      color = field("nm-shape-color", "Colore", "Color", "color"),
      stroke = field("nm-shape-stroke", "Spessore", "Stroke width", "number");
    text.input.value = image.graphic.text;
    color.input.value = image.graphic.color;
    stroke.input.min = 1;
    stroke.input.max = 40;
    stroke.input.value = image.graphic.stroke;
    d.panel.append(
      text.label,
      color.label,
      stroke.label,
      button("nm-shape-save", "Aggiorna disegno", "Update drawing", () => {
        if (!d.valid() || !app.state.images.includes(image)) return;
        const meta = core.graphic({
          ...image.graphic,
          text: text.input.value,
          color: color.input.value,
          stroke: stroke.input.value,
        });
        app.state.pushHistory();
        Object.assign(image, { graphic: meta, src: data(core.shapeSVG(meta)) });
        app.markChanged();
        d.close();
      }),
    );
  }

  // Charts and WordArt are native editable SVG image objects. They reuse the
  // same drag, resize, attach, Undo, document and export paths as other graphics.
  // Keep the exact visual position when changing a chart or WordArt attachment.
  function setGraphicPlacement(app,image,attach,nodeId){
    const rect=app.renderer.resolveImageWorldRect(image),center=rect?{x:rect.cx,y:rect.cy}:{...image.worldPos};
    const target=app.state.findNode(nodeId)||app.state.root;
    if(attach&&target){const anchor=app.layout.getLayout(target.id);
      image.mode='attached';image.attachedNodeId=target.id;
      image.offset={dx:center.x-(anchor?.x||0),dy:center.y-(anchor?.y||0)};
    }else{image.mode='free';image.attachedNodeId=null;image.worldPos=center;}
  }

  function insertSmartGraphic(app,svg,meta,attach,nodeId){
    const target=attach?app.state.findNode(nodeId):null;
    const point=target?app.layout.getLayout(target.id):null;
    const screenCenter=typeof app.renderer.screenToWorld==='function'
      ?app.renderer.screenToWorld((root.innerWidth||1200)/2,(root.innerHeight||800)/2)
      :{x:0,y:0};
    const anchor=point?{x:point.x,y:point.y,width:point.width,height:point.height,side:target.side}:screenCenter;
    const obstacles=[];
    const layoutMap=app.layout?.nodeLayoutMap;
    if(layoutMap)for(const m of layoutMap.values()){
      if(Number.isFinite(m.x)&&Number.isFinite(m.y)&&m.width>0&&m.height>0)
        obstacles.push({x:m.x-m.width/2,y:m.y-m.height/2,w:m.width,h:m.height});
    }
    for(const img of app.state.images||[]){
      const r=app.renderer.resolveImageWorldRect(img);
      if(r)obstacles.push({x:r.x,y:r.y,w:r.w,h:r.h});
    }
    const position=core.suggestGraphicPlacement({
      anchor,width:meta.width,height:meta.height,obstacles,allowCenter:!point
    });
    const created=addGraphic(app,svg,meta.width,meta.height,meta,{x:position.x,y:position.y});
    if(!created)return null;
    if(point){
      setGraphicPlacement(app,created,true,target.id);
      app.markChanged();
    }else if(attach){
      app.showToast?.(tr('Ramo non visibile: elemento inserito libero.','Branch not visible: inserted as a free object.'),'GRAFICA');
    }
    // Avoid making users hunt for the new object on maps spanning many screens.
    // Pan only when the whole object is outside the current viewport.
    if(typeof root.innerWidth==='number'&&typeof root.innerHeight==='number'
      &&typeof app.renderer.worldToScreen==='function'&&app.renderer.camera){
      const rect=app.renderer.resolveImageWorldRect(created),zoom=app.renderer.camera.zoom;
      if(rect&&Number.isFinite(zoom)&&zoom>0){
        const screen=app.renderer.worldToScreen(rect.cx,rect.cy),
          left=screen.x-rect.w*zoom/2,right=screen.x+rect.w*zoom/2,
          top=screen.y-rect.h*zoom/2,bottom=screen.y+rect.h*zoom/2;
        if(right<0||left>root.innerWidth||bottom<0||top>root.innerHeight){
          app.renderer.camera.x+=root.innerWidth/2-screen.x;
          app.renderer.camera.y+=root.innerHeight/2-screen.y;
          app.requestRender?.();
          app.showToast?.(tr('Oggetto inserito in uno spazio libero: vista centrata.','Object placed in free space: view centered.'),'GRAFICA');
        }
      }
    }
    return created;
  }

/* @neuromap-creative-drawing-dialogs */
  function stopDrawing(app) {
    if (!app._nmDraw) return;
    app._nmDraw.active = false;
    root.NeuroMapWorkspaceLayout?.syncInkTools?.(app);
    app._nmDraw.path = null;
    app._nmDraw.closeShapes?.();
    document.getElementById("nm-draw-preview")?.remove();
    document.getElementById("nm-drawing-toolbar")?.setAttribute("hidden", "");
    app.canvas.style.cursor = "";
    app.canvas.style.touchAction = "";
    if (app._nmDrawingRestoreInspector) {
      document
        .getElementById("inspector-sidebar")
        ?.classList.remove("collapsed");
      app._nmDrawingRestoreInspector = false;
    }
  }
/* @neuromap-creative-drawing-toolbar */
  function group(app) {
    const selection = app._nmDraw?.selected || new Set(),
      images = app.state.images.filter(
        (im) => selection.has(im.id) && im.graphic,
      );
    if (images.length < 2) {
      app.showToast(
        tr("Seleziona almeno due disegni.", "Select at least two drawings."),
        "DISEGNO",
      );
      return;
    }
    const rects = images.map((im) => app.renderer.resolveImageWorldRect(im));
    if (rects.some((r) => !r)) return;
    const minX = Math.min(...rects.map((r) => r.x)),
      minY = Math.min(...rects.map((r) => r.y)),
      maxX = Math.max(...rects.map((r) => r.x + r.w)),
      maxY = Math.max(...rects.map((r) => r.y + r.h)),
      w = maxX - minX,
      h = maxY - minY;
    const members = images.map((im, i) => ({
      ...app.state.constructor.cloneImages([im])[0],
      worldPos: {
        x: rects[i].cx - (minX + w / 2),
        y: rects[i].cy - (minY + h / 2),
      },
      mode: "free",
      attachedNodeId: null,
    }));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${images.map((im, i) => `<image x="${rects[i].x - minX}" y="${rects[i].y - minY}" width="${rects[i].w}" height="${rects[i].h}" href="${core.esc(im.src)}"/>`).join("")}</svg>`;
    app.state.pushHistory();
    app.state.images = app.state.images.filter((im) => !selection.has(im.id));
    const image = app.state.addImageItem(
      {
        src: data(svg),
        width: w,
        height: h,
        naturalWidth: w,
        naturalHeight: h,
        graphic: { kind: "group", members },
        mode: "free",
        worldPos: { x: minX + w / 2, y: minY + h / 2 },
        frame: "none",
        borderRadius: 0,
      },
      false,
    );
    selection.clear();
    app.selectImage(image.id);
    app.markChanged();
    document.getElementById("nm-draw-preview")?.remove();
  }
  function ungroup(app) {
    const image = app.state.findImage(app.state.selectedImageId);
    if (image?.graphic?.kind !== "group") return;
    const r = app.renderer.resolveImageWorldRect(image);
    if (!r) return;
    const sx = image.width / Math.max(1, image.naturalWidth),
      sy = image.height / Math.max(1, image.naturalHeight);
    app.state.pushHistory();
    app.state.images = app.state.images.filter((im) => im !== image);
    for (const member of image.graphic.members)
      app.state.addImageItem(
        {
          ...member,
          id: app.state.generateId("img"),
          width: member.width * sx,
          height: member.height * sy,
          worldPos: {
            x: r.cx + (member.worldPos?.x || 0) * sx,
            y: r.cy + (member.worldPos?.y || 0) * sy,
          },
        },
        false,
      );
    app._nmDraw?.selected.clear();
    app.state.selectedImageId = null;
    app.markChanged();
    document.getElementById("nm-draw-preview")?.remove();
  }
  const LIBRARY = "neuromap.creative.library.v1";
  function readLibrary() {
    try {
      const list = JSON.parse(localStorage.getItem(LIBRARY) || "[]");
      return Array.isArray(list)
        ? list
            .filter(
              (entry) =>
                entry &&
                typeof entry.name === "string" &&
                entry.image?.graphic &&
                typeof entry.image.src === "string" &&
                entry.image.src.startsWith("data:image/"),
            )
            .slice(0, 50)
        : [];
    } catch {
      return [];
    }
  }
/* @neuromap-creative-drawing-library */

  root.NeuroMapCreativeModules.drawing = {
    editGraphic,
    chartDialog,
    wordArtDialog,
    stopDrawing,
    drawingToolbar,
    group,
    ungroup,
    libraryDialog,
  };
})(globalThis);
