    /**
     * ============================================================================
     * 4. ORGANIC iMINDMAP CANVAS RENDERER + HYBRID IMAGE & STRUCTURAL ENGINE
     * ============================================================================
     */
    class OrganicCanvasRenderer {
      constructor(canvas, layoutEngine, stateMachine) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.layout = layoutEngine;
        this.state = stateMachine;

        this.camera = {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
          zoom: 1
        };

        this.dpr = window.devicePixelRatio || 1;
        this.dragHoverNodeId = null;
        this.snapTargetNodeId = null;
        this.relationshipDraft = null;
        this.resize();
      }

      resize() {
        // Backing-store pixels cost at least four bytes each (often more on GPU).
        // Cap huge/high-DPI viewports without changing CSS sizing or world coordinates.
        const viewportWidth = Number(window.innerWidth);
        const viewportHeight = Number(window.innerHeight);
        const cssWidth = Number.isFinite(viewportWidth) && viewportWidth > 0
          ? Math.max(1, Math.floor(viewportWidth)) : 1;
        const cssHeight = Number.isFinite(viewportHeight) && viewportHeight > 0
          ? Math.max(1, Math.floor(viewportHeight)) : 1;
        const physicalDpr = Number(window.devicePixelRatio);
        const preferredDpr = Number.isFinite(physicalDpr) && physicalDpr > 0
          ? physicalDpr : 1;
        const maxPixels = 8000000;
        const ratio = Math.min(preferredDpr,
          Math.sqrt(maxPixels / (cssWidth * cssHeight)),
          8192 / cssWidth, 8192 / cssHeight);
        const width = Math.max(1, Math.floor(cssWidth * ratio));
        const height = Math.max(1, Math.floor(cssHeight * ratio));
        const scaleX = width / cssWidth;
        const scaleY = height / cssHeight;
        // 125% and 150% often leave a fractional device pixel. Draw at the
        // tighter whole-pixel scale so the browser does not resample the bitmap.
        // Exact products keep the physical DPR the backing-store tests lock.
        const aligned = Math.abs(scaleX - ratio) < 1e-6 && Math.abs(scaleY - ratio) < 1e-6;
        this.dpr = aligned ? ratio : Math.min(scaleX, scaleY);
        const bufferW = aligned ? width : Math.max(1, Math.round(cssWidth * this.dpr));
        const bufferH = aligned ? height : Math.max(1, Math.round(cssHeight * this.dpr));
        // Setting either attribute destroys the 2D context state and backing
        // allocation. No-op for repeated same-size resize/orientation events.
        if (this.canvas.width !== bufferW) this.canvas.width = bufferW;
        if (this.canvas.height !== bufferH) this.canvas.height = bufferH;
      }

      screenToWorld(sx, sy) {
        return {
          x: (sx - this.camera.x) / this.camera.zoom,
          y: (sy - this.camera.y) / this.camera.zoom
        };
      }

      worldToScreen(wx, wy) {
        return {
          x: wx * this.camera.zoom + this.camera.x,
          y: wy * this.camera.zoom + this.camera.y
        };
      }

      // Glyphs and icon boxes only. World layout, hit testing and saved
      // coordinates stay where the layout engine put them. The shift is at
      // most half a device pixel, and only while the live camera transform
      // is on the canvas (export uses its own scale).
      devicePoint(x, y) {
        const zoom = this.camera && this.camera.zoom;
        const dpr = this.dpr;
        if (!this._nmSnapGlyphs || !(zoom > 0) || !(dpr > 0) || !Number.isFinite(x) || !Number.isFinite(y)) {
          return { x, y };
        }
        const camX = Number.isFinite(this.camera.x) ? this.camera.x : 0;
        const camY = Number.isFinite(this.camera.y) ? this.camera.y : 0;
        return {
          x: (Math.round((x * zoom + camX) * dpr) / dpr - camX) / zoom,
          y: (Math.round((y * zoom + camY) * dpr) / dpr - camY) / zoom
        };
      }

      deviceLen(length) {
        const zoom = this.camera && this.camera.zoom;
        const dpr = this.dpr;
        if (!this._nmSnapGlyphs || !(zoom > 0) || !(dpr > 0) || !(length > 0)) return length;
        return Math.max(1 / (zoom * dpr), Math.round(length * zoom * dpr) / (zoom * dpr));
      }

      async prepareExportImages(){
        const sources=new Set((this.state.images||[]).map(i=>i.src).filter(Boolean));
        const walk=n=>{if(n.illustration?.svg)sources.add(nm54IconUri(n.illustration));if(n.objectArt?.id){const url=globalThis.NeuroMapCreativeCore?.objectURL(n.objectArt.id);if(url)sources.add(url);}if(!n.collapsed)(n.children||[]).forEach(walk);};walk(this.state.root);
        await Promise.all([...sources].map(src=>{this.getOrLoadImage(src);const image=imageCache.get(src);
          if(!image||image.complete)return Promise.resolve();
          return new Promise(resolve=>{const done=()=>{image.removeEventListener('load',done);image.removeEventListener('error',done);resolve();};image.addEventListener('load',done);image.addEventListener('error',done);});
        }));
      }

      releaseClosedRasterImages(candidates, retained) {
        return ColorUtils.releaseClosedRasterImages(candidates, retained);
      }

      getOrLoadImage(src) {
        if (!src || (this._nmPreviewNoDecode && !imageCache.has(src))) return null;
        if (imageCache.has(src)) {
          const cached = touchCachedImage(src);
          return cached.complete && cached.naturalWidth > 0 ? cached : null;
        }
        const img = new Image();
        rememberCachedImage(src, img);
        img.onload = () => {
          this.state.images.forEach((item) => {
            if (item.src === src && !item.aspectLocked) {
              item.naturalWidth = img.naturalWidth;
              item.naturalHeight = img.naturalHeight;
              const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
              item.width = Math.max(35, item.width || 135);
              item.height = Math.round(item.width / ratio);
              item.aspectLocked = true;
            }
          });
          requestAnimationFrame(() => this.render());
        };
        img.src = src;
        return null;
      }

      resolveImageWorldRect(imgItem) {
        let cx = imgItem.worldPos?.x ?? 0;
        let cy = imgItem.worldPos?.y ?? 0;
        let anchorX = null;
        let anchorY = null;

        if (imgItem.mode === 'attached' && imgItem.attachedNodeId) {
          const nodeMetrics = this.layout.getLayout(imgItem.attachedNodeId);
          if (!nodeMetrics) return null;
          anchorX = nodeMetrics.x;
          anchorY = nodeMetrics.y;
          cx = nodeMetrics.x + (imgItem.offset?.dx ?? 0);
          cy = nodeMetrics.y + (imgItem.offset?.dy ?? -84);
        }

        const w = Number(imgItem.width || 135);
        const h = Number(imgItem.height || 100);
        const x = cx - w / 2;
        const y = cy - h / 2;

        const handleSize = Math.max(7, 12 / Math.max(0.15, this.camera.zoom));
        const handles = [
          { corner: 'nw', x: x, y: y, cursor: 'nwse-resize' },
          { corner: 'ne', x: x + w, y: y, cursor: 'nesw-resize' },
          { corner: 'se', x: x + w, y: y + h, cursor: 'nwse-resize' },
          { corner: 'sw', x: x, y: y + h, cursor: 'nesw-resize' }
        ];

        return { x, y, w, h, cx, cy, anchorX, anchorY, handleSize, handles };
      }

      drawAmbientGrid() {
        const ctx = this.ctx;
        const step = 42 * this.camera.zoom;
        if (step < 14) return;

        const offsetX = this.camera.x % step;
        const offsetY = this.camera.y % step;

        ctx.save();
        ctx.fillStyle = 'rgba(148, 163, 184, 0.13)';
        const w = window.innerWidth;
        const h = window.innerHeight;

        for (let x = offsetX; x < w; x += step) {
          for (let y = offsetY; y < h; y += step) {
            ctx.beginPath();
            ctx.arc(x, y, 1.1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      drawThresholdGuides() {
        // The obsolete fixed-height limits do not represent adaptive layout.
        const ctx=this.ctx;
        ctx.save();ctx.setLineDash([6,6]);ctx.lineWidth=1/this.camera.zoom;
        ctx.strokeStyle='rgba(148,163,184,0.07)';
        ctx.beginPath();ctx.moveTo(0,-1400);ctx.lineTo(0,1400);ctx.stroke();ctx.restore();
      }

      computeBranchGeometry(parent, child, siblingIndex = 0, totalSiblings = 1) {
        const pLayout = this.layout.getLayout(parent.id);
        const cLayout = this.layout.getLayout(child.id);
        if (!pLayout || !cLayout) return null;

        const dir = child.side === 'right' ? 1 : -1;
        const isRootParent = parent.side === 'root';

        const u = totalSiblings > 1 ? siblingIndex / (totalSiblings - 1) : 0.5;
        const fanFactor = u - 0.5;

        let startX, startY;
        if (isRootParent) {
          startX = pLayout.x + dir * (pLayout.width * 0.36);
          startY = pLayout.y + fanFactor * Math.min(pLayout.height * 0.42, 22);
        } else {
          startX = pLayout.attachOutX;
          startY = pLayout.attachOutY;
        }

        const scale = this.state.strokeScale || 1;
        const style=this.state.branchStyle||'neon';
        const baseStart = isRootParent ? 15 : Math.max(4.5,11-pLayout.depth*2.2);
        const baseEnd = Math.max(2.0,5.5-cLayout.depth*.9);
        const schemes={
          neon:[1,1],
          buzan:[isRootParent?2.7:Math.max(1.5,2.4-pLayout.depth*.22),1.5],
          thickparents:[isRootParent?3.0:Math.max(1.5,2.6-pLayout.depth*.25),1.25],
          radial:[2.5,1.25],
          xmind8:[0.34,0.50],
          simple:[0.55,0.57]
        };
        const factors=schemes[style]||schemes.neon;
        const siblingCount=Math.max(1,totalSiblings||1);
        // A fan of thick ribbons must NEVER add up to an enormous solid wedge.
        // Saturation is gradual and depends on the number of siblings.
        const ribbonStart=baseStart*factors[0]*scale;
        const startCap=Math.min(pLayout.height*.8,(isRootParent?26:21)*Math.sqrt(scale)/(1+0.12*(siblingCount-1)));
        const startWidth=Math.max(1.2,Math.min(ribbonStart,startCap));
        const endWidth=Math.max(1.1,Math.min(baseEnd*factors[1]*scale,9*Math.sqrt(scale)));

        let endX = cLayout.attachInX;
        const endY = cLayout.attachInY;
        // Attached artwork can push one sibling farther outward. Finish its
        // curve in the common connection lane, then extend the horizontal
        // underline to the label. Otherwise the diagonal cuts across siblings.
        // Derive the lane in O(1); do not scan siblings on every painted edge.
        if (!isRootParent && totalSiblings > 1) {
          const occupied = (dir === 1 ? pLayout._nmOccupiedRight : pLayout._nmOccupiedLeft) ?? pLayout.width / 2;
          const gap = Number.isFinite(this.layout.levelGapX) ? Math.max(0, this.layout.levelGapX) : 30;
          const clearance = Math.max(startWidth, endWidth) / 2 + 2;
          const laneX = startX + dir * Math.max(0, Math.max(0, occupied - pLayout.width / 2) + gap - clearance);
          if (dir * (endX - laneX) > 0) endX = laneX;
        }
        const underlineEndX = cLayout.attachOutX;
        const underlineEndY = cLayout.attachOutY;

        const dx = endX - startX;
        const dy = endY - startY;
        const absDx = Math.abs(dx);

        const cp1OffsetX = Math.min(absDx, Math.max(24, absDx * 0.45));
        const cp1x = startX + dir * cp1OffsetX;


        const cp1y = startY;

        const cp2FilletRadius = Math.min(absDx, Math.max(12, absDx * 0.48));
        const cp2x = endX - dir * cp2FilletRadius;
        const cp2y = endY;

        return {
          pLayout,
          cLayout,
          dir,
          startX,
          startY,
          endX,
          endY,
          underlineEndX,
          underlineEndY,
          cp1x,
          cp1y,
          cp2x,
          cp2y,
          startWidth,
          endWidth
        };
      }

      radialRibbon(parent,child){
        const p=this.layout.getLayout(parent.id),c=this.layout.getLayout(child.id);
        if(!p||!c)return null;
        const dx=c.x-p.x,dy=c.y-p.y,len=Math.hypot(dx,dy);
        if(len<1)return null;
        const ux=dx/len,uy=dy/len,nx=-uy,ny=ux;
        const pInset=parent.side==='root'?Math.min(p.width,p.height)*0.25:Math.min(p.width,p.height)*0.14;
        const cInset=Math.min(c.width,c.height)*0.2;
        const start={x:p.x+ux*pInset,y:p.y+uy*pInset};
        const end={x:c.x-ux*cInset,y:c.y-uy*cInset};
        const extent=Math.hypot(end.x-start.x,end.y-start.y);
        const turn=(Math.sin(Math.atan2(dy,dx)*2)*0.06)*extent;
        const control={x:(start.x+end.x)/2+nx*turn,y:(start.y+end.y)/2+ny*turn};
        const depth=c.depth||1,scale=this.state.strokeScale||1;
        const wide=(parent.side==='root'?48:Math.max(12,34-depth*4.2))*scale;
        const thin=Math.max(2.2,7-depth*.7)*scale;
        const left=[],right=[];
        const samples=Math.max(32,Math.min(1024,Math.ceil(extent/2)));
        for(let i=0;i<=samples;i++){
          const t=i/samples,one=1-t;
          const x=one*one*start.x+2*one*t*control.x+t*t*end.x;
          const y=one*one*start.y+2*one*t*control.y+t*t*end.y;
          const tx=2*one*(control.x-start.x)+2*t*(end.x-control.x);
          const ty=2*one*(control.y-start.y)+2*t*(end.y-control.y);
          const tl=Math.max(.0001,Math.hypot(tx,ty)),nxx=-ty/tl,nyy=tx/tl;
          const width=(wide*Math.pow(one,1.25)+thin*t)*0.5;
          left.push({x:x+nxx*width,y:y+nyy*width});
          right.push({x:x-nxx*width,y:y-nyy*width});
        }
        return {points:[...left,...right.reverse()],start,end};
      }

      drawTaperingBranch(parent, child, siblingIndex = 0, totalSiblings = 1) {
        const childColor = child.color || (parent && parent.color) || '#6366f1';
        const baseColor = (parent.side === 'root' ? childColor : (parent.color || childColor)) || '#6366f1';
        if(this.state.branchStyle==='radial'){
          const shape=this.radialRibbon(parent,child);
          if(shape){const ctx=this.ctx,pts=shape.points;
            ctx.save();const gradient=ctx.createLinearGradient(shape.start.x,shape.start.y,shape.end.x,shape.end.y);
            gradient.addColorStop(0, baseColor);
            gradient.addColorStop(1, childColor);
            ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
            for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);
            ctx.closePath();ctx.fill();ctx.restore();}
          if(!child.collapsed){const reg=(child.children||[]).filter(n=>!n.isSummary);
            reg.forEach((c,i)=>this.drawTaperingBranch(child,c,i,reg.length));}
          return;
        }
        const g = this.computeBranchGeometry(parent, child, siblingIndex, totalSiblings);
        if (!g) return;

        const ctx = this.ctx;
        ctx.save();

        const grad = ctx.createLinearGradient(g.startX, g.startY, g.underlineEndX, g.underlineEndY);
        grad.addColorStop(0, baseColor);
        grad.addColorStop(1, childColor);

        ctx.strokeStyle = childColor;
        if(['elbow','straight','arc'].includes(this.state.branchStyle)||['dashed','wave','fork'].includes(this.state.branchStyle)){
          // Shape controls the PATH. Stroke width is independent and handled
          // exclusively by the existing "Spessore" slider.
          const shape=this.state.branchStyle;
          const width=Math.max(.8,2.6*(this.state.strokeScale||1));
          ctx.strokeStyle=grad;ctx.lineWidth=width;
          ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
          ctx.moveTo(g.startX,g.startY);
          if(shape==='straight'){
            ctx.lineTo(g.endX,g.endY);
          }else if(shape==='dashed'){
            ctx.setLineDash([10,6]);
            ctx.bezierCurveTo(g.cp1x,g.cp1y,g.cp2x,g.cp2y,g.endX,g.endY);
          }else if(shape==='wave'){
            const dx=g.endX-g.startX,dy=g.endY-g.startY;
            ctx.bezierCurveTo(g.startX+dx*.28,g.startY-dy*.65,g.startX+dx*.68,g.endY+dy*.55,g.endX,g.endY);
          }else if(shape==='fork'){
            const mid=g.startX+(g.endX-g.startX)*.52;
            ctx.lineTo(mid,g.startY);ctx.lineTo(g.endX,g.endY);
          }else if(shape==='elbow'){
            // Small rounded corners instead of a sharp, overlapping wedge.
            const mid=g.startX+(g.endX-g.startX)*.52;
            const r=Math.min(13,Math.abs(g.endX-g.startX)*.18,Math.abs(g.endY-g.startY)*.46);
            if(r<1){ctx.lineTo(mid,g.startY);ctx.lineTo(mid,g.endY);ctx.lineTo(g.endX,g.endY)}
            else{
              const sign=Math.sign(g.endY-g.startY)||1;
              ctx.lineTo(mid-g.dir*r,g.startY);
              ctx.quadraticCurveTo(mid,g.startY,mid,g.startY+sign*r);
              ctx.lineTo(mid,g.endY-sign*r);
              ctx.quadraticCurveTo(mid,g.endY,mid+g.dir*r,g.endY);
              ctx.lineTo(g.endX,g.endY);
            }
          }else{
            // Outward-facing broad arc; distinct from the S-like neon cubic.
            const bow=(g.endY-g.startY)*.52;
            ctx.quadraticCurveTo((g.startX+g.endX)*.5,g.startY+bow*1.35,g.endX,g.endY);
          }
          ctx.lineTo(g.underlineEndX,g.underlineEndY);
          ctx.stroke();
          if(shape==='dashed')ctx.setLineDash([]);
        }else if(this.state.branchStyle==='neon'){
          // Uniform cubic tube. Thickness follows the slider; the path stays an even S.
          const width=Math.max(1.8,3.1*(this.state.strokeScale||1)),half=width/2,steps=28,upper=[],lower=[];
          for(let i=0;i<=steps;i++){
            const t=i/steps,u=1-t;
            const x=u*u*u*g.startX+3*u*u*t*g.cp1x+3*u*t*t*g.cp2x+t*t*t*g.endX;
            const y=u*u*u*g.startY+3*u*u*t*g.cp1y+3*u*t*t*g.cp2y+t*t*t*g.endY;
            const tx=3*u*u*(g.cp1x-g.startX)+6*u*t*(g.cp2x-g.cp1x)+3*t*t*(g.endX-g.cp2x);
            const ty=3*u*u*(g.cp1y-g.startY)+6*u*t*(g.cp2y-g.cp1y)+3*t*t*(g.endY-g.cp2y);
            const len=Math.hypot(tx,ty)||1,nx=-ty/len,ny=tx/len;
            upper.push([x+nx*half,y+ny*half]);lower.push([x-nx*half,y-ny*half]);
          }
          ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(upper[0][0],upper[0][1]);
          for(let i=1;i<upper.length;i++)ctx.lineTo(upper[i][0],upper[i][1]);
          for(let i=lower.length-1;i>=0;i--)ctx.lineTo(lower[i][0],lower[i][1]);
          ctx.closePath();ctx.fill();
          ctx.strokeStyle=grad;ctx.lineWidth=g.endWidth;ctx.lineCap='round';
          ctx.beginPath();ctx.moveTo(g.endX,g.endY);ctx.lineTo(g.underlineEndX,g.underlineEndY);ctx.stroke();
        }else if(this.state.branchStyle==='thickparents'){
          const trunkX=g.startX+(g.endX-g.startX)*0.28,span=Math.abs(g.endX-trunkX);
          ctx.strokeStyle=grad;ctx.lineWidth=Math.max(2.2,5.4*(this.state.strokeScale||1));
          ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
          ctx.moveTo(g.startX,g.startY);ctx.lineTo(trunkX,g.startY);
          ctx.bezierCurveTo(trunkX+g.dir*span*0.62,g.startY,g.endX-g.dir*span*0.16,g.endY,g.endX,g.endY);
          ctx.lineTo(g.underlineEndX,g.underlineEndY);ctx.stroke();
        }else if(this.state.branchStyle==='xmind8'){
          const stubX=g.startX+(g.endX-g.startX)*0.18,span=Math.abs(g.endX-stubX);
          ctx.lineWidth=1.7*(this.state.strokeScale||1);ctx.lineCap='round';ctx.lineJoin='round';
          ctx.beginPath();ctx.moveTo(g.startX,g.startY);ctx.lineTo(stubX,g.startY);
          ctx.bezierCurveTo(stubX+g.dir*span*0.7,g.startY,g.endX-g.dir*span*0.08,g.endY,g.endX,g.endY);
          ctx.lineTo(g.underlineEndX,g.underlineEndY);ctx.stroke();
        }else if(this.state.branchStyle==='simple'){
          const dx=g.endX-g.startX,dy=g.endY-g.startY;
          ctx.lineWidth=1.35*(this.state.strokeScale||1);ctx.lineCap='round';ctx.beginPath();
          ctx.moveTo(g.startX,g.startY);
          ctx.bezierCurveTo(g.startX+dx*0.46,g.startY+dy*0.06,g.endX-dx*0.22,g.endY-dy*0.06,g.endX,g.endY);
          ctx.lineTo(g.underlineEndX,g.underlineEndY);ctx.stroke();
        }else{
          ctx.fillStyle = grad;
          ctx.fill(NeuroMapGraphics.ribbonShape(g,child));
          ctx.strokeStyle = grad;
          ctx.lineWidth = g.endWidth;
          ctx.lineCap = 'round';
          ctx.beginPath();ctx.moveTo(g.endX,g.endY);
          ctx.lineTo(g.underlineEndX,g.underlineEndY);ctx.stroke();
        }

        ctx.restore();

        if (!child.collapsed && child.children && child.children.length > 0) {
          const regularGrandChildren = child.children.filter(gc => !gc.isSummary);
          const totalGrandChildren = regularGrandChildren.length;
          regularGrandChildren.forEach((grandChild, idx) => {
            this.drawTaperingBranch(child, grandChild, idx, totalGrandChildren);
          });

          const summaryGrandChildren = child.children.filter(gc => gc.isSummary);
          summaryGrandChildren.forEach((sumNode) => {
            if (!sumNode.collapsed && sumNode.children && sumNode.children.length > 0) {
              const reg = sumNode.children.filter(c => !c.isSummary);
              reg.forEach((gc, idx) => this.drawTaperingBranch(sumNode, gc, idx, reg.length));
            }
          });
        }
      }

      drawBoundariesRecursive(node) {
        if (!node) return;

        if (node.boundary && node.boundary.enabled) {
          const box = this.layout.getSubtreeBoundingBox(node, false);
          if (box) {
            const ctx = this.ctx;
            const padX = 16;
            const padY = 14;
            const bx = box.minX - padX;
            const by = box.minY - padY;
            const bw = box.width + padX * 2;
            const bh = box.height + padY * 2;
            const bColor = node.boundary.color || node.color || '#a855f7';

            ctx.save();
            ctx.shadowColor = ColorUtils.rgba(bColor, 0.35);
            ctx.shadowBlur = this.hoveredBoundaryId === (node.logicalId || node.id) ? 22 : 8;

            this.roundRectPath(bx, by, bw, bh, 18);
            ctx.fillStyle = ColorUtils.rgba(bColor, 0.09);
            ctx.fill();

            ctx.setLineDash([7, 5]);
            ctx.lineWidth = this.hoveredBoundaryId === (node.logicalId || node.id) ? 3 / this.camera.zoom : 1.8;
            ctx.strokeStyle = ColorUtils.rgba(bColor, this.hoveredBoundaryId === (node.logicalId || node.id) ? 1 : 0.78);
            ctx.stroke();
            ctx.setLineDash([]);
            const caption=String(node.boundary.title||'').trim().slice(0,110);
            if(caption){
              ctx.font='600 13px Inter,system-ui,sans-serif';
              const tw=Math.min(Math.max(85,ctx.measureText(caption).width+24),Math.max(110,bw));
              const tx=bx+14,ty=by-27;
              ctx.shadowBlur=5;ctx.fillStyle='#111a31';ctx.strokeStyle=ColorUtils.rgba(bColor,.75);
              this.roundRectPath(tx,ty,tw,24,8);ctx.fill();ctx.lineWidth=1;ctx.stroke();
              ctx.shadowBlur=0;ctx.fillStyle='#eef2ff';ctx.textBaseline='middle';
              const cap=this.devicePoint(tx+12,ty+12);
              ctx.fillText(caption,cap.x,cap.y,tw-22);
            }
            ctx.restore();
          }
        }

        if (!node.collapsed && node.children) {
          node.children.forEach(c => this.drawBoundariesRecursive(c));
        }
      }

      drawSummariesRecursive(node) {
        if (!node || node.collapsed || !node.children) return;
        const ctx = this.ctx;

        node.children.forEach((child) => {
          if (child.isSummary) {
            const sLayout = this.layout.getLayout(child.id);
            const bg = sLayout && sLayout.bracketGeom;
            if (bg) {
              const { dir, baseX, tipX, minY, maxY, midY } = bg;
              const strokeColor = child.color || '#10b981';
              const midSpanX = (baseX + tipX) / 2;
              const cornerR = Math.min(14, Math.max(4, (maxY - minY) / 4));

              ctx.save();
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = 2.4 * (this.state.strokeScale || 1);
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.shadowColor = ColorUtils.rgba(strokeColor, 0.35);
              ctx.shadowBlur = 8;

              ctx.beginPath();
              ctx.moveTo(baseX, minY);
              ctx.quadraticCurveTo(midSpanX, minY, midSpanX, minY + cornerR);
              ctx.lineTo(midSpanX, midY - cornerR);
              ctx.quadraticCurveTo(midSpanX, midY, tipX, midY);
              ctx.quadraticCurveTo(midSpanX, midY, midSpanX, midY + cornerR);
              ctx.lineTo(midSpanX, maxY - cornerR);
              ctx.quadraticCurveTo(midSpanX, maxY, baseX, maxY);
              ctx.stroke();

              ctx.beginPath();
              ctx.moveTo(tipX, midY);
              ctx.lineTo(sLayout.x - dir * (sLayout.width / 2), midY);
              ctx.stroke();
              ctx.restore();
            }
          }
          this.drawSummariesRecursive(child);
        });
      }

      computeRelationshipCurve(fromLayout, toLayout) {
        const geo = globalThis.NeuroMapCanvasGeometry;
        if (geo && fromLayout && toLayout && Number.isFinite(fromLayout.x) && Number.isFinite(toLayout.x))
          return geo.computeSmartSpline(geo.rectFromLayout(fromLayout), geo.rectFromLayout(toLayout));
        const x1 = fromLayout.x;
        const y1 = fromLayout.y;
        const x2 = toLayout.x;
        const y2 = toLayout.y;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.max(1, Math.hypot(dx, dy));

        const nx = -dy / dist;
        const ny = dx / dist;
        const curvature = Math.min(110, Math.max(42, dist * 0.24));

        const cp1x = x1 + dx * 0.25 + nx * curvature;
        const cp1y = y1 + dy * 0.25 + ny * curvature;
        const cp2x = x1 + dx * 0.75 + nx * curvature;
        const cp2y = y1 + dy * 0.75 + ny * curvature;

        const labelX = 0.125 * x1 + 0.375 * cp1x + 0.375 * cp2x + 0.125 * x2;
        const labelY = 0.125 * y1 + 0.375 * cp1y + 0.375 * cp2y + 0.125 * y2;

        return { x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y, labelX, labelY };
      }

      drawRelationshipsLayer() {
        const ctx = this.ctx;

        if (Array.isArray(this.state.relationships)) {
          this.state.relationships.forEach((rel) => {
            const fromL = this.layout.getLayout(rel.fromId);
            const toL = this.layout.getLayout(rel.toId);
            if (!fromL || !toL) return;

            const curve = this.computeRelationshipCurve(fromL, toL);
            rel._runtimeCurve = curve;

            const isSelected = this.state.selectedRelationshipId === rel.id;
            const isHovered = this.state.hoveredRelationshipId === rel.id;
            const color = rel.color || '#f43f5e';

            ctx.save();
            ctx.shadowColor = ColorUtils.rgba(color, isSelected ? 0.4 : 0.18);
            ctx.shadowBlur = isSelected ? 6 : 0;
            ctx.strokeStyle = isSelected ? '#ffffff' : color;
            ctx.lineWidth = isSelected ? 2.8 : (isHovered ? 2.4 : 2);
            ctx.setLineDash([6, 4]);

            ctx.beginPath();
            ctx.moveTo(curve.x1, curve.y1);
            ctx.bezierCurveTo(curve.cp1x, curve.cp1y, curve.cp2x, curve.cp2y, curve.x2, curve.y2);
            ctx.stroke();
            ctx.setLineDash([]);
            if(!this._nmNavExport)globalThis.NeuroMapCanvasGeometry?.paintDirection?.(ctx,curve,{emphasize:isSelected||isHovered,zoom:this.camera.zoom});

            const angle = Math.atan2(curve.y2 - curve.cp2y, curve.x2 - curve.cp2x);
            const headLen = 11;
            ctx.fillStyle = isSelected ? '#ffffff' : color;
            ctx.beginPath();
            ctx.moveTo(curve.x2, curve.y2);
            ctx.lineTo(
              curve.x2 - headLen * Math.cos(angle - Math.PI / 6),
              curve.y2 - headLen * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              curve.x2 - headLen * Math.cos(angle + Math.PI / 6),
              curve.y2 - headLen * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();

            const labelText = rel.label || 'Relazione';
            ctx.font = '600 11.5px Inter, -apple-system, sans-serif';
            const textW = ctx.measureText(labelText).width;
            const pillW = Math.max(54, textW + 18);
            const pillH = 22;

            this.roundRectPath(curve.labelX - pillW / 2, curve.labelY - pillH / 2, pillW, pillH, 11);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
            ctx.fill();
            ctx.lineWidth = isSelected ? 2 : 1.3;
            ctx.strokeStyle = isSelected ? '#ffffff' : color;
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const label=this.devicePoint(curve.labelX, curve.labelY + 0.5);
            ctx.fillText(labelText, label.x, label.y);
            ctx.restore();
          });
        }

        if (this.relationshipDraft && this.relationshipDraft.sourceNodeId && this.relationshipDraft.mouseWorld) {
          const fromL = this.layout.getLayout(this.relationshipDraft.sourceNodeId);
          if (fromL) {
            const fakeTo = { x: this.relationshipDraft.mouseWorld.x, y: this.relationshipDraft.mouseWorld.y };
            const curve = this.computeRelationshipCurve(fromL, fakeTo);
            ctx.save();
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 2.2;
            ctx.setLineDash([5, 4]);
            ctx.shadowColor = 'rgba(244, 63, 94, 0.6)';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(curve.x1, curve.y1);
            ctx.bezierCurveTo(curve.cp1x, curve.cp1y, curve.cp2x, curve.cp2y, curve.x2, curve.y2);
            ctx.stroke();
            ctx.setLineDash([]);
            if(!this._nmNavExport)globalThis.NeuroMapCanvasGeometry?.paintDirection?.(ctx,curve,{emphasize:false,zoom:this.camera.zoom});
            ctx.restore();
          }
        }
      }

      paintPlainSelection(x, y, w, h, selected) {
        const ctx = this.ctx;
        const zoom = Math.max(.5, this.camera?.zoom || 1);
        const accent = '#6441df';
        ctx.save();
        this.roundRectPath(x - 6, y - 2, w + 12, h + 4, 8);
        ctx.shadowBlur = 0;
        ctx.fillStyle = ColorUtils.rgba(accent, selected ? .16 : .07);
        ctx.fill();
        ctx.lineWidth = (selected ? 2 : 1) / zoom;
        ctx.strokeStyle = selected ? accent : ColorUtils.rgba(accent, .5);
        ctx.stroke();
        ctx.restore();
      }

      roundRectPath(x, y, w, h, r) {
        const ctx = this.ctx;
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
      }

      isEditingLabel(node,ctx=this.ctx){
        // The on-screen canvas owns the editable label, including virtual layout copies.
        // Export/preview contexts still paint committed document text normally.
        return !!this.inlineEditingNodeId &&
          this.inlineEditingNodeId===(node.logicalId||node.id) &&
          !this._nmNavExport && ctx.canvas===this.canvas;
      }

      drawIllustratedLabel(ctx,node,m,offsetY=0){
        const customColor=globalThis.GlaukaNodeText?.color(node);if(customColor)ctx.fillStyle=customColor;
        const lines=m.lines||[node.text];const lineH=m.lineHeight||Math.ceil((m.fontSize||16)*1.2);
        const size=node.illustration?.svg ? (m.iconSize||31):0;
        const gap=size?(m.iconGap||9):0;
        const contentWidth=(m.textWidth||30)+size+gap;
        const left=m.x-contentWidth/2;
        const areaLeft=left+size+gap;
        const align=['left','center','right'].includes(node.labelAlign)?node.labelAlign:'center';
        const indent=Math.max(0,Math.min(45,Number(node.labelIndent)||0));
        const textX=areaLeft+(align==='left'?0:align==='right'?(m.textWidth||30):(m.textWidth||30)/2);
        ctx.textAlign=align;
        const y0=m.y+offsetY-(lines.length-1)*lineH/2;
        if(size){
          const svg=node.illustration.svg;
          const safeSrc=nm54IconUri(node.illustration);
          const icon=this.getOrLoadImage(safeSrc);
          if(icon){
            const origin=this.devicePoint(left,m.y-size/2);
            const edge=this.deviceLen(size);
            ctx.imageSmoothingEnabled=true;
            ctx.imageSmoothingQuality='high';
            ctx.drawImage(icon,origin.x,origin.y,edge,edge);
          }
        }
        if(this.isEditingLabel(node,ctx))return;
        lines.forEach((text,i)=>{
          const rawX=textX+(i?indent*(align==='right'?-1:align==='left'?1:0.5):0),rawY=y0+i*lineH;
          const placed=this.devicePoint(rawX,rawY);
          const x=placed.x,y=placed.y;
          if(/^#[0-9a-f]{6}$/i.test(node.fontHighlight||'')&&text){
            const tw=ctx.measureText(text).width;
            const hx=x-(align==='right'?tw:align==='center'?tw/2:0);
            ctx.save();ctx.globalAlpha*=.54;ctx.fillStyle=node.fontHighlight;
            ctx.fillRect(hx-2,y-lineH*.45,tw+4,lineH*.94);ctx.restore();
          }
          ctx.fillText(text,x,y);
          const hairline=this.deviceLen(Math.max(1,(m.fontSize||16)/16));
          if(node.fontStrike&&text){const w=ctx.measureText(text).width,l=x-(align==='right'?w:align==='center'?w/2:0);ctx.save();ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=hairline;ctx.beginPath();ctx.moveTo(l,y);ctx.lineTo(l+w,y);ctx.stroke();ctx.restore()}
          if(node.fontUnderline&&text){const w=ctx.measureText(text).width,left=x-(align==='right'?w:align==='center'?w/2:0);ctx.save();ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=hairline;ctx.beginPath();ctx.moveTo(left,y+(m.fontSize||16)*.43);ctx.lineTo(left+w,y+(m.fontSize||16)*.43);ctx.stroke();ctx.restore()}
        });
      }


      drawNode(node) {
        const ctx = this.ctx;
        const m = this.layout.getLayout(node.id);
        if (!m) return;

        const logicalId=node.logicalId||node.id;
        const frame=this._nmSelectedFrame;
        const isMultiSelected = frame?.renderer===this&&frame.ids===this.state.selectedNodeIds
          ? frame.set.has(logicalId)
          : Array.isArray(this.state.selectedNodeIds) && this.state.selectedNodeIds.includes(logicalId);
        const isSelected = (this.state.selectedNodeId === logicalId || isMultiSelected) && !this.state.selectedImageId && !this.state.selectedRelationshipId;
        const isHovered = this.state.hoveredNodeId === logicalId;
        const isDragTarget = this.dragHoverNodeId === logicalId;
        const isSnapTarget = this.snapTargetNodeId === logicalId;
        const x = m.x - m.width / 2;
        const y = m.y - m.height / 2;

        ctx.save();

        const curatedArt=globalThis.NeuroMapCreativeCore?.objectArt(node.objectArt);
        if(curatedArt){
          globalThis.NeuroMapCreativeCore.paintObject(this,node,m,isSelected);
        } else         if (node.side === 'root') {
          const grad = ctx.createLinearGradient(x, y, x + m.width, y + m.height);
          grad.addColorStop(0, '#4f46e5');
          grad.addColorStop(0.5, '#7c3aed');
          grad.addColorStop(1, '#db2777');

          ctx.shadowColor = isSelected ? 'rgba(129, 140, 248, 0.45)' : 'rgba(79, 70, 229, 0.22)';
          ctx.shadowBlur = isSelected ? 10 : 6;

          this.roundRectPath(x, y, m.width, m.height, m.height / 2);
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.lineWidth = isSelected ? 3 : 1.5;
          ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.35)';
          ctx.stroke();
          if(isSelected && !this._nmNavExport)globalThis.NeuroMapCanvasPremium?.paintRootFocus(this,{x,y,w:m.width,h:m.height});

          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffffff';
          ctx.font = `${node.fontItalic ? 'italic ' : ''}${m.fontWeight || 700} ${m.fontSize || 18}px ${globalThis.GlaukaNodeText?.cssFamily(node)||'Inter, -apple-system, sans-serif'}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          this.drawIllustratedLabel(ctx,node,m,0);
        } else {
          // Touch: unboxed labels by default, matching desktop and .glk maps.
          // Explicit per-node shapes remain optional and are fully saved.
          const shape=['plain','none','card','pill','outline','glass','hex','circuit']
            .includes(node.nodeShape)?node.nodeShape:'plain';
          const plain=shape==='plain'||shape==='none';
          if(!plain){
            const h=m.height-3;
            if(shape==='hex'||shape==='circuit'){
              const cut=shape==='hex'?Math.min(22,h*.36,m.width*.17):Math.min(14,h*.28);
              const pts=shape==='hex'?
               [[x+cut,y],[x+m.width-cut,y],[x+m.width,y+h/2],[x+m.width-cut,y+h],[x+cut,y+h],[x,y+h/2]]:
               [[x+cut,y],[x+m.width-cut,y],[x+m.width,y+cut],[x+m.width,y+h-cut],
                [x+m.width-cut,y+h],[x+cut,y+h],[x,y+h-cut],[x,y+cut]];
              ctx.beginPath();ctx.moveTo(...pts[0]);
              pts.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();
            }else this.roundRectPath(x,y,m.width,h,
              shape==='pill'?h/2:shape==='outline'?4:shape==='glass'?18:7);
          }
          if(!globalThis.NeuroMapCanvasPremium?.paintBranch(this,{node,m,x,y,shape,plain,isSelected,isHovered,logicalId})){
          if(plain){
            // Selection underline instead of an opaque card over the branch.
            if(isSelected||isHovered){
              ctx.beginPath();ctx.moveTo(x+8,y+m.height-2);
              ctx.lineTo(x+m.width-8,y+m.height-2);
              ctx.lineWidth=isSelected?2.2:1.3;
              ctx.strokeStyle=ColorUtils.rgba(node.color,isSelected?.95:.55);
              ctx.stroke();
            }
          }else if (isSelected) {
            ctx.fillStyle = ColorUtils.rgba(node.color, 0.22);
            ctx.shadowColor = ColorUtils.rgba(node.color, 0.5);
            ctx.shadowBlur = 16;
            ctx.fill();
            ctx.lineWidth = 1.8;
            ctx.strokeStyle = node.color;
            ctx.stroke();
          } else if (isHovered) {
            ctx.fillStyle = ColorUtils.rgba(node.color, 0.13);
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = ColorUtils.rgba(node.color, 0.45);
            ctx.stroke();
          } else {
            const light=NeuroMapGraphics.light();
            ctx.fillStyle=shape==='glass'?ColorUtils.rgba(node.color,light?.14:.18):
              shape==='outline'?(light?'rgba(249,251,255,.96)':'rgba(9,15,29,.83)'):
              light?'rgba(229,234,246,.96)':'rgba(15,23,42,.78)';
            ctx.fill();
            if(['outline','glass','hex','circuit'].includes(shape)){
              ctx.strokeStyle=ColorUtils.rgba(node.color,shape==='glass'?.55:.78);
              ctx.lineWidth=shape==='outline'?1.5:1.15;ctx.stroke();
            }
          }
          }

          ctx.shadowBlur = 0;
          ctx.fillStyle = NeuroMapGraphics.light()?'#152139':(isSelected ? '#ffffff' : '#f1f5f9');
          ctx.font = `${node.fontItalic ? 'italic ' : ''}${m.fontWeight || (m.depth === 1 ? 600 : 500)} ${m.fontSize || (m.depth === 1 ? 15 : 13.5)}px ${globalThis.GlaukaNodeText?.cssFamily(node)||'Inter, -apple-system, sans-serif'}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          this.drawIllustratedLabel(ctx,node,m,-2);
        }

        if(!globalThis.NeuroMapCanvasPremium?.paintAffordances(this,{node,m,x,y,isDragTarget,isSnapTarget,logicalId})){
        if (isDragTarget || isSnapTarget) {
          this.roundRectPath(x - 6, y - 6, m.width + 12, m.height + 12, 16);
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 2.4;
          ctx.strokeStyle = '#38bdf8';
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (node.side !== 'root' && node.children && node.children.length > 0) {
          const dir = this.state.branchStyle==='radial' ? (m.x>=0?1:-1) : (node.side === 'right' ? 1 : -1);
          const badgeX = m.x + dir * (m.width / 2 + 12);
          const badgeY = m.y + m.height / 2 - 2;
          const badgeR = 9;

          ctx.beginPath();
          ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
          ctx.fillStyle = node.collapsed ? node.color : '#1e293b';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = node.color;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = '700 10px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const badge=this.devicePoint(badgeX, badgeY + 0.5);
          ctx.fillText(node.collapsed ? String(node.children.length) : '−', badge.x, badge.y);
        }
        }

        // Small unobtrusive markers, drawn by the canvas (including PNG export).
        if(Array.isArray(node.markers) && node.markers.length) {
          const ids=node.markers.slice(0,3);
          const symbols={'priority-1':'❶','priority-2':'❷','priority-3':'❸','priority-4':'❹','priority-5':'❺','priority-6':'❻','priority-7':'❼','priority-8':'❽','priority-9':'❾','check':'✓','question':'?','warning':'!','flag':'⚑','star':'★','heart':'♥','progress':'◕','done':'✔','idea':'✦','important':'◆','info':'ℹ','smile':'☺','sad':'☹','up':'↑','down':'↓','clock':'◷','book':'▤','medical':'✚','pin':'●'};
          ctx.save();ctx.font='700 15px NeuroMapSymbols,Segoe UI Symbol,Segoe UI Emoji,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
          const gap=19,start=m.x+m.width/2+11;
          ids.forEach((id,i)=>{const cx=start+i*gap,cy=m.y-m.height/2+4;
            ctx.fillStyle='rgba(9,15,30,.93)';ctx.beginPath();ctx.arc(cx,cy,9,0,Math.PI*2);ctx.fill();
            ctx.fillStyle=/priority|warning/.test(id)?'#fbbf24':id==='done'||id==='check'?'#34d399':'#93c5fd';
            const mark=this.devicePoint(cx,cy+.5);
            ctx.fillText(globalThis.NeuroMapMarkers?.symbols[id]||symbols[id]||'•',mark.x,mark.y);
          });ctx.restore();
        }
        if (node.srStatus > 0) {
          const srPalette = { 1:'#fb7185', 2:'#fbbf24', 3:'#34d399' };
          ctx.save();ctx.beginPath();ctx.arc(x+m.width-2,y+3,4.1,0,Math.PI*2);
          ctx.fillStyle=srPalette[node.srStatus] || '#818cf8';
          ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=9;ctx.fill();ctx.restore();
        }
        ctx.restore();

        if (!node.collapsed && node.children) {
          node.children.forEach(child => this.drawNode(child));
        }
      }

      drawImagesLayer(targetZLayer = 'front') {
        if (!Array.isArray(this.state.images) || this.state.images.length === 0) return;
        const ctx = this.ctx;

        this.state.images.forEach((imgItem) => {
          const itemZ = imgItem.zLayer === 'back' ? 'back' : 'front';
          if (itemZ !== targetZLayer) return;

          const rect = this.resolveImageWorldRect(imgItem);
          if (!rect) return;

          const { x, y, w, h, cx, cy, anchorX, anchorY, handleSize, handles } = rect;
          const isSelected = this.state.selectedImageId === imgItem.id;
          const isHovered = this.state.hoveredImageId === imgItem.id;

          ctx.save();

          if (imgItem.mode === 'attached' && anchorX !== null && anchorY !== null && (isSelected || isHovered)) {
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = 'rgba(129, 140, 248, 0.75)';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(anchorX, anchorY);
            ctx.stroke();
            ctx.restore();
          }

          ctx.shadowColor = isSelected ? 'rgba(99, 102, 241, 0.55)' : 'rgba(2, 6, 23, 0.72)';
          ctx.shadowBlur = isSelected ? 18 : 12;
          ctx.shadowOffsetY = 4;

          this.roundRectPath(x - 3, y - 3, w + 6, h + 6, 10);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.fill();

          ctx.lineWidth = isSelected ? 2.2 : (isHovered ? 1.6 : 1.1);
          ctx.strokeStyle = isSelected
            ? '#818cf8'
            : (imgItem.mode === 'attached' ? 'rgba(56, 189, 248, 0.55)' : 'rgba(148, 163, 184, 0.4)');
          ctx.stroke();

          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          const loadedImg = this.getOrLoadImage(imgItem.src);
          if (loadedImg) {
            ctx.save();
            this.roundRectPath(x, y, w, h, 8);
            ctx.clip();
            ctx.drawImage(loadedImg, x, y, w, h);
            ctx.restore();
          } else {
            this.roundRectPath(x, y, w, h, 8);
            ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
            ctx.fill();
            ctx.fillStyle = '#94a3b8';
            ctx.font = '600 10px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const pending=this.devicePoint(cx, cy);
            ctx.fillText('IMG...', pending.x, pending.y);
          }

          if (isSelected || isHovered) {
            const badgeText = imgItem.mode === 'attached' ? '⚓ AGGANCIATA' : '✦ LIBERA';
            ctx.font = '700 9px JetBrains Mono, monospace';
            const bw = ctx.measureText(badgeText).width + 12;
            const bh = 16;
            this.roundRectPath(x + 4, y + 4, bw, bh, 5);
            ctx.fillStyle = imgItem.mode === 'attached' ? 'rgba(14, 116, 144, 0.88)' : 'rgba(79, 70, 229, 0.88)';
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const chip=this.devicePoint(x + 10, y + 12.5);
            ctx.fillText(badgeText, chip.x, chip.y);
          }

          if (isSelected) {
            handles.forEach((hd) => {
              ctx.fillStyle = '#ffffff';
              ctx.strokeStyle = '#4f46e5';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.rect(hd.x - handleSize / 2, hd.y - handleSize / 2, handleSize, handleSize);
              ctx.fill();
              ctx.stroke();
            });
          }

          ctx.restore();
        });
      }

      render(customCtx = null, customTransform = null) {
        const targetCtx = customCtx || this.ctx;
        const prevCtx = this.ctx;
        this.ctx = targetCtx;
        targetCtx.imageSmoothingEnabled=true;
        targetCtx.imageSmoothingQuality='high';

        if (!customCtx) {
          targetCtx.setTransform(1, 0, 0, 1, 0, 0);
          targetCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);

          targetCtx.save();
          targetCtx.scale(this.dpr, this.dpr);
          this.drawAmbientGrid();
          targetCtx.restore();
        }

        if (!this.state.root) {
          this.ctx = prevCtx;
          return;
        }

        this._nmSnapGlyphs=!customCtx && !customTransform;
        try {
        targetCtx.save();
        if (customTransform) {
          targetCtx.scale(customTransform.scale, customTransform.scale);
          targetCtx.translate(customTransform.tx, customTransform.ty);
        } else {
          targetCtx.scale(this.dpr, this.dpr);
          targetCtx.translate(this.camera.x, this.camera.y);
          targetCtx.scale(this.camera.zoom, this.camera.zoom);
          this.drawThresholdGuides();
        }

        this.drawImagesLayer('back');
        this.drawBoundariesRecursive(this.state.root);

        const rightPrimaries = this.state.root.children.filter(c => c.side === 'right' && !c.isSummary && !c.isFloating);
        const leftPrimaries = this.state.root.children.filter(c => c.side === 'left' && !c.isSummary && !c.isFloating);

        rightPrimaries.forEach((branch, idx) => {
          this.drawTaperingBranch(this.state.root, branch, idx, rightPrimaries.length);
        });

        const leftLen = leftPrimaries.length;
        leftPrimaries.forEach((branch, idx) => {
          const visualTopToBottomIdx = leftLen - 1 - idx;
          this.drawTaperingBranch(this.state.root, branch, visualTopToBottomIdx, leftLen);
        });

        for (const floater of (this.state.root.children||[]).filter(n=>n.isFloating)) {
          if (!floater.collapsed) {
            const children=floater.children.filter(c=>!c.isSummary);
            children.forEach((child,i)=>this.drawTaperingBranch(floater,child,i,children.length));
          }
        }
        this.drawSummariesRecursive(this.state.root);
        this.drawNode(this.state.root);
        this.drawRelationshipsLayer();
        this.drawImagesLayer('front');
        if (!customCtx && !this._nmNavExport) {
          globalThis.NeuroMapAreaSelection?.paint?.(this);
          globalThis.NeuroMapCameraPath?.paint?.(this);
        }
        if (!customCtx && this.pulse) this.drawRadarPulse();

        targetCtx.restore();
        } finally {
          this._nmSnapGlyphs=false;
          this.ctx = prevCtx;
        }
      }
    }

