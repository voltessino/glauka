/* Optional Fast Canvas overlay paint culling: images and Bezier relationships.
 * The logical map, hit geometry, export render and classic renderer stay intact.
 */
(function(global){
 'use strict';
 const intersects=(box,v,pad=0)=>
  box.x<=v.maxX+pad && box.x+box.w>=v.minX-pad &&
  box.y<=v.maxY+pad && box.y+box.h>=v.minY-pad;
 function imageVisible(rect,image,renderer){
  if(!rect||!renderer._nmFastViewport)return true;
  // The selected/hovered image can draw attachment lines, badges and handles
  // outside the image body. Preserve that complete visual interaction.
  if(image.id===renderer.state.selectedImageId ||
     image.id===renderer.state.hoveredImageId)return true;
  const zoom=Math.max(.001,Number(renderer.camera?.zoom)||1);
  return intersects(rect,renderer._nmFastViewport,Math.max(24,36/zoom));
 }
 function curveVisible(curve,relation,renderer){
  const view=renderer._nmFastViewport;
  if(!view)return true;
  if(relation.id===renderer.state.selectedRelationshipId ||
     relation.id===renderer.state.hoveredRelationshipId)return true;
  const zoom=Math.max(.001,Number(renderer.camera?.zoom)||1);
  const pad=Math.max(48,48/zoom);
  const xs=[curve.x1,curve.x2,curve.cp1x,curve.cp2x];
  const ys=[curve.y1,curve.y2,curve.cp1y,curve.cp2y];
  const x0=Math.min(...xs),x1=Math.max(...xs);
  const y0=Math.min(...ys),y1=Math.max(...ys);
  // Every point on a cubic Bezier lies within the convex hull of its
  // endpoints and controls; this broadphase never crops a visible curve.
  if(intersects({x:x0,y:y0,w:x1-x0,h:y1-y0},view,pad))return true;
  // A very long label may intersect the screen even if the curve does not.
  if(curve.labelY < view.minY-pad-22||curve.labelY > view.maxY+pad+22)return false;
  const ctx=renderer.ctx;
  let labelWidth=54;
  if(ctx&&typeof ctx.measureText==='function'){
    // Use the same font as the regular renderer; preserve caller's ctx state.
    const previousFont=ctx.font;
    try {
      ctx.font='600 11.5px Inter, -apple-system, sans-serif';
      labelWidth=Math.max(54,Number(ctx.measureText(relation.label||'Relazione').width)+18||54);
    } finally {ctx.font=previousFont;}
  } else return true; // Conservative fallback for a nonstandard Canvas context.
  return intersects({x:curve.labelX-labelWidth/2,y:curve.labelY-11,
    w:labelWidth,h:22},view,pad);
 }
 function install(Renderer){
  if(!Renderer||Renderer.prototype._nmFastAuxInstalled)return;
  const proto=Renderer.prototype;
  proto._nmFastAuxInstalled=true;
  proto._nmFastAuxShouldPaintImage=function(rect,item){
    const metrics=this._nmFastAuxStats;
    if(metrics)metrics.imagesEligible++;
    const paint=imageVisible(rect,item,this);
    if(metrics&&paint)metrics.imagesPainted++;
    return paint;
  };
  proto._nmFastAuxShouldPaintRelationship=function(curve,rel){
    const metrics=this._nmFastAuxStats;
    if(metrics)metrics.relationshipsEligible++;
    const paint=curveVisible(curve,rel,this);
    if(metrics&&paint)metrics.relationshipsPainted++;
    return paint;
  };
  const originalRender=proto.render;
  proto.render=function(customCtx,customTransform){
    if(!customCtx&&!customTransform)global.NeuroMapFastCanvas?.syncAutoMode(this);
    const enabled=!!(this.highPerformanceCanvas&&!customCtx&&!customTransform);
    const previousActive=this._nmFastAuxActive;
    const previousMetrics=this._nmFastAuxStats;
    this._nmFastAuxActive=enabled;
    this._nmFastAuxStats=enabled?
      {imagesEligible:0,imagesPainted:0,relationshipsEligible:0,relationshipsPainted:0}:null;
    try {
      const result=originalRender.apply(this,arguments);
      if(enabled){
        const metrics=this._nmFastAuxStats;
        this.fastCanvasOverlayStats={...metrics};
        if(this.fastCanvasStatus){
          const english=global.document?.documentElement?.lang==='en';
          this.fastCanvasStatus.textContent+=' · '+
            metrics.imagesPainted+'/'+metrics.imagesEligible+
            ((globalThis.GlaukaI18n?.pair(" immagini"," images")??(english?' images':' immagini')))+' · '+
            metrics.relationshipsPainted+'/'+metrics.relationshipsEligible+
            ((globalThis.GlaukaI18n?.pair(" relazioni"," links")??(english?' links':' relazioni')));
        }
      }
      return result;
    }finally{
      this._nmFastAuxActive=previousActive;
      this._nmFastAuxStats=previousMetrics;
    }
  };
 }
 global.NeuroMapFastOverlayCanvas=Object.freeze({install,intersects,imageVisible,curveVisible});
})(window);
