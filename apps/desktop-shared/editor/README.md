# Editor desktop condiviso (Windows + macOS)

**Sorgenti canonici** della UI Windows e macOS, non un bundle di distribuzione. Il backend Go è in [`../src/`](../src/); gli involucri di piattaforma sono in [Windows](../../windows/) e [macOS](../../macos/).

**Non sai da quale file partire?** Segui [Inizia da qui](../../../docs/START_HERE.md) o l'[indice delle 18 funzioni](../../../docs/FEATURE_MAP.json). Dal root: `node scripts/maintenance/where-to-edit.cjs salvataggio`.

Il manifest [`sources.json`](sources.json) definisce **l'ordine esatto** dei file incorporati nel prodotto da [`scripts/release/prepare.py`](../../../scripts/release/prepare.py). Le classi e le estensioni condividono un ambito JavaScript: non rinominare, estrarre moduli o cambiare l'ordine senza aggiornare staging e test.

| Problema | Prima lettura |
| --- | --- |
| Albero, selezioni, Undo/Redo, formattazione | [`state.js`](state.js), [`app.js`](app.js) |
| Geometria, modalità Oraria/Bilanciata/Fluida/Radiale | [`layout.js`](layout.js), [`layout-geometry.js`](layout-geometry.js), [`layout-navigation.js`](layout-navigation.js), [`layout-ui-controls.js`](layout-ui-controls.js), [core comune](../../../packages/map-core/index.js) |

| Allineamento, rientro, elenchi e spaziatura testo | [`layout-text-controls.js`](layout-text-controls.js) (desktop) |
| Navigazione per livello e riordino rami | [`layout-navigation.js`](layout-navigation.js) (desktop) |
| Riordino schede e ripristino origine file | [`layout-tab-order.js`](layout-tab-order.js) (desktop) |
| Render, zoom, Canvas | [`renderer.js`](renderer.js), [`fast-canvas.js`](fast-canvas.js), [`app.js`](app.js) |
| Metadati delle viste collegate, telecamere e layout associati ai file | [`workspace-view-metadata.js`](workspace-view-metadata.js) (caricato tra Atlas e `app.js`) |
| File, apertura e salvataggio | [`io.js`](io.js), [`saving.js`](saving.js), [`version-history.js`](version-history.js), [`workspace-save-queue.js`](workspace-save-queue.js); backend `../src/` |
| Ricerca Spotlight, teletrasporto e flashcard | [`navigation-search-camera.js`](../../../packages/editor-ui/editor-shared/navigation-search-camera.js), [`navigation-flashcards.js`](../../../packages/editor-ui/editor-shared/navigation-flashcards.js), [`navigation-ai-actions.js`](navigation-ai-actions.js) (azioni AI), [`navigation-study.js`](navigation-study.js) (binding) |
| Icone SVG, ricerca illustrazioni e relativi pannelli | [`media-icon-core.js`](../../../packages/editor-ui/editor-shared/media-icon-core.js) (helper), [`media.js`](media.js) (interfaccia e sincronizzazione stili) |
| Disposizione e gesti avanzati, relazioni e sessioni di studio | [`study-canvas-interactions.js`](study-canvas-interactions.js) (disposizione, trascinamento, relazioni, tipografia), [`study-interactions.js`](study-interactions.js) (flashcard e binding dei comandi); entrambi nello stesso ambito |
| Gesti e strumenti | [`study-interactions.js`](study-interactions.js), [`desktop-controls.js`](desktop-controls.js), [`packages/editor-ui/drag-preview.js`](../../../packages/editor-ui/drag-preview.js) |
| Audit su mappe grandi e importazione/controlli dei menu | [`layout-audit-import.js`](layout-audit-import.js), [`layout-menu-import.js`](layout-menu-import.js) |
| Traduzioni/permessi desktop e Home | [`shell-dictionary.js`](shell-dictionary.js), [`shell-product-locale.js`](shell-product-locale.js), [`shell.js`](shell.js) |
| Caricamento e installazione dei moduli | [`prelude.js`](prelude.js), [`startup.js`](startup.js), [`sources.json`](sources.json) |

Gli algoritmi e le estensioni comuni risiedono in [`packages/editor-ui`](../../../packages/editor-ui) e [`packages/map-core`](../../../packages/map-core). **Android non legge questa directory** come propria implementazione dell'editor: per i problemi multipiattaforma confrontare [l'editor Android](../../android/editor/README.md).

Tre sorgenti sono ora canonici in `packages/editor-ui/editor-shared/`: `media-icon-core.js`, `navigation-flashcards.js` e `navigation-search-camera.js`. Entrambi i manifest li caricano con il prefisso `shared/`, nella posizione originale. Il test di composizione protegge ordine e risoluzione; il comparatore verifica l'identità del bundle prima/dopo.

Test locali da root: `npm test`, `npm run test:build` e, con i prerequisiti del browser, `npx playwright test`. Per il percorso completo e i limiti delle prove vedere [`docs/CODE_NAVIGATION.md`](../../../docs/CODE_NAVIGATION.md) e [`docs/DEVELOPMENT.md`](../../../docs/DEVELOPMENT.md). Non avviare GitHub Actions.

I refactoring puramente organizzativi del 31 ottobre sono stati eseguiti mantenendo inalterato l'ordine dei caratteri del bundle JS composto. Prima di ulteriori spostamenti usare `npm run test:structure` e la [roadmap con i gate](../../../docs/maintenance/2026-10-31-modularization-roadmap.md); il comando rapido **non sostituisce** i test Node completi, Python staging, browser o build native.

**Gestione delle schede:** [`app-tabs.js`](app-tabs.js) contiene i metodi della
classe `NeuroMapApp` per creazione, attivazione, duplicazione e chiusura. È un
frammento del corpo della classe, inserito da `prepare.py` nel marcatore unico
`@neuromap-app-tabs` di `app.js`: non è uno script autonomo e non va aggiunto a
`sources.json` o caricato con un nuovo tag script. Le implementazioni di
piattaforma restano distinte. Il comparatore e il test sintattico controllano
la classe completa dopo l'inserimento.
