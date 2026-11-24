# Glauka Android · anteprima privata 0.6.21-rc.1-private

Versione attuale letta da [`versions.json`](../../versions.json): **0.6.21-rc.1-private**, `versionCode` **27**, Android 8 o successivo (API 26). È un’anteprima privata di debug, non una release pubblica firmata per uno store.

Free include gli strumenti locali. Pro, con provider personale, include le funzioni di intelligenza artificiale. [Licenze e pubblicazione](../../docs/free-pro-licensing.md).

La vecchia copia compressa dei sorgenti Android è stata ritirata dal `main`, ma resta recuperabile nella [cronologia Git](../../docs/maintenance/legacy-source-archives.json). I branch di distribuzione APK rimangono invariati.

## Archivio delle preview precedenti

# Glauka Android 0.6.6 RC — main aggiornato e barra del testo

[Scarica APK nello ZIP](https://github.com/voltessino/neuromap-android/blob/downloads/glauka-android-20261028-b93ad40/Glauka-Android-0.6.6-rc.1-private.zip?raw=true) · [Verifiche e istruzioni](../../docs/qa/2026-10-28-android-recovered-main-and-text-controls.md).

**Firma debug diversa: esportare e verificare il backup di tutti i progetti PRIMA di disinstallare la vecchia app. Android rifiuta l’aggiornamento diretto con firma diversa.** Non disinstallare senza un backup verificato.

Integra main fino alla PR #158, correzioni mobile #152–154, carattere/dimensione/colore/elenchi/allineamento, spessore unico e importazione strutturale chiarita. Android 8+, versionCode 12, preview privata. Compilazione e test automatici completati; nessun collaudo su dispositivo fisico o emulatore.

# Glauka Android — strumenti per attività e pannelli compatti, 0.6.5 RC

[**Scarica APK nello ZIP**](https://github.com/voltessino/neuromap-android/blob/downloads/glauka-tools-symbols-20261027/Glauka-Android-0.6.5-rc.1-private.zip?raw=true) · [Schermate, verifiche e limiti](../../docs/qa/2026-10-27-mobile-organized-tools-and-symbols.md).

Simboli al posto di Marcatori, finestra contenuta nel viewport con tastiera, ambito del pannello Stile richiudibile e strumenti divisi per attività con descrizioni. Stessa firma debug e application ID, versionCode 11: aggiornamento senza disinstallazione. Anteprima privata; collaudo fisico Android ancora da eseguire.

# Glauka Android — menu coerenti e strumenti chiari, 0.6.4 RC

[**Scarica APK nello ZIP**](https://github.com/voltessino/neuromap-android/blob/downloads/glauka-android-surfaces-20261027/Glauka-Android-0.6.4-rc.1-private.zip?raw=true) · [Verifiche e schermate](../../docs/qa/2026-10-27-android-consistent-surfaces.md).

Disposizione dei rami verticale e leggibile, menu bianco/viola uniformi, selezioni visibili e nomi esplicativi: Cerca nelle mappe, Tag e proprietà, Riepilogo mappe. Estrai lo ZIP e aggiorna l’app senza disinstallarla. Stessa firma debug e application ID, versionCode 10. Preview privata, non eseguita qui su hardware Android.

# Glauka Android — build integrata 0.6.3 RC

[**Scarica APK nello ZIP**](https://github.com/voltessino/neuromap-android/blob/downloads/glauka-integrated-20261027/Glauka-Android-0.6.3-rc.1-private.zip?raw=true) · [Verifiche e limiti](../../docs/qa/2026-10-27-integrated-main-release.md).

Include main fino alla PR #151 e le PR lingue/interfaccia telefono #143–145. Estrai lo ZIP e aggiorna l’app senza disinstallarla. Preview privata debug; firma invariata, versionCode 9.

# Glauka Android — interfaccia mobile 0.6.2 RC

[**Scarica lo ZIP**](https://github.com/voltessino/neuromap-android/blob/downloads/glauka-android-mobile-20261027/Glauka-Android-0.6.2-rc.1-private.zip?raw=true) · [Verifiche e limiti](../../docs/qa/2026-10-27-android-phone-workspace.md).

Navigazione da app, pannelli dal basso, avvisi compatti e gesti mappa verificati. Estrai lo ZIP e installa l’APK come aggiornamento: identificativo e chiave locale di firma di test restano invariati. Preview debug privata, compilata e verificata; non eseguita qui su un dispositivo/emulatore Android. Le sezioni successive conservano la storia e le istruzioni precedenti.

# Glauka Android — anteprima 0.6.1 RC

[**Scarica APK Android**](https://github.com/voltessino/neuromap-android/blob/downloads/glauka-android-20261027/Glauka-Android-0.6.1-rc.1-private.apk?raw=true) · [Risultati e limiti delle verifiche](../../docs/qa/2026-10-27-android-languages.md).

Otto lingue offline, scelta al primo avvio e in Studio e strumenti, logo Glauka e identità conservata per l’aggiornamento. APK privato con firma debug, Android 8+, compilato e verificato; non ancora eseguito su un dispositivo/emulatore in questa sessione. La base mobile resta distinta dalle funzionalità esclusive desktop.

Le sezioni successive conservano le istruzioni e la storia della base Android.

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
