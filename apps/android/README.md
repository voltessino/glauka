# Glauka Android · Free 0.6.22

Versione attuale letta da [`versions.json`](../../versions.json): **0.6.22**, `versionCode` **28**, Android 8 o successivo (API 26). Il pacchetto pubblico firmato è `Glauka-Android-Free-0.6.22-Release.apk`.

Free include gli strumenti locali. Pro, con provider personale, include le funzioni di intelligenza artificiale. [Licenze e pubblicazione](../../docs/free-pro-licensing.md).

La vecchia copia compressa dei sorgenti Android è stata ritirata dal `main`, ma resta recuperabile nella [cronologia Git](../../docs/maintenance/legacy-source-archives.json). I branch di distribuzione APK rimangono invariati.

## Archivio delle preview precedenti

Le anteprime Android 0.6.1–0.6.6 RC restano solo nel **repository privato** (rami `downloads/`), con note QA in `docs/qa/`. **Non pubblicare** URL di download privati, ZIP/APK «private» o link raw su GitHub pubblico.

Prima di passare da una preview debug a un’altra firma: esportare e verificare il backup di tutti i progetti. Android rifiuta l’aggiornamento diretto con firma diversa.

# Android Free 0.6.0-rc.1 — Interfaccia touch e strumenti portabili 7.4

**Anteprima privata, non release stabile e non equivalente all’intero editor desktop 7.4.** Editor canvas di base: 6.16.0, con funzioni offline 7.4 abilitate dal pannello **Studio & Strumenti**. Requisito minimo Android 8 / API 26. L'APK è stato compilato localmente; il collaudo su dispositivi fisici resta da eseguire.

Il menu Studio & Strumenti contiene cinque sezioni primarie e nove sotto «Sperimentale», fra cui Source Lens 2.0 con selezione di citazioni PDF verificabili e Atlas per ricerca tra schede, **Knowledge Links 7.5** per note Markdown e backlink e **Knowledge Database 7.6** per tag, proprietà, viste filtrate, template e diario: Quick Capture, anteprima documento PDF testuale/DOCX/Markdown/TXT, Visual Learning con punti su immagini, import/export flashcard TSV compatibile Anki, stato e prerequisiti di attività con Undo, Quality Center offline, esportazione HTML/ICS e confronto locale di copie con SHA-256.


## Consolidamento sicurezza Android 0.6 (27 ottobre)

Il codice Android 0.6 legge `versionCode`, `versionName` e `minSdk` da `versions.json`; il progetto Gradle staged ne riceve una copia da `prepare.py`. Il nome visibile è **Glauka**, mentre `applicationId` rimane temporaneamente `it.neuromap.architect.preview` per evitare la perdita dei dati dell'installazione corrente. La strategia di migrazione è descritta in [Android identity migration](../../docs/architecture/android-identity-migration.md).

Il bridge AI si chiama ora `NMAndroidAI`, usa slot Android Keystore per API key per host ed è **disponibile solo in build debug private** tramite `BuildConfig.PRIVATE_AI_TEST`. Le vecchie chiavi in WebView `sessionStorage` vanno reinserite, perché non sono migrate né esportate. Il codice di test Pro non è una licenza commerciale e non è disponibile in release. La release usa R8, restringimento risorse e **richiede** firma da ambiente locale; nessuna chiave è nel repository.

Il pannello Studio & Strumenti presenta cinque scelte principali e sposta gli altri strumenti sotto **Sperimentale**, senza perderne i dati. Il tasto Indietro è gestito via AndroidX `OnBackPressedDispatcher` e `NeuroMapLifecycle.handleBack()`.

**Gate di compilazione ancora da eseguire su dispositivo:** JUnit `SecurityPolicyTest`, `connectedDebugAndroidTest`, Android 8/9/12/15, WebView vecchi/aggiornati, OCR italiano, PDF.js, salvare/riaprire mappe, AI debug, archiviazione cloud. Guida e matrice in [Android 0.6 QA](../../docs/qa/2026-10-27-android-06-release-hardening.md). Non dichiarare pronto il bundle release prima del collaudo.



**Documento, Dashboard e OCR locale:** gli strumenti includono Scrittura sincronizzata con i nodi e Dashboard in sola lettura. Da Documenti → Leggi testo dalle scansioni puoi selezionare fino a 20 pagine PDF, usare il modello italiano incluso, correggere il testo e importare con citazioni e Undo. Nessuna API, upload o download del modello durante l'uso. Sono richiesti WebView aggiornato e collaudo sui dispositivi di destinazione. [QA e limiti](../../docs/qa/2026-10-24-study-document-ocr-dashboard-integration.md).

**Lettore PDF.js offline:** Source Lens e importazione PDF ora utilizzano il motore ufficiale Mozilla PDF.js 6.4.299, caricato e impacchettato localmente (worker compreso). È disponibile la lettura di PDF testuali anche di circa 200 pagine e l'uso dei segnalibri reali come intestazioni dei gruppi. Non è OCR né riassunto AI. La libreria proviene da un archivio npm verificato SHA-512 una volta in fase di build, non dal cloud in fase di utilizzo. Per questa modifica restano ancora da eseguire test reali su WebView/telefoni, soprattutto su Android più vecchi. [Rapporto QA](../../docs/qa/2026-10-23-pdfjs-offline.md).

Le azioni rispettano le schede: le importazioni richiedono conferma, i PDF richiedono verifica manuale della fonte, nessuna sincronizzazione automatica o upload cloud. Le esportazioni passano attraverso Android Storage Access Framework. Sono preservati nei salvataggi citazioni ai PDF, riferimenti ai prerequisiti, relazioni e punti sulle immagini.

Il layout touch prevede aree minime di interazione, contenuti scorrevoli, safe area, 320px/telefoni, tablet, pieghevoli, orientamento orizzontale, tastiera e modalità accessibili. **Non è possibile garantire tutti gli schermi senza eseguire la matrice Playwright e test su dispositivi reali.**

I motori comuni 7.4, Knowledge Links 7.5 e Knowledge Database 7.6 vengono ricomposti durante `scripts/release/prepare.py android <directory-esterna>` come asset locale `android-74-core.js` (mai richiesto da un server remoto). Il codice mobile è `native/app/src/main/assets/assets/mobile-74.js` e lo stile in `mobile-74.css`.

La parità completa desktop **non** include su Android: canvas Gantt drag&drop equivalente al desktop, Atlas persistente multi-documento, AI Change Review desktop, sync cloud o collaborazione simultanea. Restano attività distinte. Nessuna licenza Developer desktop incorporata.

Test locale su un checkout completo:

```bash
npm ci
npm test
npm run test:build
npm run test:knowledge:stress
npm run test:database:stress
npm run test:android:stress
python3 scripts/release/prepare.py android /tmp/neuromap-android-rc
cd /tmp/neuromap-android-rc
gradle assembleDebug
```

Il test end-to-end con emulatore/dispositivi reali e la distribuzione firmata richiedono strumenti Android locali. GitHub Actions non viene usato. La matrice QA si trova in `docs/qa/2026-10-23-android-v74-port.md`.
