      updateRelationshipLabel(relId, newLabel) {
        const rel = this.findRelationship(relId);
        if (!rel) return false;
        const trimmed = String(newLabel || '').trim();
        if (!trimmed || trimmed === rel.label) return false;
        this.pushHistory();
        rel.label = trimmed;
        return true;
      }

      deleteRelationship(relId) {
        const idx = this.relationships.findIndex(r => r.id === relId);
        if (idx === -1) return false;
        this.pushHistory();
        this.relationships.splice(idx, 1);
        if (this.selectedRelationshipId === relId) {
          this.selectedRelationshipId = null;
        }
        return true;
      }

      toggleNodeBoundary(nodeId) {
        const node = this.findNode(nodeId);
        if (!node) return null;
        this.pushHistory();
        if (node.boundary && node.boundary.enabled) {
          node.boundary.enabled = false;
          return { enabled: false, node };
        }
        node.boundary = {
          enabled: true,
          title: node.boundary?.title || '',
          color: node.color || '#a855f7'
        };
        return { enabled: true, node };
      }

      addSummaryForNodes(candidateNodeIds = []) {
        const ids = candidateNodeIds.length > 0
          ? candidateNodeIds
          : (this.selectedNodeIds.length > 0 ? this.selectedNodeIds : (this.selectedNodeId ? [this.selectedNodeId] : []));

        const validNodes = ids
          .map(id => this.findNode(id))
          .filter(n => n && n.side !== 'root' && n.parentId && !n.isSummary);

        if (validNodes.length === 0) return null;

        const firstNode = validNodes[0];
        const parent = this.findNode(firstNode.parentId);
        if (!parent) return null;

        const regularSiblings = parent.children.filter(c => !c.isSummary && c.side === firstNode.side);
        const selectedSiblingSet = new Set(
          validNodes.filter(n => n.parentId === parent.id && n.side === firstNode.side).map(n => n.id)
        );

        let minIdx = Infinity;
        let maxIdx = -1;
        regularSiblings.forEach((sib, idx) => {
          if (selectedSiblingSet.has(sib.id)) {
            if (idx < minIdx) minIdx = idx;
            if (idx > maxIdx) maxIdx = idx;
          }
        });

        if (minIdx === Infinity || maxIdx === -1) return null;

        const targetSlice = regularSiblings.slice(minIdx, maxIdx + 1);
        const targetIds = targetSlice.map(n => n.id);
        if (targetIds.length === 0) return null;

        this.pushHistory();
        const summaryId = this.generateId('sum');
        const summaryColor = ColorUtils.lighten(firstNode.color || '#10b981', 10);

        const summaryNode = {
          id: summaryId,
          text: this._labelText('Riepilogo'),
          parentId: parent.id,
          side: firstNode.side,
          collapsed: false,
          customOrder: parent.children.length,
          colorIndex: firstNode.colorIndex ?? 0,
          color: summaryColor,
          isSummary: true,
          summaryTargetIds: targetIds,
          boundary: null,
          children: []
        };

        parent.children.push(summaryNode);
        this.selectedNodeId = summaryId;
        this.selectedNodeIds = [summaryId];
        return summaryNode;
      }

