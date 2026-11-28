# Changelog Glauka

Le versioni sono candidate e non costituiscono una certificazione di stabilità. Le istruzioni di collaudo native rimangono obbligatorie.

## 27 ottobre 2026 — Android 0.6, consolidamento release (sviluppo)

- Versione APK collegata a `versions.json`, asset Gradle sincronizzati al prepare.
- Rinomina bridge Android `NMAndroidAI`, test access debug-only con `BuildConfig.PRIVATE_AI_TEST`.
- Android Keystore per le chiavi AI, controllo host/asset estratto, JUnit ed emulatore locali predisposti.
- Release Android con firma esterna obbligatoria, R8 e resource shrinking. Non è stata generata né collaudata una nuova release firmata.
- Identità package storica mantenuta in attesa di una migrazione controllata dei dati WebView.

## Aggiornamenti precedenti

**Incremento studio e fonti (24 ottobre):** esportazione e ripasso protetti, Documento sincronizzato, OCR selettivo italiano interamente locale e Dashboard delle mappe aperte. Le funzioni condivise sono incluse in Windows/macOS e adattate ad Android. L'OCR usa Tesseract WASM e un modello italiano verificati e inclusi nel pacchetto: nessuna API o installazione Python. Scegli fino a 20 pagine per batch, confronta originale e testo e conferma prima di importare con Undo. [Implementazione, test e limiti](docs/qa/2026-10-24-study-document-ocr-dashboard-integration.md).

**Ottimizzazione PDF.js:** il pacchetto usa ora i file Mozilla minificati (stessa versione API/worker), l'analisi può riutilizzare in memoria il risultato per lo stesso oggetto File e l'impronta SHA-256 viene calcolata sui byte già caricati, senza seconda lettura completa del PDF. Miglioramenti implementati nei sorgenti, **velocità e compatibilità da misurare** con le build reali. [Note tecniche](docs/qa/2026-10-23-pdfjs-offline.md).

**PDF.js offline integrato nei sorgenti:** Source Lens e importatore documenti leggono ora PDF testuali tramite Mozilla PDF.js 6.4.299, con pagine tracciabili e gruppi dai segnalibri reali. Con un PDF di 200 pagine vengono proposti nodi per pagina, non un riassunto AI. Il motore e il worker sono scaricati una sola volta dalla distribuzione npm ufficiale con verifica SHA-512 durante la preparazione del pacchetto; nessuna API, cloud o CDN viene usata mentre l'app legge il PDF. [Limiti e QA PDF.js](docs/qa/2026-10-23-pdfjs-offline.md). Il browser e le build native richiedono ancora collaudo prima di un rilascio stabile.

Il **milestone 7.6 Knowledge Database** è stato implementato nei sorgenti Windows/macOS e Android: tag, proprietà tipizzate per nodo, tabelle filtrabili delle mappe aperte, template non distruttivi e diario quotidiano deduplicato. Non è ancora una release binaria stabile. [Dettagli QA 7.6](docs/qa/2026-10-23-v76-knowledge-database.md).

Il **milestone 7.5 Knowledge Links** è ora incluso nei sorgenti desktop e Android: note Markdown per nodo, wiki-link stabili, backlink nelle mappe aperte, anteprima senza HTML eseguibile e protezione delle modifiche non salvate. Non costituisce una release stabile 7.5. [Dettagli e QA 7.5](docs/qa/2026-10-23-v75-knowledge-links.md).

La versione sorgente candidata Windows/macOS è **7.4.0-rc.1** (*release candidate, non stabile certificata*). Include Source Lens 2.0, importazione documenti, Visual Learning, interoperabilità Anki, condivisione HTML offline, calendario, Gantt con dipendenze, confronto delle copie e Quality Center. Android mantiene funzionalità editor 6.16.0 e NON è equiparabile al desktop 7.4. **Windows:** installer Glauka Developer privato compilato localmente; GUI Windows nativa non ancora collaudata. **macOS:** nessun nuovo DMG 7.4 certificato; gli artefatti Mac 6.16 rimangono storici. Il gate di rilascio locale [`scripts/release/v7_gate.py`](scripts/release/v7_gate.py) richiede test Node, **stress**, build staging e browser Chromium/WebKit, senza GitHub Actions. La versione 7.4.0 stabile potrà essere assegnata solo dopo gate completo e prove native Windows/macOS, firma e installazione.

## Verifica candidata 7.4.0-rc.1 (solo locale, nessuna Actions)

Da un checkout completo di questo commit, con Node 20+, Python e browser Playwright installati:

```bash
npm ci
npm run test:stress
npm run test:knowledge:stress
npm run test:database:stress
npm test
npm run test:build
npm run test:browser
python3 scripts/release/v7_gate.py --output /percorso/esterno/nuova-cartella-qa
```

L'ultima riga riesegue i gate e prepara i pacchetti desktop senza usare GitHub Actions; il percorso di output deve essere **esterno** al repository e vuoto. **Un gate verde non sostituisce il collaudo su Windows e macOS installati**. Il report [7.4.0-rc.1](docs/qa/2026-10-23-v74-rc1-gate.md) spiega ciò che è stato effettivamente eseguito e i blocchi prima della stabile.

## Android 0.6.0-rc.1 — Porting touch 7.4 (non stabile)

La versione Android è stata portata a **0.6.0-rc.1-private** per il *codice sorgente*. Il nuovo pannello touch **Studio & Strumenti** include dodici moduli locali (Source Lens, Atlas, Knowledge Links (Markdown/backlink), Knowledge Database (tag/proprietà/diario), import documenti, Quick Capture, Visual Learning, Anki, attività con prerequisiti, Quality Center, condivisione HTML/ICS e scambio verificabile). Le schermate si adattano a telefoni, tablet e orientamento orizzontale mediante CSS dedicato. Il canvas editor di base è ancora **6.16.0**: l'app Android **non** è ancora perfettamente equivalente alla Windows 7.4, e non è stata testata su ogni dispositivo né compilata in un nuovo APK in questa sessione. [Dettagli e QA](docs/qa/2026-10-23-android-v74-port.md).

Dopo il checkout, esegui `npm run test:android:stress` e `python3 scripts/release/android74_gate.py --output /percorso/esterno/qa-android`; quest’ultimo richiede Node, Playwright, Python, Android SDK e Gradle **locali**. Non viene avviato GitHub Actions.

## Build desktop storiche 6.16.0 (non aggiornate al main corrente)

Le build **private Developer 6.16.0** restano solo nel repository privato (ramo `downloads/desktop-6.16.0-15c2dcd`, commit applicativo `15c2dcd`). Non pubblicare URL di download, EXE/DMG/ZIP Developer o link raw sul repository Open Source.

La verifica dei checksum e dei manifest resta sul ramo privato. **Questi file non si aggiornano da soli** quando `main` riceve modifiche. Per nuove build usare la procedura locale in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md), **senza avviare GitHub Actions**.

