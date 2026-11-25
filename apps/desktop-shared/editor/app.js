    // Controller: local-first, requestAnimationFrame rendering, real tabs and inline editing.
    class NeuroMapApp {
      constructor() {
        this.canvas = document.getElementById('mindmap-canvas');
        this.canvas.tabIndex = 0;
        this.state = new MindMapStateMachine(text=>globalThis.GlaukaI18n?.translate(text)||text);
        this.layout = new OrganicLayoutEngine();
        this.renderer = new OrganicCanvasRenderer(this.canvas, this.layout, this.state);
        this.io = new MindMapIOManager(this);
        this.tabs = []; this.activeTabId = null; this.studyCards = []; this.learningAttempts = []; this.learningPlans = [];
        this.importMode = 'new'; this.editorNodeId = null;
        this.drag = null; this.relationshipSourceId = null;
        this.selectionAnchorId = null; this.internalClipboard = null; this._clipboardPlain = null;
        this.renderQueued = false; this.toastTimer = null; this.saveTimer = null;
        this._nmRecoveryRevision = 0; this._nmLastPersistedRevision = 0;
        this.state.initStarterTree();
        this.addTab(this.state, this.state.root.text, true);
        const recoveryBridge=window.neuromapDesktop || window.NeuroMapRecovery?.bridge;
        const restored = recoveryBridge ? false : this.loadAutosave();
        this._nmInitialWorkspaceRestored=Boolean(restored);
        // The Home may replace ONLY this explicit first-run placeholder.
        this._nmHomePlaceholder=!restored;
        this.bindUI();
        if (recoveryBridge) {
          // Native autosave is stored in AppData, not in Chromium's small localStorage quota.
          this._desktopRecoveryPending=true;
          this._desktopRecoveryReady=recoveryBridge.readWorkspace().then(json => {
            if (this.state.isDirty || this._desktopUserEdited) return;
            const recovered=json ? this.loadAutosave(json) : this.loadAutosave();
            if ((json||this._nmRecoveryBlocked)&&!recovered)throw Error('Copia di recupero non valida.');
            if (recovered) {
              this._nmRecoveryBlocked=false;
              this._nmInitialWorkspaceRestored=true;
              this._nmHomePlaceholder=false;
              this._nmLastPersistedRevision=this._nmRecoveryRevision||0;
              this.recalculateAndRender();
              if(!this.tabs.find(t=>t.id===this.activeTabId)?.camera)this.fitToScreen();
              this.renderTabBar();
              this.showToast(globalThis.NeuroMapRecovery?.lastReadUsedPrevious?'Ripristinata la copia precedente: controlla le ultime modifiche.':'Progetti recuperati da questo dispositivo.', 'RECUPERO');
              globalThis.NeuroMapSaveStatus?.report(this,true);
            }
          }).catch(error => {this._nmRecoveryBlocked=true;console.warn('Recupero non riuscito:',error);globalThis.NeuroMapSaveStatus?.report(this,false);}).finally(() => {
            this._desktopRecoveryPending=false;
            // Import a file opened by Windows only AFTER the workspace was restored.
            window.neuromapDesktop.onExternalFile(async payload => {
              try {
                const outcome={};
                const ok=this.v6ImportNative
                  ? await this.v6ImportNative(payload,true,{quiet:true,deferDuplicateActivation:true,outcome})
                  : (await this.importFiles([new File([payload.bytes],payload.filename)],true))>0;
                if(ok===false&&outcome.code!=='cancelled')throw Error('La mappa non è stata importata');
                return outcome.status?outcome:true;
              } catch (error) {
                this.showToast('Apertura progetto non riuscita: ' + error.message, 'ERRORE');
                throw error; // No success ACK until the import really succeeds.
              }
            });
          });
        }
        this.recalculateAndRender();
        if (!restored||!this.tabs.find(t=>t.id===this.activeTabId)?.camera) this.fitToScreen();
        this.renderTabBar();
        const redrawForDisplayChange = () => {
          // WebView2 can change devicePixelRatio when a window moves between
          // 100% / 125% / 150% / 200% monitors without changing CSS size.
          this.renderer.resize();
          this.requestRender();
          this.positionEditor();
        };
        window.addEventListener('resize', redrawForDisplayChange);
        // A resolution media-query fires on monitor-DPI changes even when
        // no window resize event is delivered. Re-arm after each transition.
        let dprQuery = null;
        const onDprChange = () => {
          redrawForDisplayChange();
          watchDpr();
        };
        const watchDpr = () => {
          if (dprQuery?.removeEventListener) {
            dprQuery.removeEventListener('change', onDprChange);
          }
          const dpr = Number(window.devicePixelRatio);
          const value = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
          dprQuery = window.matchMedia?.(`(resolution: ${value}dppx)`) || null;
          dprQuery?.addEventListener?.('change', onDprChange, {once:true});
        };
        watchDpr();
        // Closing and background recovery are coordinated by NeuroMapLifecycle.
      }
      newState(title = (globalThis.GlaukaI18n?.translate('Nuova Mappa')||'Nuova Mappa'), starter = false) {
        const state = new MindMapStateMachine(text=>globalThis.GlaukaI18n?.translate(text)||text);
        state.initStarterTree(title);
        if (!starter) state.root.children = [];
        state.undoStack = []; state.redoStack = []; state.isDirty = false;
        return state;
      }
/* @neuromap-app-tabs */
/* @neuromap-app-camera-status */
/* @neuromap-app-hit-testing */
/* @neuromap-app-selection-clipboard */
/* @neuromap-app-image-drag */
/* @neuromap-app-inline-edit */
/* @neuromap-app-node-mutations */
/* @neuromap-app-import */
/* @neuromap-app-persist */
/* @neuromap-app-summary-image */
/* @neuromap-app-context-find */
/* @neuromap-app-bind-ui */
    }
