      importHierarchy(source, options = {}) {
        if (!source || typeof source !== 'object') throw new Error('Struttura della mappa vuota.');
        if(options.newTab!==false){if(this.tabs.length>=(globalThis.GlaukaNativeOpen?.MAX_TABS||100))throw Error('Troppe schede aperte: chiudine alcune prima di importare.');}
        const title = String(source.text || source.title || (globalThis.GlaukaI18n?.translate('Mappa importata')||'Mappa importata'));
        const state = this.newState(title);
        let count = 0;
        const images = [];
        const usedSourceIds=new Set();
        const walk = (topic, parentId, side, color, index = 0, depth = 0) => {
          if (++count > 3500) throw Error('La mappa contiene oltre 3500 nodi: limite di sicurezza raggiunto.');
          if (depth > 100) throw Error('La struttura contiene troppi livelli di annidamento.');
          // Native 6.17 files keep their logical node IDs across reopen.
          // External XMind/Markdown imports still generate fresh safe IDs.
          const proposed=options.preserveIds && typeof topic.id==='string' && /^[a-zA-Z0-9_-]{3,128}$/.test(topic.id)
            ?topic.id:null;
          let id=proposed&&!usedSourceIds.has(proposed)?proposed:state.generateId();
          while(usedSourceIds.has(id))id=state.generateId();
          usedSourceIds.add(id);
          const children = Array.isArray(topic.children) ? topic.children : [];
          const n = { ...MindMapStateMachine.cloneTree({...topic,children:[]}), id, text:String(topic.text || topic.title || 'Nodo').trim() || 'Nodo',
            ...MindMapStateMachine.linkedMetadata(topic),
            parentId, side, layoutMode:topic.layoutMode, linkUrl:topic.linkUrl, layoutDistribution:topic.layoutDistribution?NeuroMapCore.continuationSettings(topic.layoutDistribution):undefined, sidePinned:['left','right'].includes(topic.sidePinned)?topic.sidePinned:null, collapsed:Boolean(topic.collapsed), customOrder:index,
            srStatus:[0,1,2,3].includes(Number(topic.srStatus)) ? Number(topic.srStatus) : 0,
            sr: topic.sr && typeof topic.sr==='object' ? {
              lastReviewedAt:Number(topic.sr.lastReviewedAt||0), dueAt:Number(topic.sr.dueAt||0),
              intervalDays:Number(topic.sr.intervalDays||0), reviews:Number(topic.sr.reviews||0),
              lapses:Number(topic.sr.lapses||0)
            } : null,
            knowledge: typeof NeuroMapKnowledgeDB!=='undefined' ? NeuroMapKnowledgeDB.normalize(topic.knowledge) : {tags:[],fields:{},dailyKey:''},
            notes:String(topic.notes||''),
            sourceRefs:NeuroMapSourceCore.normalizeAll(topic.sourceRefs),
            fontSize:topic.fontSize||null,fontWeight:topic.fontWeight||null,fontItalic:!!topic.fontItalic,
            nodeShape:['pill','card','outline','hex','circuit','glass'].includes(topic.nodeShape)?topic.nodeShape:undefined,
            labelWrapChars:Number(topic.labelWrapChars)||null,labelAlign:['left','center','right'].includes(topic.labelAlign)?topic.labelAlign:'center',
            labelIndent:Math.max(0,Math.min(45,Number(topic.labelIndent)||0)),illustration:topic.illustration?.svg?{...topic.illustration}:null,
            manualOffset:topic.manualOffset ? {dx:Number(topic.manualOffset.dx)||0,dy:Number(topic.manualOffset.dy)||0}:null,
            boundary:topic.boundary||null,isSummary:Boolean(topic.isSummary),
            summaryTargetIds:Array.isArray(topic.summaryTargetIds)?[...topic.summaryTargetIds]:null,
            colorIndex:options.preserveIds&&Number.isInteger(topic.colorIndex)&&topic.colorIndex>=0&&topic.colorIndex<HARMONIC_PALETTE.length
              ?topic.colorIndex:index%HARMONIC_PALETTE.length, color:topic.color || color, children:[] };
          if (topic.image?.src) images.push({ nodeId:id, image:topic.image });
          n.children = children.map((c,i) => {
            const branchColor = side === 'root' ? HARMONIC_PALETTE[i % HARMONIC_PALETTE.length] : color;
            return walk(c, id, side === 'root' ? (['left','right'].includes(c.side)?c.side:'right') : side, branchColor, i, depth+1);
          });
          return n;
        };
        state.root = walk(source, null, 'root', '#6366f1');
        if(typeof NeuroMapWikiLinks!=='undefined'&&source.id){
          const map=new Map(),pairs=[{old:source,now:state.root}];
          for(let j=0;j<pairs.length;j++){
            const {old,now}=pairs[j];if(old?.id)map.set(old.id,map.has(old.id)?null:now.id);
            for(let k=0;k<(old.children||[]).length;k++)
              pairs.push({old:old.children[k],now:now.children[k]});
          }
          for(const entry of pairs)
            entry.now.notes=NeuroMapWikiLinks.remapInternal(entry.now.notes,source.id,state.root.id,map);
        }
        state.root.side = 'root'; state.selectedNodeId = state.root.id; state.selectedNodeIds = [state.root.id];
        for (const {nodeId, image} of images) {
          state.images.push({ id:state.generateId('image'), src:image.src,
            width:Math.min(900,Math.max(40,Number(image.width)||135)),
            height:Math.min(900,Math.max(25,Number(image.height)||100)),
            mode:'attached', attachedNodeId:nodeId, zLayer:'front', aspectLocked:true,
            offset:{dx:0,dy:-95}, worldPos:{x:0,y:0} });
        }
        state.isDirty = true;
        this._nmHomePlaceholder=false;
        if (options.newTab !== false) {
          this.saveActiveTabSnapshot(); const tab=this.addTab(state, title);options.onImportTab?.(tab);
        } else {
          if(options.targetTabId){
            if(!this.tabs.some(t=>t.id===options.targetTabId))throw Error('La scheda da sostituire non è più aperta.');
            if(this.activeTabId!==options.targetTabId)this.activateTab(options.targetTabId);
          }
          this.closeEditor(false);
          const tab = this.tabs.find(t => t.id === this.activeTabId);
          if (tab) { tab.state = state; tab.camera = null;
            tab.viewWorkspace=nmCleanViewWorkspace(null); tab.title = title; options.onImportTab?.(tab); }
          this.state = state; this.renderer.state = state;
          this.recalculateAndRender(); this.fitToScreen(); this.renderTabBar();
        }
        this.scheduleSave();
        return count;
      }
      parseTextHierarchy(text, ext) {
        if (ext === 'json' || ext === 'neuromap' || ext === 'glk' || ext === 'gk') {
          const d = JSON.parse(text);
          if (d.schema === 'NeuroMapArchitect-WorkspaceBatch-v6' && Array.isArray(d.tabs)) return { workspace:d.tabs };
          const root = d.root || d;
          if (!root || typeof root !== 'object' || !root.text) throw Error('JSON senza nodo principale valido.');
          return { root, meta:d };
        }
        if (ext === 'opml' || ext === 'xml') {
          const doc = new DOMParser().parseFromString(text, 'application/xml');
          if (doc.querySelector('parsererror')) throw Error('XML/OPML non valido.');
          const outlines = [...doc.querySelectorAll('body > outline')];
          if (!outlines.length) throw Error('Nessuna mappa OPML trovata.');
          const convert = el => ({ text:el.getAttribute('text') || el.getAttribute('title') || 'Nodo',
            children:[...el.children].filter(c => c.localName === 'outline').map(convert) });
          return {root:outlines.length===1?convert(outlines[0]):{text:(globalThis.GlaukaI18n?.translate('Mappa importata')||'Mappa importata'),children:outlines.map(convert)}};
        }
        // Markdown batch exports contain independent map documents separated by ---.
        // Single and batch import both use the same outline parser as Ctrl+V.
        const docs=String(text||'').replace(/\r\n?/g,'\n').split(/^\s*---\s*$/m)
          .map(t=>t.trimEnd()).filter(t=>t.trim());
        if (!docs.length) throw Error('Il file è vuoto.');
        const parseDoc = part => {
          const forest=nm66ParseIndentedForest(part,{markdown:ext==='md'||ext==='markdown'});
          if(!forest.length)throw Error('Nessun nodo valido nel documento.');
          if(ext==='md'||ext==='markdown'){const decode=(n)=>{n.text=NeuroMapCore.decodeMarkdownLabel(n.text||'');(n.children||[]).forEach(decode);};forest.forEach(decode);}
          if(forest.length===1)return forest[0];
          // Multiple independent top-level lines have no implicit parent.
          // A synthetic root preserves their sibling relationship.
          return {text:(globalThis.GlaukaI18n?.translate('Mappa importata')||'Mappa importata'),children:forest};
        };
        if(docs.length>20)throw Error('Il Markdown contiene più di 20 sezioni: dividilo in più file.');
        if(docs.length>1 && (ext==='md'||ext==='markdown'))
          return {workspace:docs.map(part=>({root:parseDoc(part)}))};
        return {root:parseDoc(docs.join('\n'))};
      }

      async importFile(file, options={}) {
        const ext = (file.name.split('.').pop()||'').toLowerCase();
        if (file.size > 100*1024*1024) throw Error('File troppo grande (limite 100 MB).');
        if (ext === 'xmind') {
          const {contentJsonText,contentXmlText,resourceMap,nativeWorkspaceText} = options.preparedArchive || await this.io.parseZipArchiveInMemory(await file.arrayBuffer());
          if(nativeWorkspaceText){
            // Native metadata retains layout, detached images, relationships and study cards.
            return await this.importFile(new File([nativeWorkspaceText], 'neuromap-import.json'), options);
          }
          if (!contentJsonText && !contentXmlText) throw Error('File XMind non riconosciuto: manca content.json o content.xml.');
          // Parse every sheet before changing the workspace. Both modern JSON
          // and legacy XML archives can contain multiple maps.
          let roots;
          if (contentJsonText) {
            const data=JSON.parse(contentJsonText),sheets=Array.isArray(data)?data:[data];
            if(!sheets.length)throw Error('Il file XMind non contiene mappe.');
            roots=sheets.map(sheet=>this.io.parseXMindJsonToHierarchy(JSON.stringify([sheet]),resourceMap));
          } else {
            const doc=new DOMParser().parseFromString(contentXmlText,'text/xml');
            if(doc.querySelector('parsererror'))throw Error('XML XMind non valido.');
            const count=doc.querySelectorAll('sheet').length||1;
            roots=Array.from({length:count},(_,i)=>this.io.parseXMindXmlToHierarchy(contentXmlText,resourceMap,i));
          }
          // Validate every sheet before committing any of this file's tabs.
          if(this.tabs.length+roots.length-(options.newTab===false?1:0)>(globalThis.GlaukaNativeOpen?.MAX_TABS||100))throw Error('Troppe schede aperte: chiudine alcune prima di importare.');
          for(const root of roots){let count=0;const stack=[{node:root,depth:0}];while(stack.length){const {node,depth}=stack.pop();if(++count>3500)throw Error('La mappa contiene oltre 3500 nodi: limite di sicurezza raggiunto.');if(depth>100)throw Error('La struttura contiene troppi livelli di annidamento.');for(const child of node.children||[])stack.push({node:child,depth:depth+1});}}
          let total=0;
          for(let i=0;i<roots.length;i++){
            const imported=this.importHierarchy(roots[i],{...options,newTab:i===0?options.newTab!==false:true});
            if(!imported)break;
            total+=imported;
          }
          return total;
        }
        const parsed = options.preparedHierarchy || this.parseTextHierarchy(await file.text(),ext);
        if (parsed.workspace) {
          const total = NeuroMapCore.validateWorkspaceTabs(parsed.workspace);
          if(this.tabs.length+parsed.workspace.length>(globalThis.GlaukaNativeOpen?.MAX_TABS||100))throw Error('Troppe schede aperte: chiudine alcune prima di importare.');
          const prepared = [];
          for (const item of parsed.workspace) {
            const state = this.newState(item.root.text || (globalThis.GlaukaI18n?.translate('Scheda importata')||'Scheda importata'));
            state.root = MindMapStateMachine.cloneTree(item.root);
            // Normalize optional fields from legacy or external NeuroMap backups.
            // Missing colors/parent pointers must not crash Canvas rendering.
            const normalize=(node,parent,depth,index,branchColor)=>{
              node.id ||= state.generateId();node.parentId=parent?.id||null;
              node.side=parent ? (parent.side==='root'?(['left','right'].includes(node.side)?node.side:'right'):parent.side) : 'root';
              node.color ||= branchColor;node.colorIndex ??= index;
              node.customOrder ??= index;node.children=Array.isArray(node.children)?node.children:[];
              node.children.forEach((child,i)=>normalize(child,node,depth+1,i,
                parent===null ? HARMONIC_PALETTE[i%HARMONIC_PALETTE.length] : node.color));
            };
            normalize(state.root,null,0,0,'#6366f1');

            state.images=MindMapStateMachine.cloneImages(item.images||[]);
            state.relationships=MindMapStateMachine.cloneRelationships(item.relationships||[]);
            state.thresholdY=item.thresholdY != null && Number.isFinite(Number(item.thresholdY)) ? Number(item.thresholdY) : 500;
            state.balanceBias=Number.isFinite(+item.balanceBias)?Math.max(0,Math.min(100,+item.balanceBias)):50;
            state.compactness=Number.isFinite(+item.compactness)?Math.max(55,Math.min(145,+item.compactness)):100;
            state.branchGapX=nm68ClampGap(item.branchGapX);
            state.strokeScale=Number(item.strokeScale)||1;
            state.activeThemeId=item.activeThemeId||null;
            state.typographyPreset=item.typographyPreset||'uniform'; state.typographyScale=Number(item.typographyScale)||1;
            state.branchStyle=item.branchStyle||'neon';state.defaultLabelWrapChars=Number(item.defaultLabelWrapChars)||nm64PreferredWrap();state.wrapCustom=nm64WasCustom(item);nm64ApplyWrapPreference(state);
            state.selectedNodeId=state.root.id;state.selectedNodeIds=[state.root.id];
            prepared.push({state, studyCards:item.studyCards || [], learningAttempts:item.learningAttempts || [],learningPlan:item.learningPlan||null});
          }
          // No live state is changed until every sheet and its metadata is ready.
          this.saveActiveTabSnapshot();
          let lastTab;
          for (const {state, studyCards, learningAttempts, learningPlan} of prepared) {
            lastTab=this.addTab(state,state.root.text,false);options.onImportTab?.(lastTab);
            this.studyCards.push(...studyCards.map(c=>({...c,sourceTabId:lastTab.id})));
            this.learningAttempts=NeuroMapLearningCore.cleanAttempts([
              ...this.learningAttempts,...NeuroMapLearningCore.cleanAttempts(learningAttempts)
                .filter(a=>state.findNode(a.nodeId)).map(a=>({...a,tabId:lastTab.id,
                  sourceSignature:this.v5Signature(state.findNode(a.nodeId),state)}))
            ]);
            if(learningPlan){
              this.learningPlans=NeuroMapAdaptiveCore.cleanPlans([...this.learningPlans,
                {...learningPlan,tabId:lastTab.id}]);
            }
          }
          this.activateTab(lastTab.id);
          this.recalculateAndRender();this.fitToScreen();this.renderTabBar();this.scheduleSave();
          return total;
        }
        if(parsed.meta)for(const field of ['images','relationships','studyCards','learningAttempts'])if(parsed.meta[field]!=null&&(!Array.isArray(parsed.meta[field])||parsed.meta[field].some(v=>!v||typeof v!=='object'||Array.isArray(v))))throw Error('Metadati del backup non validi: '+field);
        const isNative=parsed.meta?.schema==='NeuroMapArchitect-SingleTab-v6';
        const count=this.importHierarchy(parsed.root,{...options,preserveIds:isNative});
        if (parsed.meta && (ext === 'json' || ext === 'neuromap' || ext === 'glk' || ext === 'gk')) {
          const ids=new Set(this.state.getAllNodes().map(n=>n.id));
          // Saved JSON uses original ids; importHierarchy has generated new ones.
          // Only image/relationship references can safely be restored via matching index paths.
          const keyOld=[],keyNew=[];
          const flatten=(n,list)=>{list.push(n.id);(n.children||[]).forEach(c=>flatten(c,list));};
          flatten(parsed.root,keyOld);flatten(this.state.root,keyNew);
          const remap=new Map(keyOld.map((id,i)=>[id,keyNew[i]]));
          this.state.images = MindMapStateMachine.cloneImages(parsed.meta.images||[]).map(img=>({
            ...img, attachedNodeId:img.attachedNodeId ? remap.get(img.attachedNodeId)||null : null,
            mode:img.attachedNodeId && remap.has(img.attachedNodeId) ? 'attached':'free'
          }));
          this.state.relationships = MindMapStateMachine.cloneRelationships(parsed.meta.relationships||[])
            .map(r=>({...r,fromId:remap.get(r.fromId),toId:remap.get(r.toId)}))
            .filter(r=>r.fromId&&r.toId);
          this.state.thresholdY=parsed.meta.thresholdY != null && Number.isFinite(Number(parsed.meta.thresholdY)) ? Number(parsed.meta.thresholdY) : 500;
          this.state.balanceBias=Number.isFinite(+parsed.meta.balanceBias)?Math.max(0,Math.min(100,+parsed.meta.balanceBias)):50;
          this.state.compactness=Number.isFinite(+parsed.meta.compactness)?Math.max(55,Math.min(145,+parsed.meta.compactness)):100;
          this.state.branchGapX=nm68ClampGap(parsed.meta.branchGapX);
          this.state.strokeScale=Number(parsed.meta.strokeScale)||1;
          this.state.activeThemeId=parsed.meta.activeThemeId||null;
          this.state.typographyPreset=parsed.meta.typographyPreset||'uniform'; this.state.typographyScale=Number(parsed.meta.typographyScale)||1;
          this.state.branchStyle=parsed.meta.branchStyle||'neon';this.state.defaultLabelWrapChars=Number(parsed.meta.defaultLabelWrapChars)||nm64PreferredWrap();this.state.wrapCustom=nm64WasCustom(parsed.meta);nm64ApplyWrapPreference(this.state);
          if(Array.isArray(parsed.meta.studyCards))this.studyCards.push(...parsed.meta.studyCards.map(c=>{
            const nid=remap.get(c.sourceNodeId)||null;const n=this.state.findNode(nid);
            return n?{...c,id:this.state.generateId('card'),sourceTabId:this.activeTabId,sourceNodeId:nid,sourceSignature:this.v5Signature(n,this.state)}:null;
          }).filter(Boolean)); 
          if(Array.isArray(parsed.meta.learningAttempts)){
            const imported=NeuroMapLearningCore.cleanAttempts(parsed.meta.learningAttempts)
              .map(a=>({...a,nodeId:remap.get(a.nodeId)||null,tabId:this.activeTabId}))
              .filter(a=>a.nodeId&&this.state.findNode(a.nodeId))
              .map(a=>({...a,sourceSignature:this.v5Signature(this.state.findNode(a.nodeId),this.state)}));
            this.learningAttempts=NeuroMapLearningCore.cleanAttempts([...this.learningAttempts,...imported]);
          }
          if(parsed.meta.learningPlan){
            this.learningPlans=NeuroMapAdaptiveCore.cleanPlans([...this.learningPlans,
              {...parsed.meta.learningPlan,tabId:this.activeTabId}]);
          }
          this.recalculateAndRender(); this.fitToScreen();
        }
        return count;
      }
      async importFiles(files, newTab = true, options = {}) {
        this.closeEditor(true);
        let succeeded = 0;
        for (const f of files) {
          try {
            if(!options.quiet)this.showToast('Sto leggendo ' + f.name + '…', 'IMPORT');
            const count = await this.importFile(f,{...options,newTab});
            if(count>0){succeeded++;if(!options.quiet)this.showToast(f.name + ' · ' + count + ' nodi caricati', 'IMPORT OK');}
          } catch (e) {
            if(options.throwOnError)throw e;
            console.error('Import failed',f.name,e);
            this.showToast(f.name + ': ' + (e.message||'file non valido'), 'ERRORE');
          }
          // Native callers yield after origin/clean-state assignment. Yielding
          // here would expose an imported tab before its file identity is set.
          if(!options.nativeOpen)await new Promise(resolve=>setTimeout(resolve,0));
        }
        if (succeeded) this.scheduleSave();
        return succeeded;
      }
      saveProjectFile(as=false) { return this.io.saveProjectFile(as); }
