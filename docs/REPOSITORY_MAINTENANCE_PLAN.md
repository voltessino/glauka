# Glauka — piano di manutenzione del repository

**Rilevazione:** 31 ottobre 2026, `main`; dati della GitHub API per il repository privato `voltessino/neuromap-android`. Questa pagina serve per **ridurre il disordine senza rompere il prodotto**. Non è autorizzazione alla cancellazione di branch, PR, archivi o codice.

**Aggiornamento di pulizia (31 ottobre):** è disponibile l'[inventario verificato dei file e dei branch](maintenance/2026-10-31-repository-cleanup-inventory.md). La fotografia originale riportata sotto rimane storica; il nuovo audit conta 316 branch e distingue i candidati tecnici da quelli approvati per un'eventuale eliminazione.

**Aggiornamento successivo:** sette archivi compressi storici sono stati ritirati dal `main`: 3.421.897 byte di file precedenti in meno, ancora recuperabili dalla cronologia Git. Il [registro dei blob](maintenance/legacy-source-archives.json) e il [rapporto](maintenance/2026-10-31-repository-cleanup-inventory.md) documentano l'intervento. Nessun branch o tag eliminato.

## Stato rilevato

| Elemento | Situazione |
| --- | --- |
| File versionati | 1.363 (fotografia iniziale, prima dell'aggiunta delle nuove guide) |
| Branch | 312, incluso `main`; 58 con prefisso `download/` o `downloads/` |
| Pull request aperte | 19 |
| Rapporti Markdown sotto `docs/qa/` | 178 (fotografia iniziale) |
| Editor desktop | JS sorgente sotto `apps/desktop-shared/editor/`, backend Go sotto `src/` |
| Editor Android | JS sotto `apps/android/editor/`, nativo Java/Gradle sotto `native/` |
| Workflow GitHub | Configurati per `workflow_dispatch` manuale: non avviarli |

Non presumere che un branch vecchio sia inutile o già integrato. Alcune PR aperte includono espressamente **DO NOT MERGE**; rispettare questa indicazione. Il solo nome del ramo o lo stato GitHub della PR non sostituiscono l'analisi dei commit rispetto a `main`.

## Fase 1 — navigazione sicura (realizzata)

- Nuovo [`AGENTS.md`](../AGENTS.md) per agenti e Codex.
- Nuova [mappa del codice per funzione](CODE_NAVIGATION.md), collegata da [README](../README.md), [struttura](REPOSITORY_LAYOUT.md) e [contributi](../CONTRIBUTING.md).
- Nuovi ingressi nelle cartelle [editor desktop](../apps/desktop-shared/editor/README.md) e [editor Android](../apps/android/editor/README.md).
- Nuovo [indice della documentazione](README.md) e [indice QA](qa/README.md).
- Correzione delle indicazioni di versione obsolete nella [guida sviluppo](DEVELOPMENT.md), con riferimento a `versions.json`.

Questa fase non modifica i percorsi dei file di produzione e non dovrebbe richiedere modifiche a `prepare.py` o ai manifest `sources.json`.

Per la verifica indipendente dell'equivalenza dei 71 sorgenti desktop e dei 14 Android, vedere il [rapporto QA di riorganizzazione](qa/2026-10-31-code-reorganization-verify.md).

### Primo refactoring controllato già realizzato

Il blocco autonomo delle preferenze di presentazione è stato estratto da `apps/desktop-shared/editor/app.js` nel nuovo `workspace-view-metadata.js`. Il manifest desktop lo carica subito dopo Atlas e prima del controller. **La concatenazione del nuovo modulo e del controller coincide byte per byte con il vecchio `app.js`**, mantenendo la logica originale. È stato aggiornato il test sulla persistenza delle viste e aggiunto un controllo nello staging Python. I test JS mirati sono stati verificati isolatamente; manca ancora l'esecuzione completa in un checkout con Node/Python/Playwright.

## Fase 2 — pulizia dei branch e delle PR (solo dopo revisione)

1. Usare [`scripts/maintenance/prune_merged_branches.py`](../scripts/maintenance/prune_merged_branches.py) da un **checkout locale autenticato**, inizialmente **solo in modalità dry-run**, senza `--apply`. Lo script ha già esclusioni protettive per `main`, rami di download, archivio e rami divergenti speciali.
2. Per ogni branch candidato controllare il commit di base, l'antenato comune, i commit **esclusivi** rispetto a `main` e le PR collegate. Segnare: integrato senza commit esclusivi, divergente da conservare, archivio di download, oppure richiede decisione.
3. Presentare l'elenco verificato al proprietario **prima** di usare `--apply`, eliminare rami o chiudere PR. Non eseguire merge indiscriminati, neppure su vecchi branch etichettati come funzionalità.
4. Mantenere la cronologia Git. Le vecchie build non sono la fonte della release: il codice corrente è `main`, le versioni sono in [`versions.json`](../versions.json).

È stata completata una **ricognizione non distruttiva di 44 branch**: 22 erano senza commit esclusivi rispetto a `main`, 22 risultavano divergenti. Vedere [il rapporto con i nomi e i conteggi](maintenance/2026-10-31-branch-triage.md). Mancano da confrontare gli altri 267 branch non principali. Nessun branch e nessuna PR sono stati cancellati o chiusi.

## Fase 3 — ridurre la complessità del codice (dopo gate locali)

**Riferimento operativo:** [roadmap di modularizzazione con priorità, rischi e gate](maintenance/2026-10-31-modularization-roadmap.md).

Nella sessione del 31 ottobre sono state completate altre due estrazioni del desktop con sorgente concatenato invariato: `layout-navigation.js` è ora diviso in cinque moduli per area e `shell.js` in dizionario, localizzazione/prodotto e Home. Sono stati modificati i manifest e i test che leggevano direttamente i vecchi file; sono stati eseguiti test JS mirati isolati, **non** le build complete.

I file più difficili da mantenere sono i grandi controller/aggregatori (`apps/desktop-shared/editor/app.js`, `apps/android/editor/app.js`, `shell.js`, `layout-navigation.js`, `packages/editor-ui/linked-views.js`). La proposta è dividerli **per responsabilità** con piccoli commit e test dedicati, non riorganizzare tutta la tree in un colpo solo.

Per ogni estrazione: definire un'interfaccia stabile, aggiornare gli ordini di caricamento in `sources.json`, aggiornare `prepare.py` dove necessario, eseguire unit test Node + test di staging Python + test browser per desktop e Android + build native interessate. Ogni regressione blocca la migrazione successiva. Non alterare formati salvati, ID, checksum o licenze per semplici ragioni estetiche.

## Decisioni rinviate

**Non effettuati:** rinomina del repository GitHub, divisione in tre repository, spostamento massivo di QA o asset, cancellazione rami `downloads/`, modifica di branch protection, attivazione GitHub Actions e conversione complessiva dei file JavaScript in moduli ES. Ognuna richiede una valutazione specifica e, ove distruttiva, approvazione del proprietario.

## Come verificare che la navigazione resti affidabile

Quando si aggiunge un nuovo modulo o cambia il percorso di una funzione, aggiornare [`CODE_NAVIGATION.md`](CODE_NAVIGATION.md) e le guide locali. Controllare i collegamenti Markdown e l'esistenza dei file referenziati, quindi i due `sources.json`. Chi presenta un report deve distinguere tra controlli statici, prove JS isolate, suite complete, Playwright e test su dispositivi reali.

### Triage locale in formato JSON (senza cancellare nulla)

Da un checkout autenticato con `GH_TOKEN` o `GITHUB_TOKEN` configurato **soltanto nell'ambiente locale**:

```bash
python scripts/maintenance/prune_merged_branches.py --json-report ../glauka-branch-review.json
python -m unittest discover -s scripts/maintenance -p 'test_*.py' -v
```

La modalità predefinita è **dry-run**. Lo script preserva `download/`, `downloads/`, `backup/`, `release/`, `archive/`, branch protetti, eccezioni esplicite e PR aperte. Può proporre *candidati* soltanto quando il confronto GitHub prova che un branch non ha commit esclusivi (`ahead_by=0`, stato `behind` o `identical`). Anche un ramo associato a una PR integrata tramite squash viene conservato se possiede commit esclusivi. Il JSON è un inventario per revisione manuale, **non un'autorizzazione a cancellare**.
