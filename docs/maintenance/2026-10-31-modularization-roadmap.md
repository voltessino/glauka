# Glauka — roadmap di modularizzazione e manutenzione

**Data di riferimento:** 31 ottobre 2026. **Sorgente di verità:** `main` + [`versions.json`](../../versions.json). Questa roadmap distingue *modifiche concluse* da *lavori pianificati*. Non costituisce prova che la suite completa o gli eseguibili siano già stati testati.

**Gate import/export:** è stata riprodotta e corretta una regressione di profondità OPML su Android. Il [test di parità OPML](../../packages/editor-ui/tests/opml-platform-deep-parity-20261031.test.js) protegge l'esportazione di mappe profonde prima di una futura divisione del controller `io.js`. La classe `MindMapIOManager` non è stata spezzata in moduli parziali non validi.

## Stato attuale dopo le estrazioni conservative

Il desktop carica i JavaScript in un solo ambito tramite [`sources.json`](../../apps/desktop-shared/editor/sources.json) e [`prepare.py`](../../scripts/release/prepare.py). Le estrazioni già integrate **non cambiano i caratteri né l'ordine del codice concatenato**:

| Componente iniziale | Sorgenti ora distinti | Perché |
| --- | --- | --- |
| `apps/desktop-shared/editor/app.js` | [`workspace-view-metadata.js`](../../apps/desktop-shared/editor/workspace-view-metadata.js) + [`app.js`](../../apps/desktop-shared/editor/app.js) | Metadati delle visualizzazioni separati dalla modifica dei nodi |
| `layout-navigation.js` (passo successivo) | [formattazione](../../apps/desktop-shared/editor/layout-text-controls.js) + [navigazione/ordine rami](../../apps/desktop-shared/editor/layout-navigation.js) + [schede](../../apps/desktop-shared/editor/layout-tab-order.js) | Tre responsabilità desktop con output JS concatenato identico |
| `layout-navigation.js` | [navigazione](../../apps/desktop-shared/editor/layout-navigation.js), [controlli](../../apps/desktop-shared/editor/layout-ui-controls.js), [audit/import](../../apps/desktop-shared/editor/layout-audit-import.js), [geometria](../../apps/desktop-shared/editor/layout-geometry.js), [menu/import](../../apps/desktop-shared/editor/layout-menu-import.js) | Ricerca, test e manutenzione delle responsabilità indipendenti |
| `navigation-study.js` (desktop e Android) | [`navigation-search-camera.js`](../../packages/editor-ui/editor-shared/navigation-search-camera.js), [`navigation-flashcards.js`](../../packages/editor-ui/editor-shared/navigation-flashcards.js), [`navigation-ai-actions.js`](../../apps/desktop-shared/editor/navigation-ai-actions.js), [`navigation-study.js`](../../apps/desktop-shared/editor/navigation-study.js), stessi confini in Android | Ricerca/camera, ripasso e collegamenti AI separati senza modificare il codice JS concatenato |
| `study-interactions.js` desktop e Android | [`study-canvas-interactions.js`](../../apps/desktop-shared/editor/study-canvas-interactions.js) + [`study-interactions.js`](../../apps/desktop-shared/editor/study-interactions.js), stessi segmenti in Android | Separati canvas/relazioni/trascinamento e quiz/flashcard/binding senza modificare i caratteri concatenati |
| `media.js` desktop e Android | [`media-icon-core.js`](../../packages/editor-ui/editor-shared/media-icon-core.js) + [`media.js`](../../apps/desktop-shared/editor/media.js), stessi segmenti in Android | Dati/helper SVG separati dai controller UI, senza mutare la composizione JS |
| `apps/android/editor/shell.js` | [`shell-dictionary.js`](../../apps/android/editor/shell-dictionary.js) + [`shell-product-locale.js`](../../apps/android/editor/shell-product-locale.js) + [`shell.js`](../../apps/android/editor/shell.js) | Dizionario, licenza/traduzioni e Home Android separati come sul desktop, stesso JS eseguito |
| `apps/desktop-shared/editor/saving.js` | [`saving.js`](../../apps/desktop-shared/editor/saving.js) + [`version-history.js`](../../apps/desktop-shared/editor/version-history.js) | Salvataggio atomico e cronologia delle versioni nativa in moduli separati, senza cambiare il codice concatenato |
| `shell.js` | [dizionario](../../apps/desktop-shared/editor/shell-dictionary.js), [prodotto e localizzazione](../../apps/desktop-shared/editor/shell-product-locale.js), [Home/interfaccia](../../apps/desktop-shared/editor/shell.js) | Evitare di modificare una UI grande per correggere una traduzione |

Le verifiche JS mirate sono state eseguite **in harness isolati** contro i sorgenti GitHub. Le regressioni sono anche scritte nei test Node e negli unit test Python dello staging. **Non si dichiara eseguita la suite completa Node/Python o un'app installata.**

La [verifica formale del 31 ottobre](../qa/2026-10-31-code-reorganization-verify.md) confronta manifest, contenuti e staging con la versione precedente e registra i collaudi eseguiti e mancanti.

## Ordine consigliato per le prossime fasi

| Priorità | Passo | Rischio | Condizione per procedere |
| --- | --- | --- | --- |
| **P0 — obbligatorio prima della release** | Gate locale completo su sorgenti, build e UI delle tre piattaforme | Basso sul codice, alto sul valore delle prove | `npm test`, `npm run test:build`, Playwright Chromium, Go, Android Gradle e controlli macOS sull'host adatto; test manuali su dati reali e backup |
| **P1** | Separare in `app.js` gestione schede e clipboard dall'editing dei nodi | Medio/alto | **Avanzato (2026-11-06):** `app.js` resta costruttore/`newState` + dodici frammenti lessicali (tabs, camera/status, hit-testing, clipboard, image-drag, inline-edit, node-mutations, import, persist, summary-image, context-find, bind-ui) su desktop+Android, bundle IDENTICAL. Tre frammenti identici (`app-hit-testing`, `app-image-drag`, `app-node-mutations`) ora vivono in `packages/editor-ui/editor-shared/`. Ulteriori spezzature solo se emergono responsabilità chiaramente separate |
| **P2** | Riorganizzare le due implementazioni di comandi/stato desktop e Android | Alto | Identificare contratti condivisi, mantenere compatibilità Free/Developer, verificare mappa profonda, selezioni, immagini, relazioni, Undo, ripristino |
| **P3** | Modularizzare `packages/editor-ui/linked-views.js`, ora un grande contenitore IIFE | Alto | **Avanzato (2026-11-06):** `install()` spezzato in camera-workspace/ensure/toolbars/export/runtime oltre decorations/styles/project; `renderDual` in `linked-view-runtime-dual.js` (bundle UI IDENTICAL). Playwright completo sulle sette viste resta consigliato prima di refactor comportamentali |
| **P4** | Separare i dettagli Home e dialoghi dal restante `shell.js` desktop e verificare localizzazione Android | Medio | **Parziale (2026-11-06):** Home desktop in `shell-home.js` (frammento lessicale, bundle IDENTICAL). Android Home resta nel `shell.js` ridotto; verificare ancora accessibilità IT/EN e layout responsive su host UI |
| **P5** | Ridurre accoppiamenti di build e creare mappa delle origini dei JS incorporati | Medio | Tracciabilità dei file concatenati senza modificare CSP, bundle offline, URL WebView o manifest nativi |
| **P6** | Rivedere tutti i 312 branch e le 19 PR aperte con rapporto aggiornato | Variabile | Dry-run JSON, analisi commit esclusivi, eccezioni e approvazione nominativa **prima** di rimuovere alcunché |

**Non fare le fasi P1–P4 tutte insieme.** Ogni estrazione successiva deve avere un rollback semplice via Git, un test di comportamento precedente e un test della nuova responsabilità. Un errore nei salvataggi, negli import o nel rendering blocca ulteriori cambiamenti.

Tre sorgenti sono attualmente *identici* fra editor desktop e Android (`media-icon-core.js`, `navigation-flashcards.js`, `navigation-search-camera.js`). La parità è controllata da [`editor-shared-slices-parity.test.js`](../../packages/editor-ui/tests/editor-shared-slices-parity.test.js), incluso nel gate `npm run test:structure`. I due manifest ora usano `shared/<nome>.js` per le copie canoniche in `packages/editor-ui/editor-shared/`; non esistono più copie locali che possano divergere. La concatenazione di release resta invariata.

## Gate obbligatori per un refactoring

1. **Localizzazione:** partire dalla [mappa del codice](../CODE_NAVIGATION.md), controllare ogni riferimento statico e i test che leggono direttamente il vecchio file.
2. **Preservazione della semantica:** per estrazioni puramente testuali confrontare `vecchio_sorgente === nuovo_modulo_1 + ... + nuovo_modulo_N` **byte per byte**. Se si cambia la semantica, trattare come refactoring comportamentale e aumentare la copertura.
3. **Staging:** correggere [`sources.json` desktop](../../apps/desktop-shared/editor/sources.json), [`sources.json` Android](../../apps/android/editor/sources.json) solo dove necessario e i riferimenti in `prepare.py`. Verificare il caricamento prima di `startup.js`.
4. **Regressione:** `npm run test:structure` come controllo rapido (include la compilazione sintattica dei due editor completi), poi `npm test`, `npm run test:build` e browser/Go/Gradle applicabili. Non presentare uno snippet JavaScript come collaudo dell'interfaccia nativa.
5. **Dati durevoli:** testare schede multiple, Ctrl+S, Salva con nome, recovery da crash, XMind/Markdown/OPML, immagini e relazioni, Undo/Redo, coerenza Cloud/offline; nessuna modifica silenziosa del formato.
6. **Sicurezza:** niente segreti nel repo, nessun bypass Free/Pro, niente GitHub Actions; gli artefatti di release devono identificare un commit e i controlli effettivi.
7. **Manutenzione:** aggiornare gli indici e la guida nella cartella del componente. Evitare di creare 20 file per 20 funzioni senza un confine tecnico chiaro.

### Protezione aggiunta per le prossime estrazioni

Lo strumento [`compare_editor_bundles.py`](../../scripts/maintenance/compare_editor_bundles.py) confronta `editor_sources()` su due commit (desktop e Android): segnala SHA-256, posizione della prima differenza e file aggiunti/rimossi. Non modifica sorgenti o staging. Utilizzo: `python scripts/maintenance/compare_editor_bundles.py --base <commit-prima> --head HEAD`.

**Usarlo solo per refactoring dichiarati invarianti:** se il codice deve cambiare funzionalmente, un risultato `DIFFERENT` è previsto e va verificato con test comportamentali. Il comparatore non prova equivalenza di `bundles()`, CSS, asset, build Gradle/Go, né runtime. I sei test unitari di contratto sono in [`test_compare_editor_bundles.py`](../../scripts/maintenance/test_compare_editor_bundles.py) e vengono scoperti dal comando dei test manutenzione.

## Cosa NON conviene fare ora

- **Tre repository separati:** introdurrebbero duplicazioni e disallineamenti dei componenti comuni.
- **Spostare in massa 178 rapporti QA e gli asset storici:** rompe collegamenti e prove senza ridurre la complessità del codice.
- **Trasformare subito tutti gli script in moduli ES:** la composizione offline, l'ambito condiviso e l'ordine delle estensioni rendono la migrazione non banale.
- **Smontare `app.js` o l'IIFE delle viste senza browser e build locali:** il rischio è superiore al vantaggio organizzativo vicino alla prima release.
- **Eliminare branch già raggiunti da `main` senza revisione:** possono avere PR o archivi ancora necessari. Usare il [triage dei branch](2026-10-31-branch-triage.md) e il [dry-run](../../scripts/maintenance/prune_merged_branches.py).

## Come proseguire

La prossima decisione non è dove mettere altri file ma **quali invarianti proteggere** quando i file saranno separati. Prima eseguire il gate P0, poi P1 (schede e clipboard) con un unico gruppo di test di round-trip e un solo piccolo refactoring per volta. La divisione di `linked-views.js` deve attendere una copertura end-to-end sulle sette viste.

Rapporti: [inventario e sicurezza dei branch](2026-10-31-branch-triage.md) · [piano generale](../REPOSITORY_MAINTENANCE_PLAN.md) · [guida locale](../DEVELOPMENT.md).

### Aggiornamento conservativo del 3 novembre 2026

La prima parte di P1 è stata separata testualmente: `app-tabs.js` per ogni
piattaforma è inserito nel corpo di `NeuroMapApp`, senza nuove estensioni di
`bindUI()`. Clipboard, comandi e recovery rimangono specifici delle piattaforme.
L'export SVG delle viste e i valori delle impostazioni hanno un frammento
lessicale dedicato, senza dividere il ciclo di vita delle viste. Usare
`compare_editor_bundles.py --include-ui-fragments` per confrontare anche queste
IIFE. Non equivale alla modularizzazione completa di P1–P3.

### Aggiornamento conservativo del 6 novembre 2026 (sera)

Oltre ai frammenti `app.js` e linked-views, i file UI più lunghi sono spezzati lessicalmente (AI Studio, export hub, navigation-experience, creative-tools/settings/markers, localization-messages, rich-caption, continuation-layout, workspace-tools/layout) senza cambiare i byte concatenati. Tre pezzi `app-*` identici vivono in `packages/editor-ui/editor-shared/`. I test Node di `packages/editor-ui` usano helper `compose-*` allineati a `prepare.py`. Playwright e build native restano da eseguire sul gate P0.
