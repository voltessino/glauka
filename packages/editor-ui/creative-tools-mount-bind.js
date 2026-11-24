  function bindShapeDrop(app){
    if(!app?.canvas||app._glaukaShapeDropBound)return;
    app._glaukaShapeDropBound=true;
    const type='application/x-glauka-shape';
    document.addEventListener('dragstart',e=>{
      const tile=e.target?.closest?.('[data-gl-shape]');
      const tool=tile?.dataset.glShape;
      if(!SHAPES.has(tool)||!e.dataTransfer)return;
      e.dataTransfer.setData(type,tool);
      e.dataTransfer.effectAllowed='copy';
    });
    app.canvas.addEventListener('dragover',e=>{
      if(Array.from(e.dataTransfer?.types||[]).includes(type)){
        e.preventDefault();e.dataTransfer.dropEffect='copy';
      }
    });
    app.canvas.addEventListener('drop',e=>{
      const tool=e.dataTransfer?.getData(type);
      if(!SHAPES.has(tool))return;
      e.preventDefault();e.stopPropagation();
      const size=['line','arrow','dashed'].includes(tool)?[160,76]:[160,96];
      const meta=core.graphic({kind:'shape',tool,color:'#a5b4fc',stroke:3,
        width:size[0],height:size[1]});
      const place=app.renderer.screenToWorld(e.clientX,e.clientY);
      addGraphic(app,core.shapeSVG(meta),meta.width,meta.height,meta,place);
    });
  }
