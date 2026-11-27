      importHierarchy(source, options = {}) {
        if(options.newTab !== false && this.tabs.length >= (globalThis.NeuroMapRecovery?.MAX_TABS||512))
          throw Error('Limite di 512 schede: esporta alcune mappe prima di importarne altre.');
        if (!source || typeof source !== 'object') throw new Error('Struttura della mappa vuota.');
        const title = String(source.text || source.title || 'Mappa importata');
        const state = this.newState(title);
        let count = 0;
        const images = [];
        const usedSourceIds=new Set();
        const walk = (topic, parentId, side, color, index = 0, depth = 0) => {
          if (++count > 3500) throw Error('La mappa contiene oltre 3500 nodi: limite di sicurezza raggiunto.');
          if (depth > 100) throw Error('La struttura contiene troppi livelli di annidamento.');
          // Native projects retain logical IDs; external imports still get fresh IDs.
          const proposed=options.preserveIds && typeof topic.id==='string' && /^[a-zA-Z0-9_-]{3,128}$/.test(topic.id)
            && !usedSourceIds.has(topic.id) ? topic.id : null;
          const id=proposed||state.generateId();usedSourceIds.add(id);
          const children = Array.isArray(topic.children) ? topic.children : [];
          const n = { ...MindMapStateMachine.cloneTree({...topic,children:[]}), id, text:String(topic.text || topic.title || 'Nodo').trim() || 'Nodo',
            parentId, side, sidePinned:['left','right'].includes(topic.sidePinned)?topic.sidePinned:null, collapsed:Boolean(topic.collapsed), customOrder:index,
            srStatus:[0,1,2,3].includes(Number(topic.srStatus)) ? Number(topic.srStatus) : 0,
            sr: topic.sr && typeof topic.sr==='object' ? {
              lastReviewedAt:Number(topic.sr.lastReviewedAt||0), dueAt:Number(topic.sr.dueAt||0),
              intervalDays:Number(topic.sr.intervalDays||0), reviews:Number(topic.sr.reviews||0),
              lapses:Number(topic.sr.lapses||0)
            } : null,
            knowledge: typeof NeuroMapKnowledgeDB!=='undefined' ? NeuroMapKnowledgeDB.normalize(topic.knowledge) : {tags:[],fields:{},dailyKey:''},
            notes:String(topic.notes||''),
            sourceRefs:typeof NeuroMapSourceCore!=='undefined'?NeuroMapSourceCore.normalizeAll(topic.sourceRefs):[],
            taskStatus:['todo','doing','done'].includes(topic.taskStatus)?topic.taskStatus:undefined,
            startDate:/^\d{4}-\d\d-\d\d$/.test(topic.startDate||'')?topic.startDate:undefined,
            dueDate:/^\d{4}-\d\d-\d\d$/.test(topic.dueDate||'')?topic.dueDate:undefined,
            taskDependsOn:Array.isArray(topic.taskDependsOn)?topic.taskDependsOn.slice(0,12):[],
            fontSize:topic.fontSize||null,fontWeight:topic.fontWeight||null,fontItalic:!!topic.fontItalic,
            labelWrapChars:Number(topic.labelWrapChars)||null,illustration:topic.illustration?.svg?{...topic.illustration}:null,
            manualOffset:topic.manualOffset ? {dx:Number(topic.manualOffset.dx)||0,dy:Number(topic.manualOffset.dy)||0}:null,
            layoutMode:topic.layoutMode,linkUrl:topic.linkUrl,layoutDistribution:topic.layoutDistribution?NeuroMapCore.continuationSettings(topic.layoutDistribution):undefined,boundary:topic.boundary||null,isSummary:Boolean(topic.isSummary),
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
        // The old -> new ID mapping must cover internal dependencies and
        // logical summary targets; never refer back to the imported source.
        const ids=new Map(),pairs=[{old:source,created:state.root}];
        for(let i=0;i<pairs.length;i++){
          const {old,created}=pairs[i];if(old?.id)ids.set(old.id,ids.has(old.id)?null:created.id);
          for(let j=0;j<(old.children||[]).length;j++)
            pairs.push({old:old.children[j],created:created.children[j]});
        }
        for(const {created} of pairs){
          created.taskDependsOn=(created.taskDependsOn||[]).map(id=>ids.get(id)).filter(Boolean);
          if(typeof NeuroMapWikiLinks!=='undefined'&&source.id)
            created.notes=NeuroMapWikiLinks.remapInternal(created.notes,source.id,state.root.id,ids);
          if(created.isSummary&&Array.isArray(created.summaryTargetIds))
            created.summaryTargetIds=created.summaryTargetIds.map(id=>ids.get(id)).filter(Boolean);
        }
        state.root.side = 'root'; state.selectedNodeId = state.root.id; state.selectedNodeIds = [state.root.id];
        for (const {nodeId, image} of images) {
          state.images.push({ id:state.generateId('image'), src:image.src,
            width:Math.min(900,Math.max(40,Number(image.width)||135)),
            height:Math.min(900,Math.max(25,Number(image.height)||100)),
            mode:'attached', attachedNodeId:nodeId, zLayer:'front', aspectLocked:true,
            offset:{dx:0,dy:-95}, worldPos:{x:0,y:0} });
        }
        if (options.newTab !== false) {
          this.saveActiveTabSnapshot(); this.addTab(state, title);
        } else {
          this.closeEditor(false);
          const tab = this.tabs.find(t => t.id === this.activeTabId);
          if (tab) { tab.state = state; tab.camera = null; tab.title = title; }
          this.state = state; this.renderer.state = state;
        }
        state.isDirty = true;
        this.recalculateAndRender(); this.fitToScreen(); this.renderTabBar(); this.scheduleSave();
        return count;
      }
      parseTextHierarchy(text, ext) {
        if (ext === 'json' || ext === 'neuromap' || ext === 'glk' || ext === 'gk') {
          const d = JSON.parse(text);
          if (d.schema === 'NeuroMapArchitect-WorkspaceBatch-v6' && Array.isArray(d.tabs)) return { workspace:d.tabs, activeTabId:typeof d.activeTabId==='string'?d.activeTabId:'', batch:true };
          const root = d.root || d;
          if (!root || typeof root !== 'object' || !root.text) throw Error('JSON senza nodo principale valido.');
          return { root, meta:d };
        }
        if (ext === 'opml' || ext === 'xml') {
          const doc = new DOMParser().parseFromString(text, 'application/xml');
          if (doc.querySelector('parsererror')) throw Error('XML/OPML non valido.');
          const outlines = [...doc.querySelectorAll('body > outline')];
          if (!outlines.length) throw Error('Nessuna mappa OPML trovata.');
          const convert = el => {
            const note = el.getAttribute('_note');
            return {
              text:el.getAttribute('text') || el.getAttribute('title') || 'Nodo',
              ...(note ? { notes: note } : {}),
              children:[...el.children].filter(c => c.localName === 'outline').map(convert)
            };
          };
          return {root:outlines.length===1?convert(outlines[0]):{text:'Mappa importata',children:outlines.map(convert)}};
        }
        if (ext === 'md' || ext === 'markdown') {
          const parsedMd = globalThis.NeuroMapCore?.parseMarkdownExport?.(text);
          if (parsedMd) {
            return parsedMd.length > 1
              ? { workspace: parsedMd.map(root => ({ root })) }
              : { root: parsedMd[0] };
          }
          const docs = String(text || '').replace(/\r\n?/g, '\n').split(/^\s*---\s*$/m)
            .map(t => t.trimEnd()).filter(t => t.trim());
          if (docs.length > 1 && globalThis.NeuroMapCore?.parseMarkdownDocuments) {
            const roots = globalThis.NeuroMapCore.parseMarkdownDocuments(text);
            return { workspace: roots.map(root => ({ root })) };
          }
        }
        const rows = text.replace(/\r/g,'').split('\n').filter(x => x.trim() && !/^\s*---\s*$/.test(x));
        if (!rows.length) throw Error('Il file è vuoto.');
        const flat = rows.map(row => {
          const match = row.match(/^([\t ]*)(.*)$/);
          const indent = match[1].replace(/\t/g,'  ').length;
          const content = match[2];
          const heading = content.match(/^(#{1,6})\s+(.+)$/);
          const bullet = content.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.*)$/);
          return {indent, headingLevel:heading?.[1].length || 0, bullet:!!bullet,
            text:(heading ? heading[2] : bullet ? bullet[1] : content).trim()};
        }).filter(r=>r.text);
        let root, stack=[];
        // Markdown headings are roots; bullets indent relative to the first bullet's indent.
        for (const item of flat) {
          const level = item.headingLevel ? Math.max(0,item.headingLevel-1) :
            (item.bullet ? 1 + Math.floor(item.indent/2) : Math.floor(item.indent/2));
          const node={text:item.text,children:[]};
          if (!root) {root=node; stack=[{level,node}]; continue;}
          while(stack.length && stack[stack.length-1].level >= level) stack.pop();
          const parent = stack.length ? stack[stack.length-1].node : root;
          parent.children.push(node);
          stack.push({level,node});
        }
        return { root };
      }
      async importFile(file, options={}) {
        const ext = (file.name.split('.').pop()||'').toLowerCase();
        if (file.size > 100*1024*1024) throw Error('File troppo grande (limite 100 MB).');
        if (ext === 'xmind') {
          const {contentJsonText,contentXmlText,resourceMap,nativeWorkspaceText} = await this.io.parseZipArchiveInMemory(await file.arrayBuffer());
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
          let total=0;
          for(let i=0;i<roots.length;i++){
            const imported=await this.importHierarchyPreview(roots[i],{newTab:i===0?options.newTab!==false:true});
            if(!imported)break;
            total+=imported;
          }
          return total;
        }
        const parsed = this.parseTextHierarchy(await file.text(),ext);
        if (parsed.workspace) {
          const total = NeuroMapCore.validateWorkspaceTabs(parsed.workspace);
          const prepared = [];
          for (const item of parsed.workspace) {
            const state = this.newState(item.root.text || 'Scheda importata');
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
            state.thresholdY=Number.isFinite(Number(item.thresholdY)) && Number(item.thresholdY)>=0 && Number(item.thresholdY)<=100 ? Number(item.thresholdY) : 50;
            state.strokeScale=Number(item.strokeScale)||1;
            nmAndroidRestoreSpacing(state,item);
            state.activeThemeId=item.activeThemeId||null;
            state.typographyPreset=item.typographyPreset||'uniform'; state.typographyScale=Number(item.typographyScale)||1;
            state.branchStyle=item.branchStyle||'neon';state.defaultLabelWrapChars=Number(item.defaultLabelWrapChars)||18;
            state.selectedNodeId=state.root.id;state.selectedNodeIds=[state.root.id];
            prepared.push({state, sourceId:item.id, studyCards:item.studyCards || [],
              learningAttempts:Array.isArray(item.learningAttempts)?item.learningAttempts.slice(0,2500):[],
              learningPlan:item.learningPlan || null});
          }
          // Validate the entire batch before touching live tabs or study data.
          if(this.tabs.length + prepared.length > (globalThis.NeuroMapRecovery?.MAX_TABS||512))
            throw Error('Questa importazione supererebbe 512 schede: dividi il progetto in più gruppi.');
          // No live state is changed until every sheet and its metadata is ready.
          this.saveActiveTabSnapshot();
          let lastTab;const opened=[];
          for (const {state, sourceId, studyCards, learningAttempts, learningPlan} of prepared) {
            lastTab=this.addTab(state,state.root.text,false);
            if(parsed.batch){lastTab.batchFile=true;lastTab._nmSourceTabId=sourceId;}
            opened.push(lastTab);
            this.studyCards.push(...studyCards.map(c=>({...c,sourceTabId:lastTab.id})));
            this.learningAttempts.push(...learningAttempts
              .filter(a=>a&&typeof a==='object'&&!Array.isArray(a)&&state.findNode(a.nodeId))
              .map(a=>({...a,tabId:lastTab.id})));
            if(learningPlan&&typeof learningPlan==='object'&&!Array.isArray(learningPlan)){
              this.learningPlans.push({...learningPlan,tabId:lastTab.id});
            }
          }
          const wanted=opened.find(t=>t._nmSourceTabId&&t._nmSourceTabId===parsed.activeTabId)||lastTab;
          this.activateTab(wanted.id);
          this.recalculateAndRender();this.fitToScreen();this.renderTabBar();this.scheduleSave();
          return total;
        }
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
            ...img,
            studyHotspots:(img.studyHotspots||[]).map(h=>({...h,nodeId:remap.get(h.nodeId)}))
              .filter(h=>h.nodeId),
            attachedNodeId:img.attachedNodeId ? remap.get(img.attachedNodeId)||null : null,
            mode:img.attachedNodeId && remap.has(img.attachedNodeId) ? 'attached':'free'
          }));
          this.state.relationships = MindMapStateMachine.cloneRelationships(parsed.meta.relationships||[])
            .map(r=>({...r,fromId:remap.get(r.fromId),toId:remap.get(r.toId)}))
            .filter(r=>r.fromId&&r.toId);
          this.state.thresholdY=Number.isFinite(Number(parsed.meta.thresholdY)) && Number(parsed.meta.thresholdY)>=0 && Number(parsed.meta.thresholdY)<=100 ? Number(parsed.meta.thresholdY) : 50;
          this.state.strokeScale=Number(parsed.meta.strokeScale)||1;
          nmAndroidRestoreSpacing(this.state,parsed.meta);
          this.state.activeThemeId=parsed.meta.activeThemeId||null;
          this.state.typographyPreset=parsed.meta.typographyPreset||'uniform'; this.state.typographyScale=Number(parsed.meta.typographyScale)||1;
          this.state.branchStyle=parsed.meta.branchStyle||'neon';this.state.defaultLabelWrapChars=Number(parsed.meta.defaultLabelWrapChars)||18;
          if(Array.isArray(parsed.meta.studyCards))this.studyCards.push(...parsed.meta.studyCards.map(c=>{
            const nid=remap.get(c.sourceNodeId)||null;const n=this.state.findNode(nid);
            return n?{...c,id:this.state.generateId('card'),sourceTabId:this.activeTabId,sourceNodeId:nid,sourceSignature:this.v5Signature(n,this.state)}:null;
          }).filter(Boolean));
          if(Array.isArray(parsed.meta.learningAttempts)){
            this.learningAttempts.push(...parsed.meta.learningAttempts.slice(0,2500)
              .filter(a=>a&&typeof a==='object'&&!Array.isArray(a)&&remap.has(a.nodeId))
              .map(a=>({...a,nodeId:remap.get(a.nodeId),tabId:this.activeTabId})));
          }
          if(parsed.meta.learningPlan&&typeof parsed.meta.learningPlan==='object'&&
             !Array.isArray(parsed.meta.learningPlan)){
            this.learningPlans.push({...parsed.meta.learningPlan,tabId:this.activeTabId});
          }
          this.recalculateAndRender(); this.fitToScreen();
          if(this.state.root.viewMode){
            if(globalThis.NeuroMapLinkedViews?.setMode){
              globalThis.NeuroMapLinkedViews.setMode(this,this.state.root.viewMode);
            }else if(typeof NeuroMapLinkedViewsInstall!=='function'){
              this.showToast('Su Android questa struttura è mostrata come mappa mentale. I dati della vista restano conservati.','VISTA DEL PROGETTO');
            }
          }
        }
        return count;
      }
      async importFiles(files, newTab = true) {
        this.closeEditor(true);
        let succeeded = 0;
        for (const f of files) {
          try {
            this.showToast('Sto leggendo ' + f.name + '…', 'IMPORT');
            const count = await this.importFile(f,{newTab});
            succeeded++;
            this.showToast(f.name + ' · ' + count + ' nodi caricati', 'IMPORT OK');
          } catch (e) {
            console.error('Import failed',f.name,e);
            this.showToast(f.name + ': ' + (e.message||'file non valido'), 'ERRORE');
          }
          // Yield to the browser between files rather than blocking the canvas.
          await new Promise(resolve=>setTimeout(resolve,0));
        }
        if (succeeded) this.scheduleSave();
        return succeeded;
      }
      saveProjectFile(as=false) { return this.io.saveProjectFile(as); }
