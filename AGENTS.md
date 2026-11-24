# Glauka — istruzioni per agenti di sviluppo e Codex

Questo documento riguarda il **repository privato Glauka** (`voltessino/neuromap-android`). Il nome storico dell'URL GitHub non identifica una seconda app. È un **monorepo** con Windows/macOS Developer, Android Free e componenti riutilizzabili. Leggere sempre [la mappa operativa del codice](docs/CODE_NAVIGATION.md) prima di scegliere i file da modificare, e [la guida di sviluppo](docs/DEVELOPMENT.md) prima di proporre una build.

**Per trovare il file corretto:** [guida semplice](docs/START_HERE.md), [mappa verificabile](docs/FEATURE_MAP.json), poi la mappa tecnica. Non spostare codice per sola estetica.

**Coordinamento dei lavori:** prima di intervenire su una roadmap o fare un resoconto di avanzamento consultare la [ROADMAP MASTER](docs/roadmap/GLAUKA_MASTER_ROADMAP.md) e la roadmap specifica; registrare solo lavori effettivamente verificati, distinguendo implementazione, test e release.

## Prima di una modifica

1. Verificare il branch e l'ultimo commit di `main`; non ricostruire lo stato attuale da vecchi report, rami, ZIP o artefatti di release. Le versioni ufficiali sono in [`versions.json`](versions.json).
2. Individuare la funzione nella [mappa per area](docs/CODE_NAVIGATION.md) e leggere anche il percorso speculare Windows/macOS e Android quando la funzione è condivisa.
3. Consultare i manifest **`apps/desktop-shared/editor/sources.json`** e **`apps/android/editor/sources.json`** per conoscere l'ordine di caricamento; `scripts/release/prepare.py` compone questi sorgenti. Non assumere che i file JS siano moduli ES indipendenti.
4. Scrivere la correzione più piccola che preserva mappe già salvate, ordine dei rami, ID, Undo/Redo, immagini, relazioni, licenze e dati offline. Non rinominare/spostare file o cambiare formati senza un piano di migrazione e test.
5. Controllare i riferimenti collaterali: sorgenti dell'editor, binding nativi, test, documentazione e script di staging.
6. Per estrazioni testuali confrontare il vecchio e il nuovo codice concatenato **byte per byte**, mantenere l'ordine di `sources.json` e aggiornare anche i test che estraggono funzioni dal percorso originario. Se il sorgente cambia comportamento, il confronto testuale da solo non è sufficiente: servono test browser e nativi applicabili. Seguire la [roadmap di modularizzazione](docs/maintenance/2026-10-31-modularization-roadmap.md).

## Dove si trova il codice

- **Algoritmi condivisi**: `packages/map-core/index.js`; **componenti UI**: `packages/editor-ui/`.
- **Desktop Windows/macOS**: `apps/desktop-shared/editor/` (JS) e `apps/desktop-shared/src/` (Go); Windows aggiunge `apps/windows/`, macOS `apps/macos/`.
- **Android**: `apps/android/editor/` (JavaScript) e `apps/android/native/` (Java/WebView/gesti).
- **Test**: `packages/*/tests/`, `apps/android/tests/`, `apps/desktop-shared/src/*_test.go`, `tests/browser/`, `scripts/release/test_*.py`.
- **Build locali**: `scripts/release/`; **audit**: `scripts/qa/`; **storico**: `docs/qa/`.

Per i percorsi per funzione (layout, spostamenti, recovery, Cloud, import/export, OCR/PDF, AI e pannelli) aprire **[`docs/CODE_NAVIGATION.md`](docs/CODE_NAVIGATION.md)**. La sua tabella di responsabilità è più utile di una lista totale dei file.

## Diagnostica dei gate Android — lezione del 31 ottobre 2026

Prima di modificare il codice applicativo per un APK che non si compila, seguire la [diagnosi dei fix Codex](docs/qa/2026-10-31-codex-apk-build-fixes.md). Distinguere tre problemi indipendenti: **fallimento di un test**, **errore di sintassi/compilazione Java** e **difetto reale dell'app**. Usare i nomi TAP `not ok` e la prima causa `javac` dal log, non soltanto il conteggio finale.

- **Test nativi asincroni**: attendere l'evento osservabile della chiamata al bridge (`whenSent`/Promise notificata dal mock), non un numero fisso di `await Promise.resolve()`.
- **ID di export/recupero**: `NeuroMapRecovery.requestId` produce UUID **v4 canonici con trattini**, versione e variante; anche il fallback `crypto.getRandomValues` deve rispettare il contratto del codice nativo.
- **Java**: dopo i test Node eseguire sempre Gradle/Javac; una lambda non può dichiarare un parametro con lo stesso nome di una variabile locale nel metodo che la contiene.
- **Nuovi test browser**: confrontare gli elementi attesi con il DOM effettivamente generato; per i controlli localizzati verificare *separatamente* il testo visibile e il nome accessibile.
- **Correzioni di test**: non correggere il codice dell'app se l'asserzione, il mock o il suo timing sono sbagliati; mantenere invece il test del comportamento desiderato e far ripassare tutta la suite applicabile.

## Confronto obbligatorio per estrazioni puramente organizzative

Per divisioni conservative di `apps/desktop-shared/editor/` o `apps/android/editor/`, prima di dichiarare preservato il comportamento, confrontare la composizione dell'editor nei **due commit**:

```bash
python scripts/maintenance/compare_editor_bundles.py --base <commit-prima> --head HEAD
```

Il controllo è di sola lettura e confronta i JavaScript concatenati con l'inserimento di `editor-colors.js`. L'esito `IDENTICAL` protegge le estrazioni testuali, **non** certifica CSS, librerie condivise, packaging, codice nativo o correttezza funzionale. Dopo il confronto eseguire anche `npm run test:structure`, `npm test`, test Python, browser e build native pertinenti. I test del comparatore si eseguono con `python -m unittest discover -s scripts/maintenance -p 'test_*.py' -v`.

## Integrità e test

- Preferire test riproducibili sui componenti reali; non descrivere scenari virtuali come utenti fisici.
- Controllare le regressioni in entrambe le piattaforme quando si modifica stato, modello, layout, zoom, salvataggi o import.
- Usare dal checkout `npm test`, `npm run test:build` e `npx playwright test` per la copertura applicabile. I test Go richiedono il backend Go e le piattaforme native; Android APK e Mac DMG richiedono rispettivamente gli strumenti/host adeguati. Usare le istruzioni correnti in `docs/DEVELOPMENT.md`.
- Per mappe grandi verificare perdita di nodi, cicli, duplicati ID, correttezza `parentId`, riferimenti a immagini/relazioni, posizioni finite, Undo/Redo, salvataggio e riapertura.
- **Dichiarare sempre quali prove sono state veramente eseguite**. Una verifica statica o una prova isolata JS non equivale a Playwright o a una prova dell'EXE, DMG, APK sul dispositivo reale.

## Sicurezza, release e GitHub

- **Non avviare GitHub Actions e non introdurre trigger automatici**: gli workflow presenti servono soltanto all'avvio manuale. Preferire build e test locali.
- `main` è il riferimento ufficiale. La procedura ordinaria documentata in `CONTRIBUTING.md` prevede branch/PR; se il proprietario richiede espressamente correzioni sicure direttamente su `main`, seguire tale istruzione senza operazioni distruttive e indicando commit e limiti delle verifiche.
- Non modificare copie temporanee prodotte dallo staging né artefatti binari come se fossero sorgenti. Non cancellare rami storici, file utenti, screenshot o test senza autorizzazione esplicita e verifica della provenienza.
- Non inserire credenziali, token, chiavi AI, dati personali, chiavi di firma o bypass di licenza nel repository. Android Free rimane separato dalla distribuzione Developer.
- Se il cambiamento riguarda l'organizzazione, aggiornare [la mappa del repository](docs/CODE_NAVIGATION.md), [la struttura generale](docs/REPOSITORY_LAYOUT.md) e i manifest di staging **solo se realmente necessari**. Non fare refactor massivi per semplice estetica.

## Regola di collaborazione

L'obiettivo è consentire a un nuovo manutentore o a un agente di trovare il **punto di modifica canonico** senza esplorare l'intero monorepo, ma non sacrificare stabilità o compatibilità per ridurre il numero di cartelle. Segnalare in modo esplicito rischi, prove mancanti e dipendenze da verificare prima del rilascio.
