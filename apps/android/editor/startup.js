    NeuroMapGraphics.install(NeuroMapApp,OrganicCanvasRenderer,OrganicLayoutEngine);
    NeuroMapDrag.install(NeuroMapApp);
    globalThis.NeuroMapCanvasPremium?.install(NeuroMapApp, OrganicCanvasRenderer);
    globalThis.NeuroMapAreaSelection?.install(NeuroMapApp);
    globalThis.NeuroMapCameraDynamics?.install(NeuroMapApp, {minZoom: 0.12, maxZoom: 3.5});
    NeuroMapContinuation.install(NeuroMapApp,OrganicLayoutEngine,OrganicCanvasRenderer);
    NeuroMapCreativeInstall(NeuroMapApp,MindMapStateMachine,OrganicLayoutEngine,OrganicCanvasRenderer);
    NeuroMapLinkedViewsInstall(NeuroMapApp,MindMapStateMachine);
    NeuroMapFastCanvas.install(NeuroMapApp,OrganicCanvasRenderer);
    GlaukaTextTools.install(NeuroMapApp);
    GlaukaStudyToday.install(NeuroMapApp);
    NeuroMapLifecycle.install(NeuroMapApp, MindMapIOManager);
    globalThis.NeuroMapSettingsCenter?.install(NeuroMapApp);
    NeuroMapAI.install({App:NeuroMapApp,Client:UniversalAIClient,product:nmProduct,locale:nmLocale,renderExplanation:NeuroMapAI.renderExplanation});
    NeuroMapRefinementsInstall.install(NeuroMapApp,OrganicCanvasRenderer,OrganicLayoutEngine);
    let glaukaResolveApp;
    window.GlaukaAppReady=new Promise(resolve=>{glaukaResolveApp=resolve;});
    window.addEventListener('DOMContentLoaded', async () => {
      try {await window.GlaukaI18n?.ready;window.neuroMapApp=new NeuroMapApp();if(window.neuroMapApp._desktopRecoveryReady)await window.neuroMapApp._desktopRecoveryReady;glaukaResolveApp(window.neuroMapApp);}
      catch(err){glaukaResolveApp(null);console.error('Glauka startup error',err);const toast=document.getElementById('toast-notification');
        if(toast){toast.classList.remove('hidden');document.getElementById('toast-text').textContent='Impossibile avviare Glauka: '+err.message;}}
      finally {await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));document.documentElement.setAttribute('data-glauka-ready','');document.getElementById('glauka-mobile-loading')?.remove();if(window.neuroMapApp?._nmRecoveryBlocked)window.neuroMapApp._nmSaveStatus?.click();}
    });
