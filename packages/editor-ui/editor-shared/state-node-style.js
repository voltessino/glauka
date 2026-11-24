      updateNodeText(nodeId, newText) {
        const node = this.findNode(nodeId);
        if (!node) return false;
        const trimmed = (newText || '').trim();
        if (!trimmed || trimmed === node.text) return false;

        this.pushHistory();
        node.text = trimmed;
        return true;
      }

      toggleCollapse(nodeId) {
        const node = this.findNode(nodeId);
        if (!node || node.side === 'root' || node.children.length === 0) return false;
        this.pushHistory();
        node.collapsed = !node.collapsed;
        return true;
      }

      invertBranchAndSubbranches(nodeId) {
        const node = this.findNode(nodeId);
        if (!node || !node.children || node.children.length <= 1) return false;

        this.pushHistory();
        node.children.reverse();
        this.normalizeChildrenOrder(node);
        return true;
      }

      updateNodeFontSize(nodeId, size, recordHistory = false) {
        const node = this.findNode(nodeId);
        const numeric = Number(size);
        // Invalid or temporarily empty inputs must never store NaN in a map.
        if(!node||size==null||(typeof size==='string'&&!size.trim())||
           !Number.isFinite(numeric))return false;
        const next=Math.max(9,Math.min(48,numeric));
        if(node.fontSize===next)return false;
        if(recordHistory)this.pushHistory();
        node.fontSize=next;
        return true;
      }

      updateNodeFontWeight(nodeId, weight) {
        const node = this.findNode(nodeId);
        if (!node) return false;
        this.pushHistory();
        node.fontWeight = Number(weight) === 400 ? 400 : 700;
        return true;
      }

      updateNodeColorWithPropagation(nodeId, hexColor) {
        const node = this.findNode(nodeId);
        if (!node || !hexColor) return false;
        this.pushHistory();

        // Branches imported from large outlines may be thousands of levels
        // deep. Avoid JavaScript recursion while preserving colour-by-depth.
        const pending=[{node,depth:0}];
        while(pending.length){
          const {node:current,depth}=pending.pop();
          current.color=depth===0?hexColor:ColorUtils.lighten(hexColor,Math.min(48,depth*12));
          for(let i=(current.children?.length||0)-1;i>=0;i--)
            pending.push({node:current.children[i],depth:depth+1});
        }
        return true;
      }

      applyGlobalTheme(themeId) {
        const palette = THEME_PALETTES[themeId];
        if (!palette || !this.root) return false;
        this.pushHistory();
        this.activeThemeId = themeId;

        for (let i = 0; i < palette.length; i++) {
          HARMONIC_PALETTE[i] = palette[i];
        }

        this.root.color = palette[0];
        this.root.children.forEach((primary, idx) => {
          const pColor=palette[idx%palette.length];
          primary.colorIndex=idx%palette.length;
          const pending=[{node:primary,depth:0}];
          while(pending.length){
            const {node:current,depth}=pending.pop();
            current.color=depth===0?pColor:ColorUtils.lighten(pColor,Math.min(48,depth*12));
            for(let i=(current.children?.length||0)-1;i>=0;i--)
              pending.push({node:current.children[i],depth:depth+1});
          }
        });

        return true;
      }

