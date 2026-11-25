    /**
     * ============================================================================
     * 2. DATA STRUCTURE & IMMUTABLE STATE MACHINE
     * ============================================================================
     */
    // Desktop user preference. Explicit per-map overrides are kept in the project file.
    const nm68ClampGap=value=>Number.isFinite(+value)?Math.max(30,Math.min(220,+value)):150;
    const nmClampRootBranchGap=value=>value!==undefined&&value!==null&&Number.isFinite(+value)?Math.round(Math.max(0,Math.min(48,+value))):14;
    const NM64_WRAP_PREF_KEY='nm64_default_wrap_chars';
    function nm64PreferredWrap(){
      try{const v=Number(localStorage.getItem(NM64_WRAP_PREF_KEY));
       return Number.isFinite(v)&&v>=8&&v<=60?v:48;}catch(_){return 48;}
    }
    function nm64WasCustom(saved){
      // 6.3 and earlier persisted the numeric value but not an explicit override flag.
      // Non-standard values were probably set deliberately: do not destroy them.
      if(saved?.wrapCustom!==undefined)return Boolean(saved.wrapCustom);
      const n=Number(saved?.defaultLabelWrapChars);
      return Number.isFinite(n)&&n>=8&&n<=60&&n!==18;
    }
    function nm64ApplyWrapPreference(state){
      if(!state)return;
      if(!state.wrapCustom)state.defaultLabelWrapChars=nm64PreferredWrap();
    }
    class MindMapStateMachine {
      constructor(localizeDefault = value => value) {
        Object.defineProperty(this,'_labelText',{value:typeof localizeDefault==='function'?localizeDefault:(value=>value)});
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 60;
        // Best-effort budget for retained undo/redo data, not a JavaScript heap reading.
        // Keep one most recent undo step even when a single project exceeds the limit.
        this.maxHistoryBytes = 64 * 1024 * 1024;
        this._historySizeCache = new WeakMap();
        this.paletteCounter = 0;
        this.thresholdY = 500; // legacy input, kept only for compatibility with older projects
        this.balanceBias = 50; // 0 left, 50 balanced by subtree heights, 100 right
        this.compactness = 55; // compact initial spacing; saved documents keep their explicit value
        this.branchGapX=nm70PreferredGap(); // explicit user default or minimum gap for new maps
        this.rootBranchGap = 14;
        this.strokeScale = 1;
        this.typographyPreset = 'uniform';
        this.typographyScale = 1;
        this.branchStyle = 'neon';
        this.defaultLabelWrapChars = nm64PreferredWrap();
        this.wrapCustom = false;
        this.activeThemeId = null;
        this.root = null;
        this.images = [];
        this.relationships = [];
        this.selectedNodeId = null;
        this.selectedNodeIds = [];
        this.selectedImageId = null;
        this.selectedRelationshipId = null;
        this.hoveredNodeId = null;
        this.hoveredImageId = null;
        this.hoveredRelationshipId = null;
        this.hoveredBadgeNodeId = null;
        this.isDirty = false;
      }

      // One validation path for snapshots, saved projects and hierarchy imports.
      static linkedMetadata(node) {
        return {
          viewMode: ['orgchart','concept-tree','concept-network','flowchart','kanban','timeline'].includes(node.viewMode) ? node.viewMode : undefined,
          // Root-owned, view-scoped appearance is included in project files and Undo/Redo.
          viewAppearance: node.viewAppearance && globalThis.NeuroMapViewAppearance?.clean(node.viewAppearance) || undefined,
          taskStatus: ['todo','doing','done'].includes(node.taskStatus) ? node.taskStatus : undefined,
          // Optional explicit flow geometry; auto remains inferred only for display.
          flowShape: ['start','end','process','decision','input','output'].includes(node.flowShape)?node.flowShape:undefined,
          taskOrder: Number.isInteger(node.taskOrder)&&node.taskOrder>=0&&node.taskOrder<2000 ? node.taskOrder : undefined,
          networkPosition: typeof NeuroMapConceptNetwork!=='undefined' ? NeuroMapConceptNetwork.position(node.networkPosition)||undefined : undefined,
          startDate: typeof NeuroMapWorkCore!=='undefined' ? NeuroMapWorkCore.parseDate(node.startDate)||undefined : undefined,
          dueDate: typeof NeuroMapWorkCore!=='undefined' ? NeuroMapWorkCore.parseDate(node.dueDate)||undefined : undefined
        };
      }

      static cloneTree(node) {
        if (!node) return null;
        const cloneSingle = node => ({
          id: node.id,
          text: node.text,
          layoutMode: node.layoutMode,
          layoutBalanceMode: node.layoutBalanceMode==='geometry'?'geometry':undefined,
          ...MindMapStateMachine.linkedMetadata(node),
          linkUrl: node.linkUrl,
          parentId: node.parentId,
          side: node.side,
          layoutDistribution: node.layoutDistribution ? NeuroMapCore.continuationSettings(node.layoutDistribution) : undefined,
          sidePinned: node.sidePinned === 'left' || node.sidePinned === 'right' ? node.sidePinned : null,
          collapsed: Boolean(node.collapsed),
          customOrder: Number(node.customOrder || 0),
          colorIndex: Number(node.colorIndex ?? 0),
          color: node.color,
          fontSize: node.fontSize ? Number(node.fontSize) : null,
          fontWeight: node.fontWeight != null ? Number(node.fontWeight) : null,
          fontItalic: Boolean(node.fontItalic),
          ...(node.fontUnderline===true?{fontUnderline:true}:{}),
          ...(node.fontStrike===true?{fontStrike:true}:{}),
          ...(['Inter','Arial','Verdana','Georgia','Times New Roman','Courier New'].includes(node.fontFamily)?{fontFamily:node.fontFamily}:{}),
          ...(/^#[0-9a-f]{6}$/i.test(node.fontColor||'')?{fontColor:node.fontColor}:{}),
          ...(/^#[0-9a-f]{6}$/i.test(node.fontHighlight||'')?{fontHighlight:node.fontHighlight}:{}),
          nodeShape:['pill','card','outline','hex','circuit','glass'].includes(node.nodeShape)?node.nodeShape:undefined,
          labelWrapChars: Number.isFinite(+node.labelWrapChars) && +node.labelWrapChars>=8 && +node.labelWrapChars<=60 ? +node.labelWrapChars : null,
          labelAlign:['left','center','right'].includes(node.labelAlign)?node.labelAlign:'center',
          labelIndent:Math.max(0,Math.min(45,Number(node.labelIndent)||0)),
          // Immutable catalogue ID and bounded size survive save, undo and import.
          objectArt: globalThis.NeuroMapCreativeCore?.objectArt(node.objectArt)||null,
          illustration: node.illustration && typeof node.illustration.svg==='string' && node.illustration.svg.length<=90000 ? {
            type:'iconify',prefix:String(node.illustration.prefix||'').slice(0,40),name:String(node.illustration.name||'').slice(0,100),
            keyword:String(node.illustration.keyword||'').slice(0,120),svg:node.illustration.svg
          } : null,
          manualOffset: node.manualOffset ? {dx:Number(node.manualOffset.dx)||0,dy:Number(node.manualOffset.dy)||0} : null,
          boundary: node.boundary ? {
            enabled: Boolean(node.boundary.enabled),
            title: String(node.boundary.title || ''),
            color: String(node.boundary.color || node.color || '#a855f7')
          } : null,
          taskDependsOn: Array.isArray(node.taskDependsOn) ? node.taskDependsOn.filter(x=>typeof x==='string' && /^[A-Za-z0-9_:-]{1,140}$/.test(x)).slice(0,12) : [],
          knowledge: typeof NeuroMapKnowledgeDB!=='undefined' ? NeuroMapKnowledgeDB.normalize(node.knowledge) : {tags:[],fields:{},dailyKey:''},
          notes: String(node.notes || ''),
          sourceRefs: typeof NeuroMapSourceCore!=='undefined' ? NeuroMapSourceCore.normalizeAll(node.sourceRefs) : [],
          markers: Array.isArray(node.markers) ? node.markers.filter(x=>typeof x==='string' && /^[a-z0-9-]{1,32}$/.test(x)).slice(0,3) : [],
          isFloating: Boolean(node.isFloating),
          floatingPosition: node.isFloating ? {x: Math.max(-20000,Math.min(20000,Number(node.floatingPosition?.x)||0)), y: Math.max(-20000,Math.min(20000,Number(node.floatingPosition?.y)||0))} : null,
          srStatus: [0,1,2,3].includes(Number(node.srStatus)) ? Number(node.srStatus) : 0,
          sr: node.sr && typeof node.sr === 'object' ? {
            lastReviewedAt: Number(node.sr.lastReviewedAt || 0),
            dueAt: Number(node.sr.dueAt || 0),
            intervalDays: Number(node.sr.intervalDays || 0),
            reviews: Number(node.sr.reviews || 0),
            lapses: Number(node.sr.lapses || 0)
          } : null,
          isSummary: Boolean(node.isSummary),
          summaryTargetIds: Array.isArray(node.summaryTargetIds) ? [...node.summaryTargetIds] : null,
          children: []
        });
        const result=cloneSingle(node),stack=[{source:node,copy:result}],seen=new WeakSet([node]);
        while(stack.length){
          const {source,copy}=stack.pop();
          for(const child of source.children||[]){
            if(!child||typeof child!=='object'||seen.has(child))
              throw Error('Struttura della mappa ciclica o condivisa: copia annullata.');
            seen.add(child);
            const next=cloneSingle(child);
            copy.children.push(next);
            stack.push({source:child,copy:next});
          }
        }
        return result;
      }

      static cloneRelationships(relationships = []) {
        if (!Array.isArray(relationships)) return [];
        return relationships.map(rel => ({
          id: String(rel.id),
          fromId: String(rel.fromId),
          toId: String(rel.toId),
          label: String(rel.label ?? 'Relazione'),
          color: String(rel.color || '#f43f5e'),
          // Optional typed transition. Untyped pre-6.16 relationships stay references.
          ...( ['sequence','yes','no'].includes(rel.kind) ? {kind:rel.kind} : {})
        }));
      }

      static cloneImages(images = []) {
        if (!Array.isArray(images)) return [];
        return images.map(img => ({
          id: String(img.id),
          src: String(img.src),
          width: Number(img.width || 135),
          height: Number(img.height || 100),
          naturalWidth: Number(img.naturalWidth || 0),
          naturalHeight: Number(img.naturalHeight || 0),
          aspectLocked: Boolean(img.aspectLocked),
          ...(globalThis.NeuroMapCaption ? (()=>{const c=globalThis.NeuroMapCaption.sanitize(img.caption,img.captionStyles);return {caption:c.text,...(c.spans.length?{captionStyles:c.spans}:{})}})() : {}),
          // Preserve caption typography across undo/redo, save, import and
          // desktop <-> Android roundtrips even if mobile does not edit it.
          captionAlign: ['left','center','right'].includes(img.captionAlign)?img.captionAlign:'left',
          captionFontSize: Number.isInteger(img.captionFontSize)&&img.captionFontSize>=9&&img.captionFontSize<=36?img.captionFontSize:11,
          zLayer: img.zLayer === 'back' ? 'back' : 'front',
          mode: img.mode === 'free' ? 'free' : 'attached',
          attachedNodeId: img.mode === 'free' ? null : (img.attachedNodeId || null),
          offset: {
            dx: Number(img.offset?.dx ?? 0),
            dy: Number(img.offset?.dy ?? -84)
          },
          worldPos: {
            x: Number(img.worldPos?.x ?? 0),
            y: Number(img.worldPos?.y ?? 0)
          },
          studyHotspots: typeof NeuroMapVisualStudyCore!=='undefined'
            ? NeuroMapVisualStudyCore.normalize(img.studyHotspots) : []
        }));
      }

      createSnapshot() {
        return {
          root: MindMapStateMachine.cloneTree(this.root),
          images: MindMapStateMachine.cloneImages(this.images),
          relationships: MindMapStateMachine.cloneRelationships(this.relationships),
          selectedNodeId: this.selectedNodeId,
          selectedNodeIds: [...(this.selectedNodeIds || [])],
          selectedImageId: this.selectedImageId,
          selectedRelationshipId: this.selectedRelationshipId,
          strokeScale: this.strokeScale,
          rootBranchGap: nmClampRootBranchGap(this.rootBranchGap),
          balanceBias: this.balanceBias, compactness: this.compactness, branchGapX:this.branchGapX,
          typographyPreset: this.typographyPreset, typographyScale: this.typographyScale,
          branchStyle: this.branchStyle, defaultLabelWrapChars: this.defaultLabelWrapChars,wrapCustom:this.wrapCustom,
          activeThemeId: this.activeThemeId
        };
      }

      estimateHistoryBytes(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return 0;
        const cached=this._historySizeCache.get(snapshot);
        if(cached!==undefined)return cached;
        // Iterative estimate so very deep maps do not overflow the JS call stack.
        // Deliberately estimates retained data, not an exact runtime heap size.
        let bytes=0;
        const seen=new WeakSet(),pending=[snapshot];
        while(pending.length){
          const item=pending.pop();
          if(item===null||item===undefined)continue;
          if(typeof item==='string'){bytes+=16+item.length*2;continue;}
          if(typeof item!=='object'){bytes+=8;continue;}
          if(seen.has(item))continue;
          seen.add(item);
          const keys=Object.keys(item);
          bytes+=48+keys.length*16;
          if(Array.isArray(item))bytes+=item.length*8;
          for(const key of keys){
            // Property names are generally shared by object shapes. Account
            // for the reference, not duplicate a key string for every node.
            pending.push(item[key]);
          }
        }
        this._historySizeCache.set(snapshot,bytes);
        return bytes;
      }

      effectiveHistoryBudgetBytes() {
        return Number.isFinite(this.maxHistoryBytes)&&this.maxHistoryBytes>0
          ?this.maxHistoryBytes:64*1024*1024;
      }

      getHistoryMemoryStats() {
        const sum=stack=>stack.reduce((n,snapshot)=>n+this.estimateHistoryBytes(snapshot),0);
        const undoBytes=sum(this.undoStack),redoBytes=sum(this.redoStack);
        return {undoSteps:this.undoStack.length,redoSteps:this.redoStack.length,
          estimatedUndoBytes:undoBytes,estimatedRedoBytes:redoBytes,
          estimatedTotalBytes:undoBytes+redoBytes,budgetBytes:this.effectiveHistoryBudgetBytes()};
      }

      trimHistoryStacks() {
        // Bound both directions together. A single most recent step in each
        // nonempty direction is retained, even if the project itself is huge.
        const allowed=this.effectiveHistoryBudgetBytes();
        const maxSteps=Math.max(1,Math.floor(Number(this.maxHistory)||60));
        let size=0;
        for(const stack of [this.undoStack,this.redoStack]){
          for(const entry of stack)size+=this.estimateHistoryBytes(entry);
          while(stack.length>maxSteps)
            size-=this.estimateHistoryBytes(stack.shift());
        }
        while(size>allowed){
          const candidate=this.undoStack.length>1?this.undoStack:
            this.redoStack.length>1?this.redoStack:null;
          if(!candidate)break;
          size-=this.estimateHistoryBytes(candidate.shift());
        }
      }

      pushHistorySnapshot(snapshot) {
        if (!snapshot || !snapshot.root) return;
        this.undoStack.push(snapshot);
        this.redoStack = [];
        this.trimHistoryStacks();
        this.isDirty = true;
      }

      pushHistory() {
        if (!this.root) return;
        this.pushHistorySnapshot(this.createSnapshot());
      }

      undo() {
        if (this.undoStack.length === 0) return false;
        this.redoStack.push(this.createSnapshot());
        this.trimHistoryStacks();
        const prev = this.undoStack.pop();
        this.root = prev.root;
        this.images = MindMapStateMachine.cloneImages(prev.images);
        this.relationships = MindMapStateMachine.cloneRelationships(prev.relationships);
        this.selectedNodeId = prev.selectedNodeId;
        this.selectedNodeIds = [...(prev.selectedNodeIds || [])];
        this.selectedImageId = prev.selectedImageId;
        this.selectedRelationshipId = prev.selectedRelationshipId || null;
        if (prev.strokeScale !== undefined) this.strokeScale = prev.strokeScale;
        if (prev.rootBranchGap !== undefined) this.rootBranchGap = nmClampRootBranchGap(prev.rootBranchGap);
        this.balanceBias=Number.isFinite(+prev.balanceBias)?Math.max(0,Math.min(100,+prev.balanceBias)):50;
        this.compactness=Number.isFinite(+prev.compactness)?Math.max(55,Math.min(145,+prev.compactness)):100;
        this.branchGapX=nm68ClampGap(prev.branchGapX);
        this.typographyPreset = prev.typographyPreset || 'uniform'; this.typographyScale = Number(prev.typographyScale)||1;
        this.branchStyle=prev.branchStyle||'neon';this.defaultLabelWrapChars=Number(prev.defaultLabelWrapChars)||nm64PreferredWrap();this.wrapCustom=Boolean(prev.wrapCustom);
        if (prev.activeThemeId !== undefined) this.activeThemeId = prev.activeThemeId;
        this.isDirty = true;
        return true;
      }

      redo() {
        if (this.redoStack.length === 0) return false;
        this.undoStack.push(this.createSnapshot());
        this.trimHistoryStacks();
        const next = this.redoStack.pop();
        this.root = next.root;
        this.images = MindMapStateMachine.cloneImages(next.images);
        this.relationships = MindMapStateMachine.cloneRelationships(next.relationships);
        this.selectedNodeId = next.selectedNodeId;
        this.selectedNodeIds = [...(next.selectedNodeIds || [])];
        this.selectedImageId = next.selectedImageId;
        this.selectedRelationshipId = next.selectedRelationshipId || null;
        if (next.strokeScale !== undefined) this.strokeScale = next.strokeScale;
        if (next.rootBranchGap !== undefined) this.rootBranchGap = nmClampRootBranchGap(next.rootBranchGap);
        this.balanceBias=Number.isFinite(+next.balanceBias)?Math.max(0,Math.min(100,+next.balanceBias)):50;
        this.compactness=Number.isFinite(+next.compactness)?Math.max(55,Math.min(145,+next.compactness)):100;
        this.branchGapX=nm68ClampGap(next.branchGapX);
        this.typographyPreset = next.typographyPreset || 'uniform'; this.typographyScale = Number(next.typographyScale)||1;
        this.branchStyle=next.branchStyle||'neon';this.defaultLabelWrapChars=Number(next.defaultLabelWrapChars)||nm64PreferredWrap();this.wrapCustom=Boolean(next.wrapCustom);
        if (next.activeThemeId !== undefined) this.activeThemeId = next.activeThemeId;
        this.isDirty = true;
        return true;
      }

      generateId(prefix = 'node') {
        return prefix + '_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36).slice(-3);
      }

      nextPaletteEntry() {
        const colorIndex = this.paletteCounter % HARMONIC_PALETTE.length;
        const color = HARMONIC_PALETTE[colorIndex];
        this.paletteCounter++;
        return { color, colorIndex };
      }

      findNode(id, current = this.root) {
        if (!current || !id) return null;
        // Preserve preorder first-match semantics, but do not consume the
        // JavaScript call stack on deeply nested maps (or loop on bad aliases).
        const pending=[current],seen=new WeakSet();
        while(pending.length){
          const node=pending.pop();
          if(!node||typeof node!=='object'||seen.has(node))continue;
          seen.add(node);
          if(node.id===id)return node;
          const children=Array.isArray(node.children)?node.children:[];
          for(let i=children.length-1;i>=0;i--)pending.push(children[i]);
        }
        return null;
      }

      findImage(imageId) {
        if (!imageId) return null;
        return this.images.find(img => img.id === imageId) || null;
      }

      findRelationship(relId) {
        if (!relId) return null;
        return this.relationships.find(r => r.id === relId) || null;
      }

      addRelationship(fromId, toId, label = 'Relazione', color = '#f43f5e') {
        if (!fromId || !toId || fromId === toId) return null;
        const fromNode = this.findNode(fromId);
        const toNode = this.findNode(toId);
        if (!fromNode || !toNode) return null;

        this.pushHistory();
        const rel = {
          id: this.generateId('rel'),
          fromId,
          toId,
          label: String(label || 'Relazione'),
          color: color || '#f43f5e'
        };
        this.relationships.push(rel);
        this.selectedRelationshipId = rel.id;
        return rel;
      }

      setNodeFlowShape(nodeId,value='auto') {
        if(typeof NeuroMapFlowCore==='undefined'||!this.root||!this.findNode)return false;
        const node=this.findNode(nodeId);
        if(!node||node===this.root||!NeuroMapFlowCore.SHAPES.includes(value))return false;
        const next=value==='auto'?undefined:value;
        if(node.flowShape===next)return false;
        this.pushHistory();
        node.flowShape=next;
        this.selectedNodeId=nodeId;
        return true;
      }

      addFlowTransition(fromId, toId, kind = 'sequence') {
        if (!['sequence','yes','no'].includes(kind) || fromId === toId) return null;
        if (!this.findNode(fromId) || !this.findNode(toId)) return null;
        const existing=this.relationships.find(r=>r.fromId===fromId&&r.toId===toId&&r.kind===kind);
        if (existing) return existing;
        const label = kind==='yes'?'Sì':kind==='no'?'No':'Segue';
        const item=this.addRelationship(fromId,toId,label,kind==='yes'?'#34d399':kind==='no'?'#f97373':'#818cf8');
        if(item)item.kind=kind;
        return item;
      }

      addFlowTransitionsBatch(transitions) {
        // User-confirmed candidates only: a sibling order never creates flows implicitly.
        if(!Array.isArray(transitions)||!transitions.length||transitions.length>100)return [];
        const selected=[],seen=new Set();
        for(const edge of transitions){
          if(!edge||edge.kind!=='sequence'||typeof edge.fromId!=='string'||typeof edge.toId!=='string'||edge.fromId===edge.toId)return [];
          if(!this.findNode(edge.fromId)||!this.findNode(edge.toId))return [];
          const key=edge.fromId+'\\x00'+edge.toId;
          if(seen.has(key))continue;
          seen.add(key);
          if(this.relationships.some(r=>r.kind==='sequence'&&r.fromId===edge.fromId&&r.toId===edge.toId))continue;
          selected.push({fromId:edge.fromId,toId:edge.toId});
        }
        if(!selected.length)return [];
        this.pushHistory();
        const created=selected.map(({fromId,toId})=>({
          id:this.generateId('rel'),fromId,toId,kind:'sequence',label:'Segue',color:'#818cf8'
        }));
        this.relationships.push(...created);
        return created;
      }

/* @neuromap-state-relationships-summary */
      addImageItem(payload, recordHistory = true) {
        if (!payload || !payload.src) return null;
        if (recordHistory) this.pushHistory();

        const imgItem = {
          id: payload.id || this.generateId('img'),
          src: String(payload.src),
          width: Number(payload.width || 135),
          height: Number(payload.height || 100),
          naturalWidth: Number(payload.naturalWidth || payload.width || 135),
          naturalHeight: Number(payload.naturalHeight || payload.height || 100),
          aspectLocked: Boolean(payload.aspectLocked),
          zLayer: payload.zLayer === 'back' ? 'back' : 'front',
          mode: payload.mode === 'free' ? 'free' : 'attached',
          attachedNodeId: payload.mode === 'free' ? null : (payload.attachedNodeId || this.root.id),
          offset: {
            dx: Number(payload.offset?.dx ?? 0),
            dy: Number(payload.offset?.dy ?? -84)
          },
          worldPos: {
            x: Number(payload.worldPos?.x ?? 0),
            y: Number(payload.worldPos?.y ?? 0)
          },
          studyHotspots: typeof NeuroMapVisualStudyCore!=='undefined'
            ? NeuroMapVisualStudyCore.normalize(payload.studyHotspots) : []
        };

        this.images.push(imgItem);
        this.selectedImageId = imgItem.id;
        return imgItem;
      }

      deleteImage(imageId) {
        const idx = this.images.findIndex(img => img.id === imageId);
        if (idx === -1) return false;
        this.pushHistory();
        this.images.splice(idx, 1);
        if (this.selectedImageId === imageId) {
          this.selectedImageId = null;
        }
        return true;
      }

      toggleImageZLayer(imageId) {
        const img = this.findImage(imageId);
        if (!img) return false;
        this.pushHistory();
        img.zLayer = img.zLayer === 'back' ? 'front' : 'back';
        return true;
      }

      resetImageAspectRatio(imageId, cachedElement = null) {
        const img = this.findImage(imageId);
        if (!img) return false;
        this.pushHistory();
        const natW = cachedElement?.naturalWidth || img.naturalWidth || 135;
        const natH = cachedElement?.naturalHeight || img.naturalHeight || 100;
        const ratio = natW / Math.max(1, natH);
        img.width = 135;
        img.height = Math.round(135 / ratio);
        img.naturalWidth = natW;
        img.naturalHeight = natH;
        img.aspectLocked = true;
        return true;
      }

      initStarterTree(customTitle = this._labelText('Mappa Centrale')) {
        this.undoStack = [];
        this.redoStack = [];
        this.paletteCounter = 0;
        this.images = [];
        this.relationships = [];
        this.selectedImageId = null;
        this.selectedRelationshipId = null;
        this.selectedNodeIds = [];
        this.isDirty = false;

        const rootId = this.generateId();
        this.root = {
          id: rootId,
          text: customTitle,
          parentId: null,
          side: 'root',
          collapsed: false,
          customOrder: 0,
          colorIndex: 0,
          color: '#6366f1',
          // New maps use a single reversible clockwise distribution. Old maps
          // without this opt-in retain their saved legacy behaviour.
          layoutMode: 'clockwise',
          layoutDistribution: {enabled:true,height:960,minimumHeight:480,overflowMode:'expand'},
          children: []
        };

        const starterBranches = [
          { title: '1. Strategia & Visione', subs: ['Obiettivi Q4', 'Analisi Mercato', 'KPI Chiave'] },
          { title: '2. Architettura Prodotto', subs: ['Motore Grafico', 'Esperienza Utente'] },
          { title: '3. Design Organico', subs: ['Curve di Bézier', 'Palette Armonica'] },
          { title: '4. Ricerca & Sviluppo', subs: ['Prototipi Rapidi', 'Test Usabilità'] },
          { title: '5. Operazioni & Lancio', subs: ['Piano Marketing', 'Distribuzione'] }
        ];

        starterBranches.forEach((b, idx) => {
          const { color, colorIndex } = this.nextPaletteEntry();
          const pId = this.generateId();
          const primaryNode = {
            id: pId,
            text: this._labelText(b.title),
            parentId: rootId,
            side: 'right',
            collapsed: false,
            customOrder: idx,
            colorIndex,
            color,
            children: []
          };

          const childColor = ColorUtils.lighten(color, 14);
          b.subs.forEach((subText, sIdx) => {
            primaryNode.children.push({
              id: this.generateId(),
              text: this._labelText(subText),
              parentId: pId,
              side: 'right',
              collapsed: false,
              customOrder: sIdx,
              colorIndex,
              color: childColor,
              children: []
            });
          });

          this.root.children.push(primaryNode);
        });

        this.selectedNodeId = rootId;
        this.selectedNodeIds = [rootId];
      }

      normalizeChildrenOrder(parent) {
        if (!parent || !parent.children) return;
        parent.children.forEach((child, idx) => {
          child.customOrder = idx;
        });
      }

      addChildNode(parentId, layoutEngine, defaultText = this._labelText('Nuovo Nodo')) {
        const parent = this.findNode(parentId);
        if (!parent) return null;

        this.pushHistory();
        parent.collapsed = false;

        const isRootParent = parent.side === 'root';
        let side = parent.side;
        let color = parent.color;
        let colorIndex = parent.colorIndex ?? 0;

        if (isRootParent) {
          const paletteEntry = this.nextPaletteEntry();
          color = paletteEntry.color;
          colorIndex = paletteEntry.colorIndex;
          side = 'right';
        } else {
          color = ColorUtils.lighten(parent.color, 12);
        }

        const newNode = {
          id: this.generateId(),
          text: defaultText,
          parentId: parent.id,
          side,
          collapsed: false,
          customOrder: parent.children.length,
          colorIndex,
          color,
          children: []
        };

        if (isRootParent) {
          parent.children.push(newNode);
        } else if (side === 'left' && !this.root.layoutDistribution?.enabled) {
          parent.children.unshift(newNode);
        } else {
          parent.children.push(newNode);
        }

        this.normalizeChildrenOrder(parent);
        this.selectedNodeId = newNode.id;
        this.selectedNodeIds = [newNode.id];
        this.selectedImageId = null;
        this.selectedRelationshipId = null;
        return newNode;
      }

      addSiblingNode(referenceNodeId, layoutEngine, isReverse = false) {
        const refNode = this.findNode(referenceNodeId);
        if (!refNode) return null;

        if (refNode.side === 'root' || !refNode.parentId) {
          return this.addChildNode(this.root.id, layoutEngine, this._labelText('Ramo Principale'));
        }

        const parent = this.findNode(refNode.parentId);
        if (!parent) return null;

        this.pushHistory();

        const isPrimary = parent.side === 'root';
        let color = refNode.color;
        let colorIndex = refNode.colorIndex ?? 0;

        if (isPrimary) {
          const paletteEntry = this.nextPaletteEntry();
          color = paletteEntry.color;
          colorIndex = paletteEntry.colorIndex;
        }

        const newNode = {
          id: this.generateId(),
          text: this._labelText(isPrimary ? 'Ramo Principale' : 'Nodo Fratello'),
          parentId: parent.id,
          side: refNode.side,
          collapsed: false,
          customOrder: 0,
          colorIndex,
          color,
          children: []
        };

        const idx = parent.children.findIndex(c => c.id === refNode.id);

        if (isPrimary || this.root.layoutDistribution?.enabled) {
          const insertPos = isReverse ? idx : idx + 1;
          parent.children.splice(insertPos, 0, newNode);
        } else {
          let insertIndex;
          if (!isReverse) {
            insertIndex = refNode.side === 'right' ? idx + 1 : idx;
          } else {
            insertIndex = refNode.side === 'right' ? idx : idx + 1;
          }
          parent.children.splice(insertIndex, 0, newNode);
        }

        this.normalizeChildrenOrder(parent);
        this.selectedNodeId = newNode.id;
        this.selectedNodeIds = [newNode.id];
        this.selectedImageId = null;
        this.selectedRelationshipId = null;
        return newNode;
      }

      deleteNode(nodeId) {
        if (!nodeId || nodeId === this.root.id) return false;
        const target = this.findNode(nodeId);
        if (!target || !target.parentId) return false;

        const parent = this.findNode(target.parentId);
        if (!parent) return false;

        this.pushHistory();
        const idx = parent.children.findIndex(c => c.id === nodeId);
        if (idx === -1) return false;

        parent.children.splice(idx, 1);
        this.normalizeChildrenOrder(parent);

        // Hidden descendants still exist: visibility-filtered getAllNodes() is unsafe
        // when cleaning images, relationships, or summary references.
        const remainingIds = new Set(this.getAllNodesIncludingCollapsed().map(n => n.id));
        this.images = this.images.filter(
          img => img.mode === 'free' || (img.attachedNodeId && remainingIds.has(img.attachedNodeId))
        );
        this.relationships = this.relationships.filter(
          rel => remainingIds.has(rel.fromId) && remainingIds.has(rel.toId)
        );

        const pending=[this.root],seen=new Set();
        while(pending.length){
          const curr=pending.pop();
          if(!curr||!Array.isArray(curr.children)||seen.has(curr))continue;
          seen.add(curr);
          curr.children=curr.children.filter(child=>{
            if(!child.isSummary)return true;
            child.summaryTargetIds=(child.summaryTargetIds||[]).filter(id=>remainingIds.has(id));
            return child.summaryTargetIds.length>0;
          });
          for(let i=curr.children.length-1;i>=0;i--)pending.push(curr.children[i]);
        }

        if (parent.children.length > 0) {
          const nextIdx = Math.min(idx, parent.children.length - 1);
          this.selectedNodeId = parent.children[nextIdx].id;
        } else {
          this.selectedNodeId = parent.id;
        }
        this.selectedNodeIds = [this.selectedNodeId];
        return true;
      }

      setNodeNetworkPosition(nodeId,value) {
        const node=this.findNode(nodeId);
        const next=typeof NeuroMapConceptNetwork!=='undefined' ? NeuroMapConceptNetwork.position(value) : null;
        if(!node||!next)return false;
        const old=node.networkPosition;
        if(old&&old.x===next.x&&old.y===next.y)return false;
        this.pushHistory();
        node.networkPosition=next;
        return true;
      }

      setNodeTaskDependencies(nodeId,dependsOn=[]) {
        if(typeof NeuroMapWorkCore==='undefined')return false;
        let checked;
        try{checked=NeuroMapWorkCore.validateDependencies(this.root,nodeId,dependsOn);}
        catch(error){this._nmLastDependencyError=String(error.message||error);return false;}
        const node=this.findNode(nodeId);
        const old=NeuroMapWorkCore.cleanDependencies(node.taskDependsOn);
        if(old.length===checked.length&&old.every((x,i)=>x===checked[i]))return false;
        this.pushHistory();
        node.taskDependsOn=checked;
        this._nmLastDependencyError='';
        return true;
      }

      setNodeWorkMetadata(nodeId,metadata={}) {
        const node=this.findNode(nodeId);
        if(!node||node===this.root||!metadata||typeof metadata!=='object')return false;
        const next={};
        if(Object.prototype.hasOwnProperty.call(metadata,'taskStatus')){
          if(metadata.taskStatus!==''&&!['todo','doing','done'].includes(metadata.taskStatus))return false;
          next.taskStatus=metadata.taskStatus||undefined;
        }
        for(const key of ['startDate','dueDate']){
          if(Object.prototype.hasOwnProperty.call(metadata,key)){
            if(metadata[key]!==''&&NeuroMapWorkCore.parseDate(metadata[key])!==metadata[key])return false;
            next[key]=metadata[key]||undefined;
          }
        }
        const start=Object.prototype.hasOwnProperty.call(next,'startDate')?next.startDate:node.startDate;
        const end=Object.prototype.hasOwnProperty.call(next,'dueDate')?next.dueDate:node.dueDate;
        if(start&&end&&start>end)return false;
        const changed=Object.keys(next).some(key=>node[key]!==next[key]);
        if(!changed)return false;
        // An inspector state change must also append to the destination
        // column, even if that column contains legacy tasks without ranks.
        // Plan before history, then commit dates+status+order as ONE undo step.
        const statusChanged=Object.prototype.hasOwnProperty.call(next,'taskStatus')&&
          node.taskStatus!==next.taskStatus;
        let rankPlan=null,rankPatches=[];
        if(statusChanged&&typeof NeuroMapWorkCore!=='undefined'){
          try{
            rankPlan=NeuroMapWorkCore.planKanbanMove(
              this.root,nodeId,next.taskStatus||'unassigned');
            if(rankPlan){
              rankPatches=rankPlan.changes.map(change=>({node:this.findNode(change.id),change}));
              if(rankPatches.some(item=>!item.node||item.node===this.root))return false;
            }
          }catch(error){this._nmLastKanbanMoveError=String(error?.message||error);return false;}
        }
        this.pushHistory();
        if(statusChanged&&!rankPlan)node.taskOrder=undefined;
        for(const {node:task,change}of rankPatches){
          if(Object.prototype.hasOwnProperty.call(change,'taskStatus'))
            task.taskStatus=change.taskStatus==='unassigned'?undefined:change.taskStatus;
          task.taskOrder=change.taskOrder;
        }
        Object.assign(node,next);
        return true;
      }

      // A single undoable operation for all Kanban interactions. The board
      // order belongs to task metadata, never to the mind-map branch order.
      moveKanbanTask(nodeId,targetStatus,beforeId=null) {
        if(typeof NeuroMapWorkCore==='undefined'||!this.root)return false;
        let plan;
        try{plan=NeuroMapWorkCore.planKanbanMove(this.root,nodeId,targetStatus,beforeId);}
        catch(error){this._nmLastKanbanMoveError=String(error?.message||error);return false;}
        if(!plan||!plan.changes.length)return false;
        // Resolve every node before recording history; malformed IDs cannot
        // leave a half-applied batch or an orphan undo step.
        const patches=plan.changes.map(change=>({node:this.findNode(change.id),change}));
        if(patches.some(item=>!item.node||item.node===this.root))return false;
        this.pushHistory();
        for(const {node,change}of patches){
          if(Object.prototype.hasOwnProperty.call(change,'taskStatus'))
            node.taskStatus=change.taskStatus==='unassigned'?undefined:change.taskStatus;
          node.taskOrder=change.taskOrder;
        }
        this.selectedNodeId=nodeId;
        this.selectedNodeIds=[nodeId];
        this._nmLastKanbanMoveError='';
        return true;
      }

/* @neuromap-state-node-style */
      setStrokeScale(scale) {
        const numeric = Number(scale);
        if (![0.5, 1, 1.5].includes(numeric)) return false;
        if (this.strokeScale === numeric) return false;
        this.pushHistory();
        this.strokeScale = numeric;
        return true;
      }

      // Logical traversal for integrity checks. Keep getAllNodes() visibility-filtered
      // for canvas selection, range operations and rendering.
      getAllNodesIncludingCollapsed() {
        const result = [], pending = this.root ? [this.root] : [];
        while (pending.length) {
          const node = pending.pop();
          result.push(node);
          for (let i = (node.children?.length || 0) - 1; i >= 0; i--) pending.push(node.children[i]);
        }
        return result;
      }

      getAllNodes(current = this.root, list = []) {
        if (!current) return list;
        const pending=[current],seen=new WeakSet();
        while(pending.length){
          const node=pending.pop();
          if(!node||typeof node!=='object'||seen.has(node))continue;
          seen.add(node);list.push(node);
          if(!node.collapsed&&node.children)
            for(let i=node.children.length-1;i>=0;i--)pending.push(node.children[i]);
        }
        return list;
      }
    }

