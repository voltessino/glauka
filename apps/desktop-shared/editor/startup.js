    NeuroMapGraphics.install(NeuroMapApp,OrganicCanvasRenderer,OrganicLayoutEngine);
    NeuroMapDrag.install(NeuroMapApp);
    globalThis.NeuroMapCanvasPremium?.install(NeuroMapApp, OrganicCanvasRenderer);
    globalThis.GlaukaNodeLinks?.install(NeuroMapApp);
    globalThis.NeuroMapAreaSelection?.install(NeuroMapApp);
    globalThis.NeuroMapCameraDynamics?.install(NeuroMapApp, {minZoom: 0.001, maxZoom: 3.5});
    NeuroMapDesktopWorkflow.install(NeuroMapApp,MindMapStateMachine,{NM615,NM613,NM614,NM611,Layout:OrganicLayoutEngine});
    NeuroMapContinuation.install(NeuroMapApp,OrganicLayoutEngine,OrganicCanvasRenderer);
    GlaukaStudyToday.install(NeuroMapApp);
    NeuroMapLifecycle.install(NeuroMapApp, MindMapIOManager);
    NeuroMapAI.install({App:NeuroMapApp,Client:UniversalAIClient,product:nmProduct,locale:nmLocale,renderExplanation:nm67RenderMarkdown});
    NeuroMapMenuUX.install();
    NeuroMapMedia.install(NeuroMapApp,MindMapStateMachine,OrganicCanvasRenderer);
    NeuroMapCreativeInstall(NeuroMapApp,MindMapStateMachine,OrganicLayoutEngine,OrganicCanvasRenderer);
    NeuroMapLinkedViewsInstall(NeuroMapApp,MindMapStateMachine);
    NeuroMapNavigationInstall(NeuroMapApp);
    NeuroMapPresentationInstall(NeuroMapApp);
    NeuroMapComparisonInstall(NeuroMapApp);
    NeuroMapOrbitInstall(NeuroMapApp);
    NeuroMapUISkinInstall(NeuroMapApp);
    NeuroMapFirstStepsInstall(NeuroMapApp);
    NeuroMapMapStylesInstall(NeuroMapApp);
    NeuroMapKnowledgeUI.install(NeuroMapApp);
    NeuroMapAdaptiveUI.install(NeuroMapApp,OrganicCanvasRenderer);
    NeuroMapLearningUI.install(NeuroMapApp,OrganicCanvasRenderer);
    NeuroMapFastCanvas.install(NeuroMapApp,OrganicCanvasRenderer);
    NeuroMapSpatialCanvas.install(NeuroMapApp,OrganicCanvasRenderer);
    NeuroMapFastOverlayCanvas.install(OrganicCanvasRenderer);
    NeuroMapContextRefresh.install(NeuroMapApp);
    NeuroMapTopbarCuration.install(NeuroMapApp);
    globalThis.NeuroMapSettingsCenter?.install(NeuroMapApp);
    NeuroMapWorkspaceTools.install(NeuroMapApp);
    NeuroMapWorkspaceLayout.install(NeuroMapApp);
    GlaukaTextTools.install(NeuroMapApp);
    NeuroMapRefinementsInstall.install(NeuroMapApp,OrganicCanvasRenderer,OrganicLayoutEngine);
    window.addEventListener('DOMContentLoaded', async () => {
      const reveal=()=>{
        window.GlaukaStartup.ready();
      };
      const failure=err=>{
        console.error('Glauka startup error',err);
        document.getElementById('glauka-startup-status').textContent=window.GlaukaI18n?.translate('Non siamo riusciti ad aprire Glauka. Riprova.')||'Non siamo riusciti ad aprire Glauka. Riprova.';
        const retry=document.getElementById('glauka-startup-retry');retry.hidden=false;retry.onclick=()=>location.reload();
      };
      try {
        await window.GlaukaI18n?.ready;
        const app=window.neuroMapApp=new NeuroMapApp();
        // Finish native recovery before showing Home or the recovered workspace.
        if(app._desktopRecoveryReady)await app._desktopRecoveryReady;
        if(!app._nmRecoveryBlocked)window.NeuroMapHome?.start?.();
        else app._nmHomePlaceholder=false;
        requestAnimationFrame(()=>requestAnimationFrame(()=>{reveal();if(app._nmRecoveryBlocked)app._nmSaveStatus?.click();}));
      } catch(err){failure(err);}
    });
