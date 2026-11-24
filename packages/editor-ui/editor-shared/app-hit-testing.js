      imageHandleHit(clientX, clientY) {
        const selected = this.state.findImage(this.state.selectedImageId);
        if (!selected) return null;
        const r = this.renderer.resolveImageWorldRect(selected);
        if (!r) return null;
        const p = this.renderer.screenToWorld(clientX, clientY);
        const allowance = Math.max(r.handleSize / 2, 9 / this.renderer.camera.zoom);
        for (const h of r.handles) if (Math.abs(p.x - h.x) <= allowance && Math.abs(p.y - h.y) <= allowance)
          return { type:'image-handle', item:selected, corner:h.corner, cursor:h.cursor };
        return null;
      }
      findHit(clientX, clientY) {
        const handle = this.imageHandleHit(clientX, clientY);
        if (handle) return handle;
        const p = this.renderer.screenToWorld(clientX, clientY);
        for (const img of this.state.images.filter(image=>image.zLayer!=='back').slice().reverse()) {
          const r = this.renderer.resolveImageWorldRect(img);
          if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return { type:'image', item:img };
        }
        let hit = null;
        for (const [id, m] of this.layout.nodeLayoutMap) {
          if (p.x >= m.x - m.width / 2 && p.x <= m.x + m.width / 2 && p.y >= m.y - m.height / 2 && p.y <= m.y + m.height / 2) hit = this.state.findNode(id);
        }
        if(hit)return {type:'node',item:hit};
        for(const img of this.state.images.filter(image=>image.zLayer==='back').slice().reverse()){
          const r=this.renderer.resolveImageWorldRect(img);
          if(r&&p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)return {type:'image',item:img};
        }
        return null;
      }
