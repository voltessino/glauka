# Editor Android — sorgenti JavaScript della WebView

Questa cartella contiene lo **stato e l'interfaccia JavaScript Android**. Non va confusa con l'app nativa [`../native/`](../native/) (Java, WebView, storage, Gradle e gesti touch) né con le librerie condivise [`packages/`](../../../packages/).

**Ti sei perso fra questi file?** Apri [Inizia da qui](../../../docs/START_HERE.md) oppure cerca un problema nell'[indice delle funzioni](../../../docs/FEATURE_MAP.json). Il comando dal root è: `node scripts/maintenance/where-to-edit.cjs fluida`.

Il manifest [`sources.json`](sources.json) decide l'ordine di composizione durante [`prepare.py`](../../../scripts/release/prepare.py). Il codice non è un insieme di moduli ES autonomi; spostare un file implica aggiornare manifest, riferimenti di staging, test e risorse.

| Problema | Prima lettura |
| --- | --- |
| Nodi, Undo/Redo, selezione, cancellazioni | [`state.js`](state.js), [`app.js`](app.js) |
| Oraria/Bilanciata/Fluida/Radiale, limiti e centratura | [`layout.js`](layout.js), [`app.js`](app.js), [core comune](../../../packages/map-core/index.js) |
| Zoom, gesture visive e render | [`renderer.js`](renderer.js), [`app.js`](app.js), [gesti nativi](../native/app/src/main/assets/assets/mobile-gestures.js) |
| Import/export e salvataggi | [`io.js`](io.js), [`app.js`](app.js), [recupero Java](../native/app/src/main/java/it/neuromap/architect/preview/WorkspaceRecoveryStore.java) |
| Ricerca Spotlight, teletrasporto e flashcard | [`navigation-search-camera.js`](../../../packages/editor-ui/editor-shared/navigation-search-camera.js), [`navigation-flashcards.js`](../../../packages/editor-ui/editor-shared/navigation-flashcards.js), [`navigation-ai-actions.js`](navigation-ai-actions.js) (azioni AI), [`navigation-study.js`](navigation-study.js) (binding) |
| Icone SVG, ricerca illustrazioni e relativi pannelli | [`media-icon-core.js`](../../../packages/editor-ui/editor-shared/media-icon-core.js) (helper), [`media.js`](media.js) (interfaccia e sincronizzazione stili) |
| Dizionario, lingua, licenze e Home | [`shell-dictionary.js`](shell-dictionary.js), [`shell-product-locale.js`](shell-product-locale.js), [`shell.js`](shell.js), nello stesso ambito di caricamento |
| Disposizione, relazioni e comandi di studio | [`study-canvas-interactions.js`](study-canvas-interactions.js) (disposizione/trascinamento), [`study-interactions.js`](study-interactions.js) (flashcard/comandi), con ordine invariato |
| Comandi, pannelli, strumenti | [`desktop-controls.js`](desktop-controls.js), [`study-interactions.js`](study-interactions.js), [`shell.js`](shell.js) |

Android Free non include automaticamente le integrazioni riservate all'edizione desktop Developer. Confrontare sempre la [matrice di parità](../../../docs/PLATFORM_PARITY.md) prima di copiare codice Windows/macOS.

Tre sorgenti sono ora canonici in `packages/editor-ui/editor-shared/`: `media-icon-core.js`, `navigation-flashcards.js` e `navigation-search-camera.js`. Entrambi i manifest li caricano con il prefisso `shared/`, nella posizione originale. Il test di composizione protegge ordine e risoluzione; il comparatore verifica l'identità del bundle prima/dopo.

Test da root: `npm test`, `npm run test:build`, `npm run test:android:stress`; le prove browser richiedono Playwright e **non** sostituiscono la verifica dell'APK su dispositivo. [Mappa del codice](../../../docs/CODE_NAVIGATION.md) · [Guida sviluppo](../../../docs/DEVELOPMENT.md). Non avviare GitHub Actions.

**Compatibilità OPML:** l'esportazione di mappe profonde utilizza lo stesso algoritmo iterativo del desktop; verificare con il [test di parità OPML](../../../packages/editor-ui/tests/opml-platform-deep-parity-20261031.test.js). Non sostituisce un collaudo APK.

**Gestione delle schede:** [`app-tabs.js`](app-tabs.js) contiene i metodi della
classe `NeuroMapApp` per creazione, attivazione, duplicazione e chiusura. È un
frammento del corpo della classe, inserito da `prepare.py` nel marcatore unico
`@neuromap-app-tabs` di `app.js`: non è uno script autonomo e non va aggiunto a
`sources.json` o caricato con un nuovo tag script. Le implementazioni di
piattaforma restano distinte. Il comparatore e il test sintattico controllano
la classe completa dopo l'inserimento.
