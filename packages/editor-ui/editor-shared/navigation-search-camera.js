    const $v4=id=>document.getElementById(id);
    const hideV4=id=>$v4(id)?.classList.add('hidden');
    const showV4=id=>$v4(id)?.classList.remove('hidden');
    const boundedV4=(n,min,max)=>Math.min(max,Math.max(min,n));

    // Camera controller is shared by Spotlight and the in-app spaced-repetition player.
    NeuroMapApp.prototype.stopTeleport=function(){if(this._teleportFrame)cancelAnimationFrame(this._teleportFrame);this._teleportFrame=null;};
    NeuroMapApp.prototype.teleportToNode=function(nodeId,tabId=this.activeTabId){
      this.stopTeleport();
      if(tabId!==this.activeTabId)this.activateTab(tabId);
      const node=this.state.findNode(nodeId);if(!node)return false;
      let ancestor=node;let expanded=false;
      while(ancestor.parentId){ancestor=this.state.findNode(ancestor.parentId);if(!ancestor)break;
        if(ancestor.collapsed){if(!expanded)this.state.pushHistory();ancestor.collapsed=false;expanded=true;}}
      if(expanded)this.recalculateAndRender(true);else this.recalculateAndRender();
      const m=this.layout.getLayout(nodeId);if(!m)return false;
      this.selectNode(nodeId);
      const cam=this.renderer.camera;
      const start={x:cam.x,y:cam.y,zoom:cam.zoom};
      const zoom=boundedV4(Math.min(1.15,Math.max(.55,Math.min(innerWidth*.72/Math.max(1,m.width),innerHeight*.58/Math.max(1,m.height)))),.18,2.5);
      const target={zoom,x:innerWidth*.5-m.x*zoom,y:(innerHeight*.53)-m.y*zoom};
      const begun=performance.now();this._teleportNonce=(this._teleportNonce||0)+1;const nonce=this._teleportNonce;
      const tick=(now)=>{
        if(nonce!==this._teleportNonce)return;
        const p=boundedV4((now-begun)/450,0,1);const smooth=1-Math.pow(1-p,3);
        cam.zoom=start.zoom+(target.zoom-start.zoom)*smooth;
        cam.x=start.x+(target.x-start.x)*smooth;
        cam.y=start.y+(target.y-start.y)*smooth;
        this.requestRender();
        if(p<1)this._teleportFrame=requestAnimationFrame(tick);
        else{this._teleportFrame=null;this.updateStatus();this.renderer.startRadar(nodeId,()=>this.requestRender());}
      };
      this._teleportFrame=requestAnimationFrame(tick);
      return true;
    };
    OrganicCanvasRenderer.prototype.startRadar=function(nodeId,rerender){
      this.pulse={nodeId,start:performance.now(),duration:2000};this._pulseRender=rerender;rerender();
    };
    OrganicCanvasRenderer.prototype.drawRadarPulse=function(){
      const pulse=this.pulse;if(!pulse)return;
      const elapsed=performance.now()-pulse.start;
      if(elapsed>=pulse.duration){this.pulse=null;this._pulseRender=null;return;}
      const m=this.layout.getLayout(pulse.nodeId);
      if(m){const ctx=this.ctx;
        for(const lag of [0,320]){
          const p=(elapsed-lag)/(pulse.duration-lag);if(p<0||p>1)continue;
          const travel=10+96*p;
          ctx.save();ctx.strokeStyle=`rgba(129, 220, 255, ${(.85*(1-p)).toFixed(3)})`;
          ctx.lineWidth=Math.max(1.4,3.2-1.4*p);ctx.shadowColor='rgba(56,189,248,.85)';ctx.shadowBlur=24*(1-p);
          this.roundRectPath(m.x-m.width/2-travel,m.y-m.height/2-travel,m.width+travel*2,m.height+travel*2,16+travel*.38);
          ctx.stroke();ctx.restore();
        }
      }
      // request one more frame only while the pulse exists; there is no idle animation loop.
      if(this._pulseRender)this._pulseRender();
    };
    const originalRenderV4=OrganicCanvasRenderer.prototype.render;
    // Radar must be drawn inside the camera transform. Replace the terminal image render marker in source patch.

    // Spotlight works directly over tab roots (no JSON clones on keystrokes).
    NeuroMapApp.prototype.buildSpotlightIndex=function(){
      this.saveActiveTabSnapshot();
      const result=[];
      for(const tab of this.tabs){
        if(!tab.state?.root)continue;
        const walk=(node,crumb)=>{
          const text=String(node.text||'');const path=crumb.concat(text);
          result.push({tabId:tab.id,tabTitle:tab.title||tab.state.root.text,id:node.id,text,
            folded:text.toLocaleLowerCase(),breadcrumb:path.join(' › '),color:node.color||'#818cf8',depth:path.length});
          for(const child of node.children||[])walk(child,path);
        };
        walk(tab.state.root,[]);
      }
      this._spotlightIndex=result;return result;
    };
    NeuroMapApp.prototype.openFind=function(){
      this.closeEditor(true);this.saveActiveTabSnapshot();
      showV4('find-overlay');const input=$v4('find-query');
      input.value='';this._spotlightActive=0;input.focus({preventScroll:true});this.updateFindResults();
    };
    NeuroMapApp.prototype.closeFind=function(){hideV4('find-overlay');this._spotlightResults=[];};
    NeuroMapApp.prototype.updateFindResults=function(){
      const host=$v4('find-results');if(!host)return;
      const q=$v4('find-query').value.trim().toLocaleLowerCase();
      host.replaceChildren();this._spotlightResults=[];
      if(!q){const h=document.createElement('div');h.className='find-hint';h.textContent=globalThis.GlaukaTouchGuidance?.text('search')??'Cerca in tutte le schede · ↑↓ naviga · Invio teletrasporta';host.appendChild(h);return;}
      const index=this._spotlightIndex||this.buildSpotlightIndex();
      const matches=index.filter(n=>n.folded.includes(q));
      matches.sort((a,b)=>{
        const rank=n=>n.folded===q?0:n.folded.startsWith(q)?1:2;
        return rank(a)-rank(b) || (a.tabId===this.activeTabId?-1:0)-(b.tabId===this.activeTabId?-1:0) || a.depth-b.depth;
      });
      this._spotlightResults=matches.slice(0,75);
      this._spotlightActive=boundedV4(this._spotlightActive||0,0,Math.max(0,this._spotlightResults.length-1));
      for(let i=0;i<this._spotlightResults.length;i++){
        const r=this._spotlightResults[i];const b=document.createElement('button');b.type='button';b.className='find-result spotlight-result';
        b.dataset.spotlightIndex=i;b.setAttribute('role','option');b.setAttribute('aria-selected',String(i===this._spotlightActive));
        const dot=document.createElement('span');dot.className='spotlight-dot';dot.style.background=r.color;
        const body=document.createElement('span');body.className='spotlight-body';
        const line=document.createElement('span');line.className='spotlight-main';line.textContent=r.text;
        const path=document.createElement('span');path.className='spotlight-path';path.textContent=r.breadcrumb;
        const tab=document.createElement('span');tab.className='spotlight-tab';tab.textContent=r.tabTitle;
        body.append(line,path);b.append(dot,body,tab);
        b.addEventListener('mouseenter',()=>this.setSpotlightActive(i,false));
        b.addEventListener('click',()=>this.chooseSpotlight(i));host.appendChild(b);
      }
      if(!matches.length){const p=document.createElement('div');p.className='find-hint';p.textContent='Nessuna corrispondenza';host.appendChild(p);}
      $v4('spotlight-count').textContent=`${matches.length}${matches.length>75?' (primi 75)':''} risultati · ${new Set(matches.map(r=>r.tabId)).size} schede`;
    };
    NeuroMapApp.prototype.setSpotlightActive=function(index,scroll=true){
      const list=this._spotlightResults||[];if(!list.length)return;
      this._spotlightActive=(index+list.length)%list.length;
      $v4('find-results').querySelectorAll('[data-spotlight-index]').forEach((el,i)=>{
        el.setAttribute('aria-selected',String(i===this._spotlightActive));if(i===this._spotlightActive&&scroll)el.scrollIntoView({block:'nearest'});
      });
    };
    NeuroMapApp.prototype.chooseSpotlight=function(i){const r=this._spotlightResults?.[i];if(!r)return;
      this.closeFind();this.teleportToNode(r.id,r.tabId);
    };

