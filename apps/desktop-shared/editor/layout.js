    /**
     * ============================================================================
     * 3. 360° DYNAMIC SPLIT POINT CLOCKWISE LAYOUT ENGINE
     * ============================================================================
     */
    class OrganicLayoutEngine {
      constructor() {
        this.measureCanvas = document.createElement('canvas');
        this.measureCtx = this.measureCanvas.getContext('2d');
        this.nodeLayoutMap = new Map();

        this.levelGapX = 150;
        this.primaryGapX = 185;
        this.verticalGap = 24;
        this.primaryGroupGap = 38;
        this.lastSplitIndex = 0;
      }

      getNodeTypography(node, depth = 0) {
        const profiles = {
          balanced:[18,15,13.5,13,12.5,12],
          pyramid:[28,23,19,16,14,12],
          branches:[15,28,22,18,15,12],
          compact:[16,18,15,13,11.5,10],
          uniform:[18,18,18,18,18,18]
        };
        const series=profiles[this.typographyPreset]||profiles.uniform;
        const base=series[Math.min(depth,series.length-1)];
        const fontSize=node.fontSize != null ? Number(node.fontSize) :
          Math.max(9, Math.min(48,base*(Number(this.typographyScale)||1)));
        const fontWeight=node.fontWeight != null ? Number(node.fontWeight) :
          400; // No automatic boldness: user controls every depth
        return {fontSize, fontWeight};
      }

      wrapNodeText(text, limit) {
        return NeuroMapCore.wrapLabelText(text,limit);
      }

      measureNode(node, depth = 0) {
        const isRoot = node.side === 'root';
        const { fontSize, fontWeight } = this.getNodeTypography(node, depth);
        this.measureCtx.font = `${node.fontItalic ? 'italic ' : ''}${fontWeight} ${fontSize}px ${globalThis.GlaukaNodeText?.cssFamily(node)||'Inter, -apple-system, sans-serif'}`;
        const charLimit = Math.max(8,Math.min(60,Number(node.labelWrapChars || this.defaultLabelWrapChars)||18));
        // Draft geometry is local to the editor: saved text and Undo stay untouched.
        const text=this.editingLabel && this.editingLabel.id===node.id?this.editingLabel.text:node.text;
        const lines = this.wrapNodeText(text, charLimit);
        const indent=Math.max(0,Math.min(45,Number(node.labelIndent)||0));
        const textWidth = Math.max(20,...lines.map((line,i)=>this.measureCtx.measureText(line).width+(i?indent:0)));
        const art=globalThis.NeuroMapCreativeCore?.objectArt(node.objectArt);
        const objectArtSize=art?.size||0;
        const iconSize = !art && node.illustration?.svg ? Math.max(26,Math.min(37,Math.round(fontSize*1.9))) : 0;
        const iconGap = iconSize ? 9 : 0;
        const padX = isRoot ? 34 : (depth === 1 ? 22 : 16);
        const lineHeight = Math.ceil(fontSize*1.24);
        const height = objectArtSize
          ? Math.max(isRoot ? 54 : 38,objectArtSize+lines.length*lineHeight+24)
          : Math.max(isRoot ? 54 : (depth === 1 ? 38 : 32),lines.length*lineHeight+15);
        const width = Math.max(isRoot ? 165 : 92,
          Math.ceil(textWidth+iconSize+iconGap+padX*2),objectArtSize?objectArtSize+18:0);
        return {width,height,textWidth,fontSize,fontWeight,lines,lineHeight,iconSize,iconGap,objectArtSize};
      }

      computeSubtreeHeight(node, depth = 0) {
        // Calculate all visible descendants bottom-up without relying on the
        // JavaScript call stack. Summaries are measured but do not take height
        // away from the regular-child layout lanes.
        const heights=new WeakMap(),seen=new WeakSet();
        const pending=[{node,depth,done:false}];
        while(pending.length){
          const frame=pending.pop(),current=frame.node;
          if(!frame.done){
            if(seen.has(current))
              throw Error('Struttura ciclica o condivisa nel layout della mappa.');
            seen.add(current);
            const size=this.measureNode(current,frame.depth);
            pending.push({node:current,depth:frame.depth,done:true,size});
            if(!current.collapsed){
              const children=current.children||[];
              // Regular children first; summary sizing follows regular children.
              for(let i=children.length-1;i>=0;i--)if(children[i].isSummary)
                pending.push({node:children[i],depth:frame.depth+1,done:false});
              for(let i=children.length-1;i>=0;i--)if(!children[i].isSummary)
                pending.push({node:children[i],depth:frame.depth+1,done:false});
            }
            continue;
          }
          const regular=current.collapsed?[]:(current.children||[]).filter(c=>!c.isSummary);
          const gap=frame.depth===0?this.primaryGroupGap:this.verticalGap;
          let childHeight=0;
          for(const child of regular)childHeight+=(heights.get(child)||0);
          if(regular.length>1)childHeight+=gap*(regular.length-1);
          const half=frame.size.height/2;
          let extraAbove=0,extraBelow=0;
          for(const img of this._nmAttachedPictures?.get(current.id)||[]){
            const dy=Number(img.offset?.dy);
            const yOff=Number.isFinite(dy)?dy:-84;
            const h=Number(img.height)>0?Number(img.height):100;
            const imgTop=yOff-h/2,imgBottom=yOff+h/2;
            extraAbove=Math.max(extraAbove,Math.max(0,-imgTop-half)+16);
            extraBelow=Math.max(extraBelow,Math.max(0,imgBottom-half)+16);
          }
          const total=Math.max(frame.size.height,childHeight)+extraAbove+extraBelow;
          heights.set(current,total);
          this.nodeLayoutMap.set(current.id,{
            ...frame.size,depth:frame.depth,subtreeHeight:total,x:0,y:0,
            _nmImageClearance:extraAbove+extraBelow>0,
            _nmImageShift:(extraAbove-extraBelow)/2
          });
        }
        return heights.get(node)||0;
      }

      propagateSubtreeSide(node, side) {
        const pending=[node],seen=new WeakSet();
        while(pending.length){
          const current=pending.pop();
          if(!current||seen.has(current))continue;
          seen.add(current);current.side=side;
          const children=current.children||[];
          for(let i=children.length-1;i>=0;i--)pending.push(children[i]);
        }
      }

      // Geometry-balanced is opt-in: legacy "balanced" files without the marker
      // retain their historical clockwise geometry until the user reselects it.
      computeGeometryBalancedSplit(root) {
        const primaries=(root.children||[]).filter(n=>!n.isSummary&&!n.isFloating);
        const right=[],left=[];let hr=0,hl=0;
        for(const node of primaries){
          const height=this.computeSubtreeHeight(node,1);
          const pinned=node.sidePinned==='left'||node.sidePinned==='right'?node.sidePinned:null;
          const side=pinned||(hr<=hl?'right':'left');
          if(side==='right'){hr+=height+(right.length?this.primaryGroupGap:0);right.push(node.id);}
          else {hl+=height+(left.length?this.primaryGroupGap:0);left.push(node.id);}
          this.propagateSubtreeSide(node,side);
        }
        this.lastSplitIndex=right.length;
        return {H_R:hr,H_L:hl,rightCount:right.length,leftCount:left.length,
          splitIndex:right.length,totalPrimary:primaries.length,rightIds:right,leftIds:left};
      }

      computeDynamicClockwiseSplit(root, bias = 50) {
        const primaries = (root.children || []).filter(c => !c.isSummary && !c.isFloating);
        const metrics = NeuroMapCore.splitClockwise(primaries,
          primaries.map(node => this.computeSubtreeHeight(node, 1)), this.primaryGroupGap, bias);
        const right = new Set(metrics.rightIds);
        for (const node of primaries) this.propagateSubtreeSide(node, right.has(node.id) ? 'right' : 'left');
        this.lastSplitIndex = metrics.splitIndex;
        return metrics;
      }

      computeLayout(root, thresholdY = 500, images) {
        if(Array.isArray(images))this._nmImages=images;
        const attached=new Map();
        for(const img of this._nmImages||[]){
          if(!img||img.graphic||img.mode!=='attached'||!img.attachedNodeId)continue;
          const list=attached.get(img.attachedNodeId)||[];
          list.push(img);attached.set(img.attachedNodeId,list);
        }
        this._nmAttachedPictures=attached;
        this.nodeLayoutMap.clear();
        const gap=nm68ClampGap(this.branchGapX);
        this.levelGapX=gap;
        const rootGap=Number.isFinite(+this.rootBranchGap)?Math.max(0,Math.min(48,+this.rootBranchGap)):14;
        this.primaryGapX=Math.max(36,Math.round(gap*185/150))+rootGap;
        const compact=Math.max(55,Math.min(145,Number.isFinite(+this.compactness)?+this.compactness:100));
        this.verticalGap=Math.max(10,Math.round(24*compact/100));
        this.primaryGroupGap=Math.max(18,Math.round(38*compact/100));
        if (!root) return { H_R: 0, H_L: 0, rightCount: 0, leftCount: 0, splitIndex: 0, totalPrimary: 0 };

        const rootSize = this.measureNode(root, 0);
        this.nodeLayoutMap.set(root.id, {
          ...rootSize,
          depth: 0,
          subtreeHeight: rootSize.height,
          x: 0,
          y: 0,
          attachInX: 0,
          attachInY: 0,
          attachOutX: 0,
          attachOutY: 0
        });

        const splitMetrics = root.layoutMode==='balanced'&&root.layoutBalanceMode==='geometry' ?
          this.computeGeometryBalancedSplit(root) : this.computeDynamicClockwiseSplit(root, this.balanceBias);
        const primaries = (root.children || []).filter(c => !c.isSummary && !c.isFloating);
        const rightSet=new Set(splitMetrics.rightIds||[]);
        const rightBranches=primaries.filter(n=>rightSet.has(n.id));
        const leftBranches=primaries.filter(n=>!rightSet.has(n.id));

        this.layoutSideBranches(root, rightBranches, 'right', splitMetrics.H_R);
        this.layoutSideBranches(root, leftBranches, 'left', splitMetrics.H_L);
        // Detached floating topics are independent islands with their own subtrees.
        for (const floatNode of root.children.filter(n=>n.isFloating)) {
          this.computeSubtreeHeight(floatNode,1);
          const pos=floatNode.floatingPosition||{x:320,y:-220};
          this.positionSubtreeRecursive(floatNode,Number(pos.x)||0,Number(pos.y)||0,1,1);
        }
        // Radial layout is optional: default horizontal layout remains unchanged.
        if (this.branchStyle === 'radial') this.layoutRadialOrganic(root);
        if (typeof this.applyManualOffsets === 'function') this.applyManualOffsets(root);

        return splitMetrics;
      }

      layoutRadialOrganic(root) {
        // Angles are assigned by visible leaf weight. We keep the original text
        // orientation horizontal while positioning branches around the root.
        const regular = n => (n.collapsed ? [] : (n.children||[]).filter(c=>!c.isFloating && !c.isSummary));
        const primary = (root.children||[]).filter(c=>!c.isFloating && !c.isSummary);
        if (!primary.length) return;
        const weights = new Map(), depths=new Map(), sums=new Map();
        const visit=(initial,depth)=>{
          const returns=new WeakMap(),pending=[{node:initial,depth,done:false}];
          while(pending.length){
            const frame=pending.pop(),n=frame.node,d=frame.depth;
            if(frame.done){
              const children=regular(n);
              const count=children.length?Math.max(1,
                children.reduce((sum,c)=>sum+(returns.get(c)||0),0)):1;
              weights.set(n.id,count);returns.set(n,count);
              continue;
            }
            const m=this.nodeLayoutMap.get(n.id);
            if(!m){returns.set(n,0);continue;}
            if(d>100){returns.set(n,1);continue;}
            const stat=sums.get(d)||{count:0,width:0};
            stat.count++;stat.width+=m.width;sums.set(d,stat);
            depths.set(n.id,d);
            pending.push({node:n,depth:d,done:true});
            const children=regular(n);
            for(let i=children.length-1;i>=0;i--)
              pending.push({node:children[i],depth:d+1,done:false});
          }
          return returns.get(initial)||0;
        };
        primary.forEach(n=>visit(n,1));
        const radii=[0];let previous=0;
        const maxDepth=Math.max(...sums.keys());
        for(let d=1;d<=maxDepth;d++){
          const stat=sums.get(d)||{count:1,width:120};
          const mean=stat.width/Math.max(1,stat.count);
          // Dynamic ring circumference prevents high-density rings from crushing labels.
          // Tangential spacing is governed mostly by label height on the left/right
          // arcs, and by capped label width on the top/bottom arcs.
          // This is intentionally more compact than a full-width circumference.
          const tangential=Math.min(135,mean*.72+28);
          const crowd=stat.count*tangential*1.05/(Math.PI*2);
          previous=Math.max(previous+Math.max(175,mean*.52+110),crowd,230*d);
          radii[d]=previous;
        }
        const place=(initial,depth,a0,a1)=>{
          const pending=[{node:initial,depth,a0,a1}];
          while(pending.length){
            const frame=pending.pop(),node=frame.node,d=frame.depth;
            const m=this.nodeLayoutMap.get(node.id);
            if(!m)continue;
            const angle=(frame.a0+frame.a1)/2,radius=radii[d]||260*d;
            const x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;
            m.x=x;m.y=y;m.depth=d;m.radialAngle=angle;
            const ux=Math.cos(angle),uy=Math.sin(angle);
            m.attachInX=x-ux*Math.min(50,m.width*.25);
            m.attachInY=y-uy*Math.min(23,m.height*.4);
            m.attachOutX=x+ux*Math.min(50,m.width*.25);
            m.attachOutY=y+uy*Math.min(23,m.height*.4);
            const children=regular(node);
            if(!children.length)continue;
            const weight=children.reduce((total,c)=>total+(weights.get(c.id)||1),0);
            let start=frame.a0;const frames=[];
            for(const child of children){
              const share=(frame.a1-frame.a0)*(weights.get(child.id)||1)/weight;
              frames.push({node:child,depth:d+1,a0:start,a1:start+share});
              start+=share;
            }
            for(let i=frames.length-1;i>=0;i--)pending.push(frames[i]);
          }
        };
        const total=primary.reduce((n,c)=>n+(weights.get(c.id)||1),0);
        let angle=-Math.PI/2;
        for(const node of primary){const fraction=2*Math.PI*(weights.get(node.id)||1)/total;
          place(node,1,angle,angle+fraction);angle+=fraction;}
        const placed=[...this.nodeLayoutMap.values()].filter(m=>Number.isFinite(m.radialAngle));
        let spacing=1;
        const all=[this.nodeLayoutMap.get(root.id),...placed];
        // A pair can increase global spacing only if its padded rectangles
        // overlap on both axes. Index those rectangles in a world-space grid
        // rather than comparing every pair of nodes on large radial maps.
        const buckets=new Map(),cellSize=320;
        let checks=0;
        for(const current of all){
          if(!current)continue;
          const x0=Math.floor((current.x-current.width/2-9)/cellSize);
          const x1=Math.floor((current.x+current.width/2+9)/cellSize);
          const y0=Math.floor((current.y-current.height/2-9)/cellSize);
          const y1=Math.floor((current.y+current.height/2+9)/cellSize);
          const nearby=new Set();
          for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
            for(const previous of buckets.get(x+','+y)||[])nearby.add(previous);
          }
          for(const previous of nearby){
            checks++;
            const dx=Math.abs(previous.x-current.x),dy=Math.abs(previous.y-current.y);
            const factor=Math.min(
              dx>1e-8?((previous.width+current.width)/2+18)/dx:Infinity,
              dy>1e-8?((previous.height+current.height)/2+18)/dy:Infinity);
            if(Number.isFinite(factor))spacing=Math.max(spacing,factor);
          }
          for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
            const key=x+','+y;
            if(!buckets.has(key))buckets.set(key,[]);
            buckets.get(key).push(current);
          }
        }
        this._nmRadialCollisionChecks=checks;
        if(spacing>1)for(const m of placed){const dx=m.x*(spacing-1),dy=m.y*(spacing-1);m.x+=dx;m.y+=dy;m.attachInX+=dx;m.attachOutX+=dx;m.attachInY+=dy;m.attachOutY+=dy;}
        // Bracketed summary nodes are positioned near their parent instead of
        // retaining stale horizontal positions. Braces themselves are hidden.
        const summaryWalk=n=>{
          const pending=[n];
          while(pending.length){
            const current=pending.pop(),parent=this.nodeLayoutMap.get(current.id);
            const children=current.children||[];
            for(let i=children.length-1;i>=0;i--){
              const child=children[i];
              if(child.isSummary){
                const m=this.nodeLayoutMap.get(child.id);
                if(m&&parent){
                  m.bracketGeom=null;m.x=parent.x+36;m.y=parent.y-42;
                  m.attachInX=m.x;m.attachInY=m.y;m.attachOutX=m.x;m.attachOutY=m.y;
                }
              }else if(!child.isFloating)pending.push(child);
            }
          }
        };
        summaryWalk(root);
      }

      layoutSideBranches(root, branches, side, totalSideHeight) {
        if (branches.length === 0) return;
        const dir = side === 'right' ? 1 : -1;
        const rootMetrics = this.nodeLayoutMap.get(root.id);

        if (side === 'right') {
          let cursorY = -totalSideHeight / 2;
          branches.forEach((branch) => {
            const bMetrics = this.nodeLayoutMap.get(branch.id);
            const branchCenterY = cursorY + bMetrics.subtreeHeight / 2;
            const branchCenterX = dir * ((dir===1?rootMetrics._nmOccupiedRight:rootMetrics._nmOccupiedLeft)??rootMetrics.width/2) + dir*(this.primaryGapX+((dir===1?bMetrics._nmOccupiedLeft:bMetrics._nmOccupiedRight)??bMetrics.width/2));

            this.positionSubtreeRecursive(branch, branchCenterX, branchCenterY, dir, 1);
            cursorY += bMetrics.subtreeHeight + this.primaryGroupGap;
          });
        } else {
          let cursorY = totalSideHeight / 2;
          branches.forEach((branch) => {
            const bMetrics = this.nodeLayoutMap.get(branch.id);
            const branchCenterY = cursorY - bMetrics.subtreeHeight / 2;
            const branchCenterX = dir * ((dir===1?rootMetrics._nmOccupiedRight:rootMetrics._nmOccupiedLeft)??rootMetrics.width/2) + dir*(this.primaryGapX+((dir===1?bMetrics._nmOccupiedLeft:bMetrics._nmOccupiedRight)??bMetrics.width/2));

            this.positionSubtreeRecursive(branch, branchCenterX, branchCenterY, dir, 1);
            cursorY -= (bMetrics.subtreeHeight + this.primaryGroupGap);
          });
        }
      }

      positionSubtreeRecursive(node, centerX, centerY, dir, depth) {
        // Keep the same child-then-summary ordering as the original recursive
        // implementation, but use explicit frames for deeply nested maps.
        const pending=[{kind:'node',node,x:centerX,y:centerY,dir,depth}];
        while(pending.length){
          const task=pending.pop();
          if(task.kind==='summaries'){
            const {parent,children,index,dir,depth}=task;
            if(index>=children.length)continue;
            pending.push({...task,index:index+1});
            const summary=children[index],metrics=this.nodeLayoutMap.get(summary.id);
            if(!metrics)continue;
            const target=this.getTargetNodesSubtreeBounds(parent,summary.summaryTargetIds||[]);
            if(!target)continue;
            const midY=(target.minY+target.maxY)/2;
            const baseX=dir===1?target.maxX+10:target.minX-10;
            const tipX=baseX+dir*24;
            const x=tipX+dir*(18+metrics.width/2);
            metrics.bracketGeom={dir,baseX,tipX,minY:target.minY+4,
              maxY:target.maxY-4,midY};
            pending.push({kind:'node',node:summary,x,y:midY,dir,depth:depth+1});
            continue;
          }
          const current=task.node,metrics=this.nodeLayoutMap.get(current.id);
          if(!metrics)continue;
          const x=task.x,forward=task.dir;
          const y=task.y+(metrics._nmImageShift||0);
          metrics.x=x;metrics.y=y;
          const offset=metrics.height/2-2;
          metrics.attachInX=x+(forward===1?-1:1)*metrics.width/2;
          metrics.attachInY=y+offset;
          metrics.attachOutX=x+(forward===1?1:-1)*metrics.width/2;
          metrics.attachOutY=y+offset;
          if(current.collapsed||!current.children?.length)continue;
          const regular=current.children.filter(child=>!child.isSummary);
          const summaries=current.children.filter(child=>child.isSummary);
          if(summaries.length)pending.push({kind:'summaries',parent:current,
            children:summaries,index:0,dir:forward,depth:task.depth});
          if(!regular.length)continue;
          const total=regular.reduce((sum,child,i)=>{
            const childMetrics=this.nodeLayoutMap.get(child.id);
            return sum+(childMetrics?.subtreeHeight||0)+(i<regular.length-1?this.verticalGap:0);
          },0);
          let cursor=y-total/2;
          const frames=[];
          for(const child of regular){
            const m=this.nodeLayoutMap.get(child.id);
            if(!m)continue;
            const childY=cursor+m.subtreeHeight/2;
            const childX=x+forward*(((forward===1?metrics._nmOccupiedRight:
              metrics._nmOccupiedLeft)??metrics.width/2)+this.levelGapX+
              ((forward===1?m._nmOccupiedLeft:m._nmOccupiedRight)??m.width/2));
            frames.push({kind:'node',node:child,x:childX,y:childY,dir:forward,
              depth:task.depth+1});
            cursor+=m.subtreeHeight+this.verticalGap;
          }
          for(let i=frames.length-1;i>=0;i--)pending.push(frames[i]);
        }
      }

      getSubtreeBoundingBox(node, includeCollapsed = false) {
        if (!node) return null;
        let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
        const pending=[node],seen=new WeakSet();
        while(pending.length){
          const current=pending.pop();
          if(!current||seen.has(current))continue;
          seen.add(current);
          const m=this.nodeLayoutMap.get(current.id);
          if(!m)continue;
          minX=Math.min(minX,m.x-m.width/2);
          maxX=Math.max(maxX,m.x+m.width/2);
          minY=Math.min(minY,m.y-m.height/2);
          maxY=Math.max(maxY,m.y+m.height/2);
          if(!current.collapsed||includeCollapsed)
            for(let i=(current.children?.length||0)-1;i>=0;i--)
              pending.push(current.children[i]);
        }
        if(minX===Infinity)return null;
        return {minX,maxX,minY,maxY,width:maxX-minX,height:maxY-minY};
      }

      getTargetNodesSubtreeBounds(parentNode, targetIds = []) {
        if (!parentNode || !Array.isArray(targetIds) || targetIds.length === 0) return null;
        const targetSet = new Set(targetIds);
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        parentNode.children.forEach((child) => {
          if (!targetSet.has(child.id)) return;
          const box = this.getSubtreeBoundingBox(child, false);
          if (!box) return;
          minX = Math.min(minX, box.minX);
          maxX = Math.max(maxX, box.maxX);
          minY = Math.min(minY, box.minY);
          maxY = Math.max(maxY, box.maxY);
        });

        if (minX === Infinity) return null;
        return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
      }

      recomputeDescendantsLayout(parentNode) {
        if (!parentNode) return;
        const parentMetrics = this.nodeLayoutMap.get(parentNode.id);
        if (!parentMetrics) return;

        const dir = parentNode.side === 'left' ? -1 : 1;
        this.computeSubtreeHeight(parentNode, parentMetrics.depth);
        this.positionSubtreeRecursive(parentNode, parentMetrics.x, parentMetrics.y, dir, parentMetrics.depth);
      }

      getLayout(nodeId) {
        return this.nodeLayoutMap.get(nodeId) || null;
      }

      computeBoundingBox(images = []) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const m of this.nodeLayoutMap.values()) {
          minX = Math.min(minX, m.x - m.width / 2 - 40);
          maxX = Math.max(maxX, m.x + m.width / 2 + 40);
          minY = Math.min(minY, m.y - m.height / 2 - 40);
          maxY = Math.max(maxY, m.y + m.height / 2 + 40);
        }

        if (Array.isArray(images)) {
          images.forEach((img) => {
            let cx = img.worldPos?.x ?? 0;
            let cy = img.worldPos?.y ?? 0;
            if (img.mode === 'attached' && img.attachedNodeId) {
              const nm = this.nodeLayoutMap.get(img.attachedNodeId);
              if (!nm) return;
              cx = nm.x + (img.offset?.dx ?? 0);
              cy = nm.y + (img.offset?.dy ?? -84);
            }
            minX = Math.min(minX, cx - img.width / 2 - 20);
            maxX = Math.max(maxX, cx + img.width / 2 + 20);
            minY = Math.min(minY, cy - img.height / 2 - 20);
            maxY = Math.max(maxY, cy + img.height / 2 + 20);
          });
        }

        if (minX === Infinity) return { minX: -200, maxX: 200, minY: -150, maxY: 150, width: 400, height: 300 };
        return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
      }
    }

