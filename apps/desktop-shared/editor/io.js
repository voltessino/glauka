    /**
     * ============================================================================
     * 5. MULTI-FORMAT IMPORT / EXPORT + NATIVE .XMIND ZIP RESOURCE BINDER
     * ============================================================================
     */
    class MindMapIOManager {
      constructor(app) {
        this.app = app;
      }

      sanitizeFilename(name) {
        return (name || 'glauka')
          .toLowerCase()
          .replace(/[^a-z0-9-_]+/gi, '_')
          .replace(/^_+|_+$/g, '') || 'glauka';
      }

      triggerDownload(blob, filename) {
        if(window.NMAndroid?.saveProject)return NeuroMapLifecycle.androidExport(blob,filename).catch(error=>{this.app.showToast('Esportazione non riuscita: '+error.message,'ESPORTAZIONE');return false;});
        if (window.neuromapDesktop) {
          // Windows save dialog for ALL formats: SVG, PNG, JSON, Flashcards, Markdown, OPML.
          return blob.arrayBuffer().then(buffer => window.neuromapDesktop.saveExport({
            filename, bytes: new Uint8Array(buffer)
          })).then(result => {
            if (result && !result.cancelled) this.app.showToast('File esportato: ' + result.name, 'SALVATO SU DISCO');
            return !!(result && !result.cancelled);
          }).catch(error => {
            console.error('Desktop export:', error);
            this.app.showToast('Esportazione fallita: '+error.message, 'ERRORE');
            return false;
          });
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        return true;
      }

      async exportPNG(options={}) {
        await this.app.renderer.prepareExportImages();
        const plan = NeuroMapGraphics.exportPlan(NeuroMapGraphics.bounds(this.app),{...options,format:'png'});
        const offCanvas = document.createElement('canvas');
        offCanvas.width = plan.width;offCanvas.height = plan.height;
        const offCtx = offCanvas.getContext('2d');
        if(!offCtx)throw new Error('Memoria grafica insufficiente per creare il PNG');
        offCtx.fillStyle = NeuroMapGraphics.background();
        offCtx.fillRect(0,0,plan.width,plan.height);
        this.app.renderer.render(offCtx,{scale:plan.scale,tx:-plan.mapX,ty:-plan.mapY});
        const blob=await new Promise(resolve=>offCanvas.toBlob(resolve,'image/png'));
        if(!blob)throw new Error('Impossibile creare il PNG');
        const fname=this.sanitizeFilename(this.app.state.root.text)+'.png';
        const saved=await this.triggerDownload(blob,fname);if(saved===false)return false;
        this.app.showToast(`PNG · ${plan.width}×${plan.height}px`,'EXPORT PNG');return true;
      }

      exportSVG() {
        const bbox = NeuroMapGraphics.bounds(this.app);
        const pad = 60;
        const width = Math.max(600, Math.ceil(bbox.width + pad * 2));
        const height = Math.max(400, Math.ceil(bbox.height + pad * 2));
        const tx = -bbox.minX + pad;
        const ty = -bbox.minY + pad;

        const escapeXml = (str) =>
          String(str).replace(/[<>&'"]/g, (c) => ({
            '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;'
          }[c]));

        const defs = [];
        const backImgEls = [];
        const frontImgEls = [];
        const branchPaths = [];
        const nodeElements = [];
        const usedObjectArtIds = new Set();
        let gradCounter = 0;
        const rootMetrics=this.app.layout.getLayout(this.app.state.root.id);
        defs.push(`<linearGradient id="nodeRootGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0" stop-color="#4f46e5"/><stop offset=".5" stop-color="#7c3aed"/><stop offset="1" stop-color="#db2777"/></linearGradient>`);

        const collectBranchesRecursive = (parent, child, siblingIndex, totalSiblings) => {
          const childColor = child.color || (parent && parent.color) || '#6366f1';
          const baseColor = (parent.side === 'root' ? childColor : (parent.color || childColor)) || '#6366f1';
          if(this.app.state.branchStyle==='radial'){
            const ribbon=this.app.renderer.radialRibbon(parent,child);
            if(ribbon){const d=ribbon.points.map((pt,i)=>(i?'L':'M')+pt.x.toFixed(2)+' '+pt.y.toFixed(2)).join(' ')+' Z';
              branchPaths.push(`<path d="${d}" fill="${escapeXml(childColor)}" />`);}
            if(!child.collapsed){const children=(child.children||[]).filter(c=>!c.isSummary);
              children.forEach((next,i)=>collectBranchesRecursive(child,next,i,children.length));}
            return;
          }
          const g = this.app.renderer.computeBranchGeometry(parent, child, siblingIndex, totalSiblings);
          if (!g) return;

          const gradId = `branchGrad_${++gradCounter}`;

          defs.push(
            `<linearGradient id="${gradId}" gradientUnits="userSpaceOnUse" x1="${g.startX}" y1="${g.startY}" x2="${g.underlineEndX}" y2="${g.underlineEndY}">` +
            `<stop offset="0%" stop-color="${escapeXml(baseColor)}" />` +
            `<stop offset="100%" stop-color="${escapeXml(childColor)}" />` +
            `</linearGradient>`
          );

          const d = NeuroMapGraphics.ribbonPath(g,child);

          if(['elbow','straight','arc'].includes(this.app.state.branchStyle)||['dashed','wave','fork'].includes(this.app.state.branchStyle)){
            const style=this.app.state.branchStyle;
            const scale=this.app.state.strokeScale||1;
            let line='M '+g.startX+' '+g.startY;
            if(style==='straight'){
              line+=' L '+g.endX+' '+g.endY;
            }else if(style==='dashed'){
              line+=' C '+g.cp1x+' '+g.cp1y+' '+g.cp2x+' '+g.cp2y+' '+g.endX+' '+g.endY;
            }else if(style==='wave'){
              const dx=g.endX-g.startX,dy=g.endY-g.startY,amp=Math.abs(dy)<16?(g.dir*18):(dy*.62);
              line+=' C '+(g.startX+dx*.28)+' '+(g.startY-amp)+' '+(g.startX+dx*.68)+' '+(g.endY+amp*.88)+' '+g.endX+' '+g.endY;
            }else if(style==='fork'){
              const mid1=g.startX+(g.endX-g.startX)*.38,mid2=g.startX+(g.endX-g.startX)*.72;
              line+=' L '+mid1+' '+g.startY+' L '+mid2+' '+g.endY+' L '+g.endX+' '+g.endY;
            }else if(style==='elbow'){
              const mid=g.startX+(g.endX-g.startX)*.52;
              const radius=Math.min(13,Math.abs(g.endX-g.startX)*.18,Math.abs(g.endY-g.startY)*.46);
              if(radius<1)line+=' L '+mid+' '+g.startY+' L '+mid+' '+g.endY+' L '+g.endX+' '+g.endY;
              else{
                const sign=Math.sign(g.endY-g.startY)||1;
                line+=' L '+(mid-g.dir*radius)+' '+g.startY+
                  ' Q '+mid+' '+g.startY+' '+mid+' '+(g.startY+sign*radius)+
                  ' L '+mid+' '+(g.endY-sign*radius)+
                  ' Q '+mid+' '+g.endY+' '+(mid+g.dir*radius)+' '+g.endY+
                  ' L '+g.endX+' '+g.endY;
              }
            }else{
              const rawDy=g.endY-g.startY;
              const bow=Math.abs(rawDy)<14?(siblingIndex%2===0?-22:22):rawDy*.52;
              line+=' Q '+((g.startX+g.endX)*.5)+' '+(g.startY+bow*1.35)+' '+g.endX+' '+g.endY;
            }
            line+=' L '+g.underlineEndX+' '+g.underlineEndY;
            const dash=(8.5*Math.sqrt(scale)).toFixed(1)+' '+(5.5*Math.sqrt(scale)).toFixed(1);
            branchPaths.push('<path d="'+line+'" fill="none" stroke="url(#'+gradId+')" stroke-linejoin="round" stroke-linecap="round" stroke-width="'+Math.max(.8,2.6*(this.app.state.strokeScale||1))+'"'+(style==='dashed'?' stroke-dasharray="'+dash+'"':'')+' />');
          }else if(this.app.state.branchStyle==='neon'){
            const scale=this.app.state.strokeScale||1,isPrimary=g.pLayout.depth===0;
            const startW=Math.max(2.2,(isPrimary?5.6:3.3)*scale);
            const endW=Math.max(1.2,(isPrimary?2.1:1.45)*scale);
            const steps=28,upper=[],lower=[];
            for(let i=0;i<=steps;i++){
              const t=i/steps,u=1-t;
              const x=u*u*u*g.startX+3*u*u*t*g.cp1x+3*u*t*t*g.cp2x+t*t*t*g.endX;
              const y=u*u*u*g.startY+3*u*u*t*g.cp1y+3*u*t*t*g.cp2y+t*t*t*g.endY;
              const tx=3*u*u*(g.cp1x-g.startX)+6*u*t*(g.cp2x-g.cp1x)+3*t*t*(g.endX-g.cp2x);
              const ty=3*u*u*(g.cp1y-g.startY)+6*u*t*(g.cp2y-g.cp1y)+3*t*t*(g.endY-g.cp2y);
              const len=Math.hypot(tx,ty)||1,nx=-ty/len,ny=tx/len;
              const half=(endW+(startW-endW)*Math.pow(u,1.25))*0.5;
              upper.push((x+nx*half).toFixed(2)+' '+(y+ny*half).toFixed(2));
              lower.push((x-nx*half).toFixed(2)+' '+(y-ny*half).toFixed(2));
            }
            const tube='M '+upper[0]+upper.slice(1).map(p=>' L '+p).join('')+lower.reverse().map(p=>' L '+p).join('')+' Z';
            branchPaths.push('<path d="'+tube+'" fill="url(#'+gradId+')" /><circle cx="'+g.startX+'" cy="'+g.startY+'" r="'+(startW*0.5).toFixed(2)+'" fill="url(#'+gradId+')" /><path d="M '+g.endX+' '+g.endY+' L '+g.underlineEndX+' '+g.underlineEndY+'" fill="none" stroke="url(#'+gradId+')" stroke-width="'+endW+'" stroke-linecap="round" />');
          }else if(this.app.state.branchStyle==='thickparents'){
            const scale=this.app.state.strokeScale||1,isPrimary=g.pLayout.depth===0;
            const trunkX=g.startX+(g.endX-g.startX)*0.24,span=Math.abs(g.endX-trunkX);
            const cp1x=trunkX+g.dir*span*0.62,cp2x=g.endX-g.dir*span*0.16;
            if(isPrimary){
              const startW=Math.max(3.2,7.2*scale),endW=Math.max(1.6,2.4*scale);
              const steps=24,upper=[],lower=[];
              for(let i=0;i<=steps;i++){
                const t=i/steps,u=1-t;
                const x=u*u*u*trunkX+3*u*u*t*cp1x+3*u*t*t*cp2x+t*t*t*g.endX;
                const y=u*u*u*g.startY+3*u*u*t*g.startY+3*u*t*t*g.endY+t*t*t*g.endY;
                const tx=3*u*u*(cp1x-trunkX)+6*u*t*(cp2x-cp1x)+3*t*t*(g.endX-cp2x);
                const ty=6*u*t*(g.endY-g.startY);
                const len=Math.hypot(tx,ty)||1,nx=-ty/len,ny=tx/len;
                const half=(endW+(startW-endW)*Math.pow(u,1.15))*0.5;
                upper.push((x+nx*half).toFixed(2)+' '+(y+ny*half).toFixed(2));
                lower.push((x-nx*half).toFixed(2)+' '+(y-ny*half).toFixed(2));
              }
              const ribbon='M '+g.startX+' '+(g.startY-startW*0.5)+upper.map(p=>' L '+p).join('')+lower.reverse().map(p=>' L '+p).join('')+' L '+g.startX+' '+(g.startY+startW*0.5)+' Z';
              branchPaths.push('<path d="'+ribbon+'" fill="url(#'+gradId+')" /><circle cx="'+g.startX+'" cy="'+g.startY+'" r="'+(startW*0.5).toFixed(2)+'" fill="url(#'+gradId+')" /><path d="M '+g.endX+' '+g.endY+' L '+g.underlineEndX+' '+g.underlineEndY+'" fill="none" stroke="url(#'+gradId+')" stroke-width="'+endW+'" stroke-linecap="round" />');
            }else{
              const line='M '+g.startX+' '+g.startY+' L '+trunkX+' '+g.startY+' C '+cp1x+' '+g.startY+' '+cp2x+' '+g.endY+' '+g.endX+' '+g.endY+' L '+g.underlineEndX+' '+g.underlineEndY;
              branchPaths.push('<path d="'+line+'" fill="none" stroke="url(#'+gradId+')" stroke-linejoin="round" stroke-linecap="round" stroke-width="'+Math.max(1.2,(2.8-Math.min(1.4,g.cLayout.depth*0.3))*scale)+'" />');
            }
          }else if(['xmind8','simple'].includes(this.app.state.branchStyle)){
            const scale=this.app.state.strokeScale||1,isPrimary=g.pLayout.depth===0;
            let line;
            if(this.app.state.branchStyle==='xmind8'){
              const stubX=g.startX+(g.endX-g.startX)*0.22,span=Math.abs(g.endX-stubX);
              line='M '+g.startX+' '+g.startY+' L '+stubX+' '+g.startY+' C '+(stubX+g.dir*span*0.66)+' '+g.startY+' '+(g.endX-g.dir*span*0.12)+' '+g.endY+' '+g.endX+' '+g.endY+' L '+g.underlineEndX+' '+g.underlineEndY;
            }else{
              const dx=g.endX-g.startX,dy=g.endY-g.startY;
              line='M '+g.startX+' '+g.startY+' C '+(g.startX+dx*0.42)+' '+(g.startY+dy*0.04)+' '+(g.endX-dx*0.24)+' '+(g.endY-dy*0.04)+' '+g.endX+' '+g.endY+' L '+g.underlineEndX+' '+g.underlineEndY;
            }
            const strokeW=this.app.state.branchStyle==='xmind8'?Math.max(1.2,(isPrimary?2.45:1.65)*scale):Math.max(1,1.45*scale);
            branchPaths.push(`<path d="${line}" fill="none" stroke="url(#${gradId})" stroke-linecap="round" stroke-width="${strokeW}" />`);
          }else branchPaths.push(`<path d="${d}" fill="url(#${gradId})" /><path d="M ${g.endX} ${g.endY} L ${g.underlineEndX} ${g.underlineEndY}" fill="none" stroke="url(#${gradId})" stroke-width="${g.endWidth}" stroke-linecap="round" />`);

          if (!child.collapsed && child.children && child.children.length > 0) {
            const reg = child.children.filter(gc => !gc.isSummary);
            reg.forEach((gc, idx) => collectBranchesRecursive(child, gc, idx, reg.length));
          }
        };

        const rootNode = this.app.layout.presentationRoot || this.app.state.root;
        const rightPrimaries = rootNode.children.filter(c => c.side === 'right' && !c.isSummary && !c.isFloating);
        const leftPrimaries = rootNode.children.filter(c => c.side === 'left' && !c.isSummary && !c.isFloating);

        rightPrimaries.forEach((b, idx) => collectBranchesRecursive(rootNode, b, idx, rightPrimaries.length));
        leftPrimaries.forEach((b, idx) => collectBranchesRecursive(rootNode, b, leftPrimaries.length - 1 - idx, leftPrimaries.length));

        // Reproduce every node's saved silhouette in SVG (including copies of
        // visual ancestors). UI skins are never exported into a map.
        const nmMapShapeSVG=(node,x,y,w,h)=>{
          const shape=node.nodeShape||'plain';
           if(shape==='plain'||shape==='none')return '';
          const color=/^#[0-9a-f]{6}$/i.test(node.color||'')?node.color:'#64748b';
          const fill=NeuroMapGraphics.light()?'#e5eaf6':'#0f172a';
          const opacity=shape==='glass'?'.23':NeuroMapGraphics.light()?'.96':'.78';
          const border=['outline','glass','hex','circuit'].includes(shape)
            ? ' stroke="'+color+'" stroke-width="'+(shape==='outline'?'1.5':'1.15')+'"':'';
          if(shape==='hex'||shape==='circuit'){
            const cut=shape==='hex'?Math.min(22,h*.36,w*.17):Math.min(14,h*.28);
            const pts=shape==='hex'
              ? [[x+cut,y],[x+w-cut,y],[x+w,y+h/2],[x+w-cut,y+h],[x+cut,y+h],[x,y+h/2]]
              : [[x+cut,y],[x+w-cut,y],[x+w,y+cut],[x+w,y+h-cut],
                  [x+w-cut,y+h],[x+cut,y+h],[x,y+h-cut],[x,y+cut]];
            return '<polygon points="'+pts.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' ')+
             '" fill="'+fill+'" fill-opacity="'+opacity+'"'+border+'/>';
          }
          const radius=shape==='pill'?h/2:shape==='card'?7:shape==='outline'?4:shape==='glass'?18:11;
          return '<rect x="'+x.toFixed(2)+'" y="'+y.toFixed(2)+'" width="'+w+
            '" height="'+h+'" rx="'+Math.min(radius,h/2)+'" fill="'+fill+
            '" fill-opacity="'+opacity+'"'+border+'/>';
        };
        const collectNodesRecursive = (node) => {
          const m = this.app.layout.getLayout(node.id);
          if (!m) return;
          const x = m.x - m.width / 2;
          const y = m.y - m.height / 2;

          const isRoot=node.side==='root';
          const artwork=globalThis.NeuroMapCreativeCore?.objectArt(node.objectArt);
          const objectMarkup=artwork?globalThis.NeuroMapCreativeCore.svgObject(node,m,true):'';
          if(objectMarkup)usedObjectArtIds.add(artwork.id);
          if(objectMarkup)nodeElements.push(objectMarkup);
          else {
          nodeElements.push(isRoot
            ? `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${m.width}" height="${m.height}" rx="${m.height/2}" fill="url(#nodeRootGradient)" stroke="#fff" stroke-opacity=".35" stroke-width="1.5" />`
            : nmMapShapeSVG(node,x,y,m.width,m.height-3));
          const iconSize=node.illustration?.svg ? m.iconSize : 0, iconGap=iconSize?m.iconGap:0;
          const left=m.x-(m.textWidth+iconSize+iconGap)/2;
          const textX=left+iconSize+iconGap+m.textWidth/2;
          const lines=m.lines||[node.text],lineH=m.lineHeight||20;
          if(iconSize){
            const src=nm54IconUri(node.illustration);
            if(src)nodeElements.push(`<image x="${left.toFixed(2)}" y="${(m.y-iconSize/2).toFixed(2)}" width="${iconSize}" height="${iconSize}" href="${escapeXml(src)}" />`);
          }
          const labelAlign=['left','center','right'].includes(node.labelAlign)?node.labelAlign:'center';
          const labelIndent=Math.max(0,Math.min(45,Number(node.labelIndent)||0));
          const labelLeft=left+iconSize+iconGap;
          const labelX=labelLeft+(labelAlign==='left'?0:labelAlign==='right'?m.textWidth:m.textWidth/2);
          const anchor=labelAlign==='left'?'start':labelAlign==='right'?'end':'middle';
          lines.forEach((line,i)=>{
            const highlight=/^#[0-9a-f]{6}$/i.test(node.fontHighlight||'')?node.fontHighlight:null;
            if(highlight&&line){
              const tx=labelX+(i?(labelAlign==='left'?labelIndent:labelAlign==='right'?-labelIndent:labelIndent*.5):0);
              const textWidth=Math.min(m.textWidth||240,String(line).length*(m.fontSize||18)*.65);
              const xx=tx-(labelAlign==='right'?textWidth:labelAlign==='center'?textWidth/2:0);
              const yy=m.y+(isRoot?0:-2)+(i-(lines.length-1)/2)*lineH;
              nodeElements.push('<rect x="'+(xx-2).toFixed(2)+'" y="'+(yy-lineH*.45).toFixed(2)+'" width="'+(textWidth+4).toFixed(2)+'" height="'+(lineH*.94).toFixed(2)+'" rx="3" fill="'+highlight+'" fill-opacity=".54"/>');
            }
            nodeElements.push(`<text x="${(labelX+(i?(labelAlign==='left'?labelIndent:labelAlign==='right'?-labelIndent:labelIndent*.5):0)).toFixed(2)}" y="${(m.y+(isRoot?0:-2)+(i-(lines.length-1)/2)*lineH).toFixed(2)}" dominant-baseline="central" fill="${globalThis.GlaukaNodeText?.color(node)||(isRoot?'#fff':NeuroMapGraphics.light()?'#152139':'#f1f5f9')}" font-family="${globalThis.GlaukaNodeText?.svgFamily(node)||'Inter, -apple-system, sans-serif'}" font-size="${m.fontSize||18}" font-weight="${m.fontWeight??400}" text-decoration="${[node.fontUnderline?'underline':'',node.fontStrike?'line-through':''].filter(Boolean).join(' ')||'none'}" font-style="${node.fontItalic?'italic':'normal'}" text-anchor="${anchor}">${escapeXml(line)}</text>`);
          });
          const linkMarks=globalThis.GlaukaNodeLinks?.svgMarks?.(node,m);
          if(linkMarks)nodeElements.push(linkMarks);

          }

          if (!node.collapsed && node.children) {
            node.children.forEach(collectNodesRecursive);
          }
        };

        for(const floater of rootNode.children.filter(c=>c.isFloating&&!c.collapsed)){const children=(floater.children||[]).filter(c=>!c.isSummary);children.forEach((c,i)=>collectBranchesRecursive(floater,c,i,children.length));}
        collectNodesRecursive(rootNode);
        // Reuse one SVG image definition per catalogue item instead of
        // embedding the same data URI inside every decorated node.
        for(const id of usedObjectArtIds) {
          const def=globalThis.NeuroMapCreativeCore?.svgObjectDef(id);
          if(def)defs.push(def);
        }

        this.app.state.images.forEach((imgItem) => {
          const rect = this.app.renderer.resolveImageWorldRect(imgItem);
          if (!rect) return;
          if(imgItem.graphic){const vector=`<image x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" href="${String(imgItem.src).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" preserveAspectRatio="none"/>`;if(imgItem.zLayer==='back')backImgEls.push(vector);else frontImgEls.push(vector);return;}
          const decorated=NeuroMapMedia.svgImage(imgItem,rect,this.app.renderer);
          if(decorated){if(imgItem.zLayer==='back')backImgEls.push(decorated);else frontImgEls.push(decorated);return;}
          const snippet = [
            `<rect x="${(rect.x - 3).toFixed(2)}" y="${(rect.y - 3).toFixed(2)}" width="${rect.w + 6}" height="${rect.h + 6}" rx="10" fill="#0f172a" stroke="#475569" stroke-width="1.2" />`,
            `<image x="${rect.x.toFixed(2)}" y="${rect.y.toFixed(2)}" width="${rect.w}" height="${rect.h}" href="${escapeXml(imgItem.src)}" preserveAspectRatio="none" />`
          ].join('\n');

          if (imgItem.zLayer === 'back') backImgEls.push(snippet);
          else frontImgEls.push(snippet);
        });

        const layers=NeuroMapGraphics.svgLayers(this.app.renderer);
        const svgContent = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
          `<defs>${defs.join('\n')}</defs>`,
          `<rect width="100%" height="100%" fill="${escapeXml(NeuroMapGraphics.background())}" />`,
          `<g transform="translate(${tx.toFixed(2)}, ${ty.toFixed(2)})">`,
          backImgEls.join('\n'),
          layers.boundaries,
          branchPaths.join('\n'),
          layers.summaries,
          nodeElements.join('\n'),
          layers.relationships,
          layers.markers,
          frontImgEls.join('\n'),
          `</g>`,
          `</svg>`
        ].join('\n');

        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        const done=saved=>{if(saved===false)return false;this.app.showToast('Esportato file vettoriale SVG', 'EXPORT SVG');return true;};
        const result=this.triggerDownload(blob, `${this.sanitizeFilename(rootNode.text)}.svg`);
        return result&&typeof result.then==='function'?result.then(done,error=>{this.app.showToast('Esportazione non riuscita: '+error.message,'ESPORTAZIONE');return false;}):done(result);
      }

      serializeNodeToMarkdown(rootNode) {
        return NeuroMapCore.serializeMarkdown(rootNode);
      }

      exportMarkdown() {
        try {
          const rootNode = this.app.state.root;
          const md = this.serializeNodeToMarkdown(rootNode);
          const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
          const done=saved=>{if(saved===false)return false;this.app.showToast('Esportato elenco indentato Markdown (.md)', 'EXPORT MD');return true;};
          const result=this.triggerDownload(blob, `${this.sanitizeFilename(rootNode.text)}.md`);
          return result&&typeof result.then==='function'?result.then(done,error=>{this.app.showToast('Esportazione non riuscita: '+error.message,'ESPORTAZIONE');return false;}):done(result);
        } catch (error) {
          this.app.showToast('Esportazione Markdown annullata: ' + (error?.message || String(error)), 'ERRORE EXPORT');
          return false;
        }
      }

      exportBatchMarkdown() {
        try {
          this.app.saveActiveTabSnapshot();
          const sections = this.app.tabs.map((tab) => this.serializeNodeToMarkdown(tab.state.root));
          const combined = sections.join('\n\n---\n\n');
          const blob = new Blob([combined], { type: 'text/markdown;charset=utf-8' });
          const done=saved=>{if(saved===false)return false;this.app.showToast(`Esportate ${this.app.tabs.length} schede in Batch Markdown`, 'BATCH MD');return true;};
          const result=this.triggerDownload(blob, `glauka_batch_${this.app.tabs.length}_schede.md`);
          return result&&typeof result.then==='function'?result.then(done,error=>{this.app.showToast('Esportazione non riuscita: '+error.message,'ESPORTAZIONE');return false;}):done(result);
        } catch (error) {
          this.app.showToast('Esportazione Batch Markdown annullata: ' + (error?.message || String(error)), 'ERRORE EXPORT');
          return false;
        }
      }

      exportOPML() {
        const rootNode=this.app.state.root;
        const blob=new Blob([NeuroMapCore.serializeOPML(rootNode)],{type:'text/x-opml;charset=utf-8'});
        const done=saved=>{if(saved===false)return false;this.app.showToast('Esportato standard OPML 2.0 (.opml)','EXPORT OPML');return true;};
        const result=this.triggerDownload(blob, `${this.sanitizeFilename(rootNode.text)}.opml`);
        return result&&typeof result.then==='function'?result.then(done,error=>{this.app.showToast('Esportazione non riuscita: '+error.message,'ESPORTAZIONE');return false;}):done(result);
      }

      buildSerializedProjectPayload() {
        return {
          schema: 'NeuroMapArchitect-SingleTab-v6',
          savedAt: new Date().toISOString(),
          thresholdY: this.app.state.thresholdY,
          balanceBias: this.app.state.balanceBias??50, compactness: this.app.state.compactness??100,branchGapX:nm68ClampGap(this.app.state.branchGapX),
          rootBranchGap: nmClampRootBranchGap(this.app.state.rootBranchGap),
          strokeScale: this.app.state.strokeScale || 1,
          activeThemeId: this.app.state.activeThemeId || null,
          typographyPreset:this.app.state.typographyPreset||'uniform', typographyScale:this.app.state.typographyScale||1,
          branchStyle:this.app.state.branchStyle||'neon',defaultLabelWrapChars:this.app.state.defaultLabelWrapChars||nm64PreferredWrap(),wrapCustom:!!this.app.state.wrapCustom,
          studyCards:this.app.getStudyCardsForTab?this.app.getStudyCardsForTab(this.app.activeTabId):[],
          learningAttempts:typeof NeuroMapLearningCore==='undefined'?[]:NeuroMapLearningCore.cleanAttempts(this.app.learningAttempts).filter(a=>a.tabId===this.app.activeTabId),
          learningPlan:typeof NeuroMapAdaptiveCore==='undefined'?null:NeuroMapAdaptiveCore.cleanPlans(this.app.learningPlans).find(p=>p.tabId===this.app.activeTabId)||null,
          root: MindMapStateMachine.cloneTree(this.app.state.root),
          images: MindMapStateMachine.cloneImages(this.app.state.images),
          relationships: MindMapStateMachine.cloneRelationships(this.app.state.relationships)
        };
      }

      async saveProjectFile(saveAs = false) {
        const currentTab = this.app.tabs.find(t => t.id === this.app.activeTabId);
        const saveState=currentTab?.state||this.app.state;
        const signature=currentTab?globalThis.NeuroMapLifecycle?.fingerprint(currentTab,this.app):null;
        const acknowledge=()=>{if((!currentTab||currentTab.state===saveState)&&(!signature||globalThis.NeuroMapLifecycle.fingerprint(currentTab,this.app)===signature))saveState.isDirty=false;};
        const payload = this.buildSerializedProjectPayload();
        const jsonString = NeuroMapSafeJSON.stringify(payload, 2);
        const defaultFilename = `${this.sanitizeFilename(this.app.state.root.text)}.gk`;
        const originalName=currentTab?.fileName || defaultFilename;
        const suggestedName=saveAs&&/\.(neuromap|glk)$/i.test(originalName)?originalName.replace(/\.(neuromap|glk)$/i,'.gk'):originalName;

        if (window.neuromapDesktop) {
          try {
            const result = await window.neuromapDesktop.saveProject({
              json: jsonString,
              filename: suggestedName,
              filePath: currentTab?.filePath || null,
              xmindSheets: this.app.v6XMindSheets?.(currentTab),
              saveAs: !!saveAs
            });
            if (!result || result.cancelled) return false;
            if (currentTab) { currentTab.filePath = result.path; currentTab.fileName = result.name; }
            acknowledge();
            this.app.renderTabBar();
            this.app.scheduleSave();
            this.app.showToast(result.warning || ('Salvato su disco: ' + result.name),
              result.warning ? 'ATTENZIONE' : 'SALVATO');
            return true;
          } catch (error) {
            console.error('Desktop project save:', error);
            this.app.showToast('Salvataggio fallito: ' + error.message, 'ERRORE');
            if (/servizio desktop non raggiungibile|Failed to fetch/i.test(String(error.message)) && this.app.nmAsk) {
              const action=await this.app.nmAsk({title:'Servizio di salvataggio non disponibile',
                message:'Il programma che scrive sul disco non sta rispondendo. Le mappe sono ancora aperte: puoi esportare subito una copia di sicurezza di tutte le schede in JSON, prima di riavviare Glauka.',
                choices:[{value:'cancel',text:'Resta nella mappa'},{value:'backup',text:'Esporta backup JSON',primary:true}]});
              if(action==='backup')this.exportBatchWorkspaceJSON();
            }
            return false;
          }
        }

        if (typeof window.showSaveFilePicker === 'function') {
          try {
            let fileHandle = (!saveAs && currentTab && currentTab.fileHandle) ? currentTab.fileHandle : null;
            if (!fileHandle) {
              fileHandle = await window.showSaveFilePicker({
                suggestedName: defaultFilename,
                types: [
                  {
                    description: 'Progetto Glauka (.gk)',
                    accept: { 'application/json': ['.gk', '.glk', '.neuromap', '.json'] }
                  }
                ]
              });
            }

            const writable = await fileHandle.createWritable();
            await writable.write(jsonString);
            await writable.close();

            if (currentTab) {
              currentTab.fileHandle = fileHandle;
            }
            acknowledge();
            this.app.renderTabBar();
            this.app.showToast(
              `File "${fileHandle.name || defaultFilename}" salvato su disco`,
              saveAs ? 'SALVA CON NOME' : 'SALVATO'
            );
            return true;
          } catch (err) {
            if (err && err.name === 'AbortError') {
              return false;
            }
          }
        }

        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
        const saved=await this.triggerDownload(blob, defaultFilename);
        if(saved===false)return false;
        acknowledge();
        this.app.renderTabBar();
        this.app.showToast(`Mappa salvata come "${defaultFilename}"`, 'SALVATO');
        return true;
      }

      exportJSON() {
        const payload = this.buildSerializedProjectPayload();
        const blob = new Blob([NeuroMapSafeJSON.stringify(payload, 2)], { type: 'application/json;charset=utf-8' });
        // A backup export does not confirm that the original project was saved.
        const done=saved=>{if(saved===false)return false;this.app.renderTabBar();
        this.app.showToast('Esportato backup JSON scheda corrente', 'EXPORT JSON');return true;};
        const result=this.triggerDownload(blob, `${this.sanitizeFilename(this.app.state.root.text)}.json`);
        return result&&typeof result.then==='function'?result.then(done,error=>{this.app.showToast('Esportazione non riuscita: '+error.message,'ESPORTAZIONE');return false;}):done(result);
      }

      async exportBatchWorkspaceJSON() {
        this.app.saveActiveTabSnapshot();
        const payload = {
          schema: 'NeuroMapArchitect-WorkspaceBatch-v6',
          exportedAt: new Date().toISOString(),
          activeTabId: this.app.activeTabId,
          tabs: this.app.tabs.map(t => ({
            id: t.id,
            title: t.state.root.text,
            thresholdY: t.state.thresholdY,
            balanceBias: t.state.balanceBias??50, compactness: t.state.compactness??100,branchGapX:nm68ClampGap(t.state.branchGapX),
            rootBranchGap: nmClampRootBranchGap(t.state.rootBranchGap),
            strokeScale: t.state.strokeScale || 1,
            activeThemeId: t.state.activeThemeId || null,
            typographyPreset:t.state.typographyPreset||'uniform', typographyScale:t.state.typographyScale||1,
            branchStyle:t.state.branchStyle||'neon',defaultLabelWrapChars:t.state.defaultLabelWrapChars||nm64PreferredWrap(),wrapCustom:!!t.state.wrapCustom,
            studyCards:this.app.getStudyCardsForTab?this.app.getStudyCardsForTab(t.id):[],
            learningAttempts:typeof NeuroMapLearningCore==='undefined'?[]:NeuroMapLearningCore.cleanAttempts(this.app.learningAttempts).filter(a=>a.tabId===t.id),
            learningPlan:typeof NeuroMapAdaptiveCore==='undefined'?null:NeuroMapAdaptiveCore.cleanPlans(this.app.learningPlans).find(p=>p.tabId===t.id)||null,
            root: MindMapStateMachine.cloneTree(t.state.root),
            images: MindMapStateMachine.cloneImages(t.state.images),
            relationships: MindMapStateMachine.cloneRelationships(t.state.relationships)
          }))
        };
        const blob = new Blob([NeuroMapSafeJSON.stringify(payload, 2)], { type: 'application/json;charset=utf-8' });
        const saved=await this.triggerDownload(blob, `glauka_workspace_${this.app.tabs.length}_tabs.json`);
        if(saved===false)return false;
        this.app._nmLastBackupSucceeded=Date.now();
        this.app.showToast(`Workspace completo (${this.app.tabs.length} schede) esportato in JSON`, 'BATCH JSON');
        return true;
      }

      uint8ArrayToBase64(bytes) {
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const sub = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, sub);
        }
        return btoa(binary);
      }

      guessMimeType(filename) {
        const lower = String(filename).toLowerCase();
        if (lower.endsWith('.png')) return 'image/png';
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
        if (lower.endsWith('.webp')) return 'image/webp';
        if (lower.endsWith('.gif')) return 'image/gif';
        if (lower.endsWith('.svg')) return 'image/svg+xml';
        return 'image/png';
      }

      async decompressZipEntryBytes(u8, compressionMethod, compressedOffset, compressedSize, maxOutputBytes=20*1024*1024) {
        // ZIP entry metadata can lie about the output size. A 1 KB archive
        // must never be allowed to inflate into gigabytes of allocated memory.
        const limit=Math.min(20*1024*1024,Math.max(1,Number(maxOutputBytes)||20*1024*1024));
        if (!Number.isSafeInteger(compressedOffset) || !Number.isSafeInteger(compressedSize) ||
            compressedOffset < 0 || compressedSize < 0 ||
            compressedOffset + compressedSize > u8.length)
          throw Error('Elemento ZIP danneggiato.');
        const rawSlice = u8.subarray(compressedOffset, compressedOffset + compressedSize);
        if (compressionMethod === 0) {
          if (rawSlice.byteLength > limit) throw Error('Elemento ZIP oltre il limite di decompressione.');
          return rawSlice;
        }
        if (compressionMethod === 8 && typeof DecompressionStream !== 'undefined') {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          const reader = ds.readable.getReader();
          // Start consuming output before awaiting input write: streams apply
          // backpressure when output is large. Handle failures on both sides.
          const feed = writer.write(rawSlice).then(() => writer.close());
          feed.catch(() => {}); // prevent an early write rejection becoming unhandled
          const chunks=[];let total=0;
          try {
            while (true) {
              const {done,value}=await reader.read();
              if (done) break;
              total += value.byteLength;
              if (total > limit) throw Error('Elemento ZIP oltre il limite di decompressione.');
              chunks.push(value);
            }
            await feed;
            const result=new Uint8Array(total);let offset=0;
            for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}
            return result;
          } catch (error) {
            // Cancel decompression immediately, rather than buffering any more
            // inflated bytes after the quota has been exceeded.
            reader.cancel().catch(() => {});
            writer.abort().catch(() => {});
            throw error;
          } finally {
            reader.releaseLock();
          }
        }
        throw new Error(`Metodo di compressione ZIP (${compressionMethod}) non supportato.`);
      }

      async parseZipArchiveInMemory(arrayBuffer) {
        const view = new DataView(arrayBuffer);
        const u8 = new Uint8Array(arrayBuffer);
        const decoder = new TextDecoder('utf-8');

        let eocdOffset = -1;
        const minEocdSearch = Math.max(0, u8.length - 65557);
        for (let i = u8.length - 22; i >= minEocdSearch; i--) {
          if (view.getUint32(i, true) === 0x06054b50) {
            eocdOffset = i;
            break;
          }
        }
        if (eocdOffset === -1) {
          throw new Error('Archivio .xmind (ZIP) non valido: Central Directory mancante.');
        }

        const totalEntries = view.getUint16(eocdOffset + 10, true);
        const cdOffset = view.getUint32(eocdOffset + 16, true);

        const entries = [];
        let ptr = cdOffset;
        for (let i = 0; i < totalEntries; i++) {
          if (ptr + 46 > u8.length || view.getUint32(ptr, true) !== 0x02014b50) break;

          const compressionMethod = view.getUint16(ptr + 10, true);
          const compressedSize = view.getUint32(ptr + 20, true);
          const uncompressedSize = view.getUint32(ptr + 24, true);
          const fileNameLen = view.getUint16(ptr + 28, true);
          const extraLen = view.getUint16(ptr + 30, true);
          const commentLen = view.getUint16(ptr + 32, true);
          const localHeaderOffset = view.getUint32(ptr + 42, true);

          const fileName = decoder.decode(u8.subarray(ptr + 46, ptr + 46 + fileNameLen));
          entries.push({ fileName, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });

          ptr += 46 + fileNameLen + extraLen + commentLen;
        }

        const resourceMap = new Map();
        let totalResourceBytes = 0;
        for (const entry of entries) {
          const cleanName = entry.fileName.replace(/^\/+/, '');
          const lower = cleanName.toLowerCase();
          const isResourceFile =
            (lower.startsWith('resources/') || lower.startsWith('attachments/')) &&
            !lower.endsWith('/');

          if (isResourceFile) {
            // Prevent image-heavy/hostile archives from exhausting memory.
            if (entry.uncompressedSize > 15 * 1024 * 1024 ||
                entry.compressedSize > 15 * 1024 * 1024 ||
                totalResourceBytes + entry.uncompressedSize > 30 * 1024 * 1024) continue;
            const lh = entry.localHeaderOffset;
            if (lh + 30 <= u8.length && view.getUint32(lh, true) === 0x04034b50) {
              const lhNameLen = view.getUint16(lh + 26, true);
              const lhExtraLen = view.getUint16(lh + 28, true);
              const dataStart = lh + 30 + lhNameLen + lhExtraLen;
              try {
                const fileBytes = await this.decompressZipEntryBytes(
                  u8,
                  entry.compressionMethod,
                  dataStart,
                  entry.compressedSize,
                  15 * 1024 * 1024
                );
                if (fileBytes.byteLength > 15 * 1024 * 1024 || totalResourceBytes + fileBytes.byteLength > 30 * 1024 * 1024) continue;
                totalResourceBytes += fileBytes.byteLength;
                const mime = this.guessMimeType(cleanName);
                const base64 = this.uint8ArrayToBase64(fileBytes);
                const dataUrl = `data:${mime};base64,${base64}`;
                const basename = cleanName.split('/').pop();

                resourceMap.set(cleanName, dataUrl);
                resourceMap.set(`xap:${cleanName}`, dataUrl);
                if (basename) {
                  resourceMap.set(basename, dataUrl);
                  resourceMap.set(`resources/${basename}`, dataUrl);
                  resourceMap.set(`attachments/${basename}`, dataUrl);
                  resourceMap.set(`xap:resources/${basename}`, dataUrl);
                  resourceMap.set(`xap:attachments/${basename}`, dataUrl);
                }
              } catch (_) {}
            }
          }
        }

        const extractTextFile = async (predicate) => {
          const target = entries.find(e => predicate(e.fileName));
          if (!target) return null;
          if (target.uncompressedSize > 20 * 1024 * 1024 || target.compressedSize > 20 * 1024 * 1024)
            throw Error('La struttura interna del file XMind supera il limite di sicurezza di 20 MB.');
          const lh = target.localHeaderOffset;
          if (lh + 30 > u8.length || view.getUint32(lh, true) !== 0x04034b50) return null;
          const lhNameLen = view.getUint16(lh + 26, true);
          const lhExtraLen = view.getUint16(lh + 28, true);
          const dataStart = lh + 30 + lhNameLen + lhExtraLen;
          const bytes = await this.decompressZipEntryBytes(u8, target.compressionMethod, dataStart, target.compressedSize, 20 * 1024 * 1024);
          return decoder.decode(bytes);
        };

        const contentJsonText = await extractTextFile(name => name === 'content.json' || name.endsWith('/content.json'));
        const contentXmlText = contentJsonText
          ? null
          : await extractTextFile(name => name === 'content.xml' || name.endsWith('/content.xml'));

        const nativeWorkspaceText = await extractTextFile(name => name === 'neuromap/workspace.json');
        return { contentJsonText, contentXmlText, resourceMap, nativeWorkspaceText };
      }

      resolveXMindResourceRef(rawSrc, resourceMap) {
        if (!rawSrc || !resourceMap) return null;
        const clean = String(rawSrc).trim();
        if (clean.startsWith('data:image/')) return clean;
        if (resourceMap.has(clean)) return resourceMap.get(clean);

        const stripped = clean.replace(/^xap:/i, '').replace(/^\/+/, '');
        if (resourceMap.has(stripped)) return resourceMap.get(stripped);

        const basename = stripped.split('/').pop();
        if (basename && resourceMap.has(basename)) return resourceMap.get(basename);
        return null;
      }

      parseXMindJsonToHierarchy(jsonText, resourceMap) {
        const data = JSON.parse(jsonText);
        const sheet = Array.isArray(data) ? data[0] : data;
        const rootTopic = sheet && (sheet.rootTopic || sheet.topic);
        if (!rootTopic) throw new Error('Struttura rootTopic non trovata in content.json');

        const convertTopic = (topic) => {
          const text = String(topic.title || topic.text || 'Nodo').trim();
          let attachedChildren = [];
          if (topic.children) {
            if (Array.isArray(topic.children.attached)) {
              attachedChildren = topic.children.attached;
            } else if (Array.isArray(topic.children)) {
              attachedChildren = topic.children;
            }
          }

          let nodeImage = null;
          if (topic.image && topic.image.src) {
            const resolved = this.resolveXMindResourceRef(topic.image.src, resourceMap);
            if (resolved) {
              nodeImage = {
                src: resolved,
                width: Number(topic.image.width || 135),
                height: Number(topic.image.height || 100)
              };
            }
          }

          const originalSide=[topic.side,topic.position,topic.direction].find(v=>v==='left'||v==='right')||null;
          const link=globalThis.GlaukaNodeLinks?.classify?.(topic.href);
          return {
            text,sidePinned:originalSide,
            ...(link?.ok?{linkUrl:link.value}:{}),
            image: nodeImage,
            children: attachedChildren.map(convertTopic)
          };
        };

        return convertTopic(rootTopic);
      }

      parseXMindXmlToHierarchy(xmlText, resourceMap, sheetIndex=0) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');
        if(doc.querySelector('parsererror'))throw Error('XML XMind non valido.');
        const sheets=[...doc.querySelectorAll('sheet')];
        const sheet = sheets[sheetIndex] || (!sheets.length&&sheetIndex===0?doc.documentElement:null);
        if (!sheet) throw new Error('Tag <sheet> non trovato in content.xml');

        const findDirectChildByTag = (parentEl, localName) => {
          if (!parentEl || !parentEl.children) return null;
          for (const el of parentEl.children) {
            if (el.localName === localName || el.tagName.endsWith(localName)) return el;
          }
          return null;
        };

        const rootTopicEl = findDirectChildByTag(sheet, 'topic');
        if (!rootTopicEl) throw new Error('Tag <topic> radice non trovato in content.xml');

        const convertTopicEl = (topicEl) => {
          const titleEl = findDirectChildByTag(topicEl, 'title');
          const text = titleEl && titleEl.textContent ? titleEl.textContent.trim() : 'Nodo';

          let nodeImage = null;
          const imgEl = findDirectChildByTag(topicEl, 'img') || topicEl.querySelector('img');
          if (imgEl && imgEl.parentElement && imgEl.parentElement.closest('topic') === topicEl) {
            const rawSrc = imgEl.getAttribute('xhtml:src') || imgEl.getAttribute('src');
            const resolved = this.resolveXMindResourceRef(rawSrc, resourceMap);
            if (resolved) {
              nodeImage = {
                src: resolved,
                width: Number(imgEl.getAttribute('svg:width') || 135),
                height: Number(imgEl.getAttribute('svg:height') || 100)
              };
            }
          }

          const childrenList = [];
          const childrenContainer = findDirectChildByTag(topicEl, 'children');
          if (childrenContainer && childrenContainer.children) {
            for (const topicsGroup of childrenContainer.children) {
              const typeAttr = topicsGroup.getAttribute('type');
              if (!typeAttr || typeAttr === 'attached') {
                for (const subTopic of topicsGroup.children) {
                  if (subTopic.localName === 'topic' || subTopic.tagName.endsWith('topic')) {
                    childrenList.push(convertTopicEl(subTopic));
                  }
                }
              }
            }
          }

          const originalSide=[topicEl.getAttribute('side'),topicEl.getAttribute('position'),topicEl.getAttribute('direction')].find(v=>v==='left'||v==='right')||null;
          const rawHref=topicEl.getAttribute('xlink:href')||topicEl.getAttribute('href')||'';
          const link=globalThis.GlaukaNodeLinks?.classify?.(rawHref);
          return { text, sidePinned:originalSide, ...(link?.ok?{linkUrl:link.value}:{}), image: nodeImage, children: childrenList };
        };

        return convertTopicEl(rootTopicEl);
      }

      async importXMindFile(file, openInNewTab = true) {
        try { return await this.app.importFile(file, {newTab:openInNewTab}); }
        catch(err) { this.app.showToast(err.message || 'XMind non valido', 'ERRORE XMIND'); return false; }
      }

      attachImageFileToNode(file, targetNodeId = null, dropWorldPos = null) {
        if (!file) return;
        // Keep imports bounded: every image is persisted as a data URL inside
        // the document, so accepting arbitrarily large files can exhaust memory.
        const supported = /^(image\/(?:png|jpeg|webp|gif|bmp|avif))$/i;
        const extensions = /\.(?:png|jpe?g|webp|gif|bmp|avif)$/i;
        const mime = String(file.type || '');
        if ((mime && !supported.test(mime)) ||
            (!mime && !extensions.test(String(file.name || '')))) {
          this.app.showToast('Usa immagini PNG, JPEG, WebP, GIF, BMP o AVIF', 'FORMATO IMMAGINE');
          return;
        }
        if (!Number.isFinite(file.size) || file.size < 1 || file.size > 32 * 1024 * 1024) {
          this.app.showToast('Immagine vuota o oltre 32 MB', 'DIMENSIONE IMMAGINE');
          return;
        }
        // FileReader and image decoding are asynchronous. A tab can be changed,
        // closed or replaced before either callback fires: never attach an image
        // to whichever unrelated map happens to be active later.
        const originalState = this.app.state;
        const originalTabId = this.app.activeTabId;
        const stillCurrent = () => this.app.state === originalState &&
          this.app.activeTabId === originalTabId;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result;
          if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:') ||
              dataUrl.length > 46 * 1024 * 1024 || !stillCurrent()) return;

          const tempImg = new Image();
          tempImg.onload = () => {
            if (!stillCurrent()) return;
            // Decoders may report zero-sized or pathological aspect-ratio media.
            // Never persist NaN/Infinity geometry or create million-pixel-tall nodes.
            const naturalW = Number(tempImg.naturalWidth);
            const naturalH = Number(tempImg.naturalHeight);
            if (!Number.isFinite(naturalW) || !Number.isFinite(naturalH) ||
                naturalW <= 0 || naturalH <= 0 ||
                naturalW * naturalH > 64_000_000) {
              this.app.showToast('Immagine con dimensioni non valide', 'ERRORE IMMAGINE');
              return;
            }
            const fit = Math.min(135 / naturalW, 600 / naturalH);
            const defaultW = Math.max(1, Math.round(naturalW * fit));
            const defaultH = Math.max(1, Math.round(naturalH * fit));

            if (targetNodeId) {
              const targetNode = this.app.state.findNode(targetNodeId);
              if (!targetNode) return;
              const nm = this.app.layout.getLayout(targetNode.id);
              const offsetDy = nm ? -(nm.height / 2 + defaultH / 2 + 16) : -84;

              this.app.state.addImageItem({
                src: dataUrl,
                width: defaultW,
                height: defaultH,
                naturalWidth: tempImg.naturalWidth,
                naturalHeight: tempImg.naturalHeight,
                aspectLocked: true,
                mode: 'attached',
                attachedNodeId: targetNode.id,
                offset: { dx: 0, dy: offsetDy },
                worldPos: { x: nm ? nm.x : 0, y: nm ? nm.y + offsetDy : 0 }
              });
              this.app.showToast(`Immagine agganciata a "${targetNode.text}"`, '⚓ AGGANCIATA');
            } else {
              const wx = Number.isFinite(Number(dropWorldPos?.x)) ? Number(dropWorldPos.x) : 0;
              const wy = Number.isFinite(Number(dropWorldPos?.y)) ? Number(dropWorldPos.y) : 0;
              this.app.state.addImageItem({
                src: dataUrl,
                width: defaultW,
                height: defaultH,
                naturalWidth: tempImg.naturalWidth,
                naturalHeight: tempImg.naturalHeight,
                aspectLocked: true,
                mode: 'free',
                attachedNodeId: null,
                offset: { dx: 0, dy: -84 },
                worldPos: { x: wx, y: wy }
              });
              this.app.showToast('Immagine libera aggiunta nel Canvas', '✦ LIBERA');
            }
            this.app.markChanged();this.app.updateImageControls();
          };
          tempImg.onerror = () => {
            if (stillCurrent()) this.app.showToast('Immagine non leggibile', 'ERRORE IMMAGINE');
          };
          tempImg.src = dataUrl;
        };
        reader.onerror = () => {
          if (stillCurrent()) this.app.showToast('Lettura immagine non riuscita', 'ERRORE IMMAGINE');
        };
        try { reader.readAsDataURL(file); }
        catch (error) { if (stillCurrent()) this.app.showToast('File immagine non leggibile', 'ERRORE IMMAGINE'); }
      }

    }

