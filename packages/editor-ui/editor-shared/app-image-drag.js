      updateImageControls() {
        const panel=document.getElementById('image-controls');if(!panel)return;
        const img=this.state?.findImage(this.state.selectedImageId);
        panel.classList.toggle('hidden',!img);if(!img)return;
        const slider=document.getElementById('img-width-slider');
        if(document.activeElement!==slider)slider.value=String(Math.round(img.width));
        document.getElementById('img-width-value').textContent=Math.round(img.width)+' px';
        document.getElementById('img-toggle-attach').textContent=img.mode==='attached'?'🔓 Sgancia':'⚓ Aggancia';
        document.getElementById('img-toggle-layer').textContent=img.zLayer==='back'?'⬆ Davanti':'⬇ Dietro';
      }
      beginImageDrag(hit,e) {
        const img=hit.item;
        this.selectImage(img.id);
        const rect=this.renderer.resolveImageWorldRect(img);
        if(!rect)return;
        this.drag={kind:hit.type==='image-handle'?'image-resize':'image-move',pointerId:e.pointerId,
          startX:e.clientX,startY:e.clientY,moved:false,historyTaken:false,
          original:MindMapStateMachine.cloneImages([img])[0],rect,
          corner:hit.corner||null};
        this.canvas.setPointerCapture(e.pointerId);
        this.canvas.style.cursor=hit.cursor||'move';
      }
      updateImageDrag(e) {
        const d=this.drag;if(!d||!d.kind.startsWith('image-'))return;
        const img=this.state.findImage(d.original.id);if(!img)return;
        const dx=(e.clientX-d.startX)/this.renderer.camera.zoom;
        const dy=(e.clientY-d.startY)/this.renderer.camera.zoom;
        if(Math.abs(dx)+Math.abs(dy)<2/this.renderer.camera.zoom && !d.moved)return;
        if(!d.historyTaken){this.state.pushHistory();d.historyTaken=true;}
        d.moved=true;
        if(d.kind==='image-move'){
          if(img.mode==='free')img.worldPos={x:d.original.worldPos.x+dx,y:d.original.worldPos.y+dy};
          else img.offset={dx:d.original.offset.dx+dx,dy:d.original.offset.dy+dy};
        } else {
          const r=d.rect,corner=d.corner;
          let left=r.x,right=r.x+r.w,top=r.y,bottom=r.y+r.h;
          if(corner.includes('w'))left+=dx;else right+=dx;
          if(corner.includes('n'))top+=dy;else bottom+=dy;
          // Shift releases the original aspect ratio, otherwise keep it while resizing.
          if(!e.shiftKey){
            const aspect=r.w/Math.max(1,r.h);
            const width=Math.max(30,Math.abs(right-left)),height=Math.max(20,Math.abs(bottom-top));
            if(width/aspect>height){if(corner.includes('w'))left=right-width;else right=left+width;
              if(corner.includes('n'))top=bottom-width/aspect;else bottom=top+width/aspect;}
            else{if(corner.includes('n'))top=bottom-height;else bottom=top+height;
              if(corner.includes('w'))left=right-height*aspect;else right=left+height*aspect;}
          }
          // Keep one corner fixed and clamp dimensions to prevent accidental inversions.
          const newW=Math.max(35,Math.min(2400,right-left));
          const newH=Math.max(25,Math.min(2000,bottom-top));
          if(corner.includes('w'))left=right-newW;else right=left+newW;
          if(corner.includes('n'))top=bottom-newH;else bottom=top+newH;
          img.width=newW;img.height=newH;
          const cx=(left+right)/2,cy=(top+bottom)/2;
          if(img.mode==='free')img.worldPos={x:cx,y:cy};
          else {const anchor=this.layout.getLayout(img.attachedNodeId);
            img.offset={dx:cx-(anchor?.x||0),dy:cy-(anchor?.y||0)};}
        }
        this.updateImageControls();this.requestRender();
      }
