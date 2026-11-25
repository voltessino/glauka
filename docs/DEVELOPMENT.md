# Sviluppare e compilare

Usare il checkout esistente e verificare `main`. Per orientarsi nel codice, partire dalla [mappa per funzione](CODE_NAVIGATION.md) e dalle [istruzioni per agenti](../AGENTS.md). Non avviare GitHub Actions: tutte le build descritte qui possono essere eseguite localmente con i prerequisiti appropriati.

## Strumenti

- Node 24 (`.node-version`), dipendenze di test bloccate in `package-lock.json`.
- Python 3.12+ per staging e test dei sorgenti.
- Go 1.23.12 (`.go-version`) per i backend desktop.
- Android: JDK 17, Gradle 8.9, SDK/platform 35 e build-tools 35.0.0. AGP 8.7.3 può richiedere anche i build-tools 34.0.0.
- App Mac: macOS con Xcode Command Line Tools; la compilazione nativa richiede un host Mac.
- Installer Windows: PowerShell e Go; la compilazione nativa richiede Windows.

## Test condivisi

```bash
npm ci
npm test
npm run test:build
npx playwright install chromium
npm run test:browser
```

Per un Chromium già installato impostare `CHROMIUM_EXECUTABLE_PATH` al suo eseguibile. I server del test ascoltano solo su loopback e si chiudono al termine della suite.

I workflow desktop eseguono inoltre la selezione `desktop` sul sistema operativo
di destinazione: Chromium su Windows e WebKit su macOS. Per ripeterla:

```bash
npx playwright install chromium
npx playwright test --config playwright.desktop.config.js
# Su macOS, per il motore WebKit:
npx playwright install webkit
NEUROMAP_TEST_ENGINE=webkit npx playwright test --config playwright.desktop.config.js
```

Questi test verificano l'editor preparato dallo staging. Non pilotano la finestra
Swift/WKWebView o i dialoghi nativi; eseguire separatamente i test Go e le build sui sistemi di destinazione.

## Controlli rapidi della struttura del monorepo

Per manutenzione, documentazione e modularizzazione eseguire:

```bash
npm run test:structure
python -m unittest discover -s scripts/maintenance -p 'test_*.py' -v
```

Il primo comando controlla manifest, sorgenti separati, preferenze delle viste, compilazione sintattica dell'intero JavaScript concatenato desktop/Android e collegamenti nelle guide; il secondo verifica che la revisione locale dei branch sia prudente. **Non sostituiscono** `npm test`, `npm run test:build`, Playwright e le build native. La [roadmap di modularizzazione](maintenance/2026-10-31-modularization-roadmap.md) descrive le fasi e le verifiche richieste.

Per un refactoring che **sposta soltanto** codice tra file dell'editor senza alterarlo, confrontare i commit prima/dopo (il comando legge Git ma non cambia il checkout):

```bash
python scripts/maintenance/compare_editor_bundles.py --base <commit-prima> --head HEAD
```

Esito `IDENTICAL` su desktop e Android = stessa composizione JS dell'editor, incluso `editor-colors.js`. Esito `DIFFERENT` = interrompere la dichiarazione di equivalenza, analizzare il primo carattere diverso e ripetere i test. Con `--include-ui-fragments` confronta anche le IIFE delle impostazioni e delle viste collegate dopo le estrazioni. Non confronta gli altri bundle condivisi, i CSS, i file nativi o le funzionalità in esecuzione: non sostituisce le altre prove. Il comparatore ha test autonomi nella suite `scripts/maintenance` indicata sopra.

Le voci `shared/<nome>.js` dei manifest puntano a
`packages/editor-ui/editor-shared/<nome>.js`. Staging, comparatore e fixture di
composizione usano questo contratto, mantenendo l'ambito e l'ordine originali.

## Android

Dalla radice del checkout, con una destinazione nuova:

```bash
python3 scripts/release/prepare.py android /tmp/neuromap-android
cd /tmp/neuromap-android
gradle --no-daemon --max-workers=2 assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`. La versione e il `versionCode` vanno letti da [`versions.json`](../versions.json), non dai vecchi report. Verificare localmente la firma e i metadati dell'APK; una build debug non equivale a una release pubblicabile.

### Ulteriore protezione della build Android privata

Lo script `scripts/release/build_android_local.py` continua a richiedere `npm test`, staging, Gradle (compilazione e test Java), verifica APK e integrità ZIP **nell'ordine previsto**. Il controllo dei rapporti Gradle adesso rifiuta anche XML assente, corrotto, incongruente, suite con zero test e suite con tutti i test saltati. Solo almeno un test Java realmente eseguito e nessun errore consentono di proseguire al packaging.

Per verificare il solo controllo dei rapporti senza SDK, firma o dispositivo:

```bash
python -m unittest discover -s scripts/release -p 'test_android_native_reports.py' -v
```

I test dell'helper **non equivalgono** all'esecuzione reale di Gradle, né a installazione e prova dell'APK su Android. Per i salvataggi e il recupero continuano a essere obbligatori i test `workspace-recovery-integrity.test.js`, `workspace-autosave-race.test.js` e quelli nativi Android già presenti, senza modificarne il codice di produzione.

## Desktop

```bash
python3 scripts/release/prepare.py macos /tmp/neuromap-mac
cd /tmp/neuromap-mac/desktop
go test ./...
go test -tags developer ./...
```

Per Windows usare `prepare.py windows <destinazione>`. Il backend si verifica con `go test .` e `go test -tags developer .`: il setup richiede prima l'EXE da incorporare. I test PowerShell verificano l'upgrade con EXE e backup precedenti bloccati. I workflow contengono i comandi completi per icone, risorse di versione Windows, compilazione universale Mac, firma ad hoc e DMG.

Quando si lanciano manualmente i test Go da uno staging esterno, impostare
`GLAUKA_AUDIT_SOURCE_ROOT` al percorso assoluto del **checkout sorgente**, affinché
l'audit nativo trovi anche i sorgenti Windows e Android. In Bash usare
`export GLAUKA_AUDIT_SOURCE_ROOT=/percorso/del/checkout`; in PowerShell
`$env:GLAUKA_AUDIT_SOURCE_ROOT='C:\percorso\checkout'`. I builder locali lo impostano
già. Un errore di inventario per questo percorso mancante non va corretto
eliminando i test o disattivando l'audit.

Per distinguere Setup/Portable e configurare la firma Authenticode, vedere
[installazione e firma Windows](distribution/windows-signing.md). Il builder locale
supporta `--windows-sign-thumbprint` su un host Windows con certificato già predisposto;
le build private senza questa opzione sono dichiarate non firmate nel manifest.

La build Go da una copia esterna usa `-buildvcs=false`: registrare esplicitamente il commit del checkout sorgente nel manifest di rilascio, senza pretendere metadati Git da una cartella di staging.

La beta Mac conserva l'attivazione locale preesistente. I test Developer usano un profilo attivato temporaneo e controllano anche che un profilo nuovo sia inattivo e che un codice non valido venga respinto. I fixture `_test.go` non vengono compilati nell'app.

Il ciclo QA su trascinamento, import e recupero è descritto in
[recupero, trascinamento e lingue](qa/2026-10-19-recupero-trascinamento-import-lingue.md).
`tests/browser/fixtures/ui-language.json` è un inventario revisionato dei testi
IT/EN montati, inclusi pannelli nascosti: nuove frasi richiedono una verifica del
risultato atteso. I test di recupero Go usano directory temporanee e processi
separati; su Unix il limite alla dimensione del file simula una scrittura
rifiutata senza riempire il disco.

I casi AI deterministici sono in `tests/browser/ai-adversarial.spec.js`:
nessuna chiamata a provider a pagamento. Il test Go Developer dell'annullamento
usa un provider HTTP locale sulle porte consentite 11434/1234. Vedere il
[rapporto AI](qa/2026-10-20-ai-avversa.md) per copertura e limiti.

## Prima di correggere l'app

La copia ufficiale è `origin/main`. Il `main` presente solo su questo computer può essere vecchio. Non partire da quello e non fare commit su `main`.

```text
git fetch origin --prune
git switch main
git pull --ff-only origin main
git switch -c <nuovo-branch>
test di partenza
modifica
test completi
PR
merge
git switch main
git pull --ff-only origin main
```

I test di partenza, prima di modificare, sono `npm run test:structure`, `npm test`, i test Python di release e `npx playwright test`. I test completi, dopo l'ultima modifica, sono gli stessi più `node scripts/maintenance/glauka-integrity-preflight.cjs`. Su Windows, se `npm run test:build` non parte perché manca il comando `python3`, il comando equivalente è `py -3 -m unittest discover -s scripts/release -p "test_*.py"` con `PYTHONUTF8=1`.

Se `main` è già aperto in un'altra cartella di lavoro, non spostarlo da lì e non scartare le modifiche di quella cartella. Crea il ramo nuovo con `git switch --detach origin/main` e poi `git switch -c <nuovo-branch>` in una cartella libera. Controlla `git status --short --branch` e `git worktree list` prima di modificare file.

Prima di pubblicare:

```text
node scripts/maintenance/glauka-integrity-preflight.cjs
```

Il comando si ferma, con il motivo e il comando da eseguire, se la cartella ha modifiche non dichiarate, se `origin/main` non è stato scaricato, se il ramo non contiene l'attuale `origin/main`, se i manifest non corrispondono ai file presenti, se un segnale di composizione manca o è ripetuto, se la versione visibile di Windows, Mac o del sito non è `1.0.4`, o se mancano le prove nel browser di pannelli, versione e tema. Non usa l'orologio del computer: un controllo che scade dopo 24 ore non è riproducibile. Per dichiarare modifiche volute e non ancora registrate: `GLAUKA_DECLARED_CHANGES=1`. Lo stesso controllo statico fa parte di `npm test` e di `npm run test:structure`. Non avvia nulla su GitHub.

La versione che vede chi usa l'app su Windows e Mac è `versions.json` → `windows.version` e `macos.version` (`1.0.4`). `versions.json` → `editor` e `package.json` restano `7.4.0-rc.1`: è l'identificativo interno dei moduli condivisi, non un numero da mostrare. L'app per telefono resta `android.version` `0.6.22`, con `version_code` 28, perché è una linea di pubblicazione diversa.

Su GitHub, `main` dovrebbe rifiutare l'invio diretto, esigere una richiesta di unione, un'approvazione e un ramo già aggiornato. L'ultima lettura dell'API di GitHub ha risposto che il ramo `main` non ha questa protezione (risposta HTTP 404, «Branch not protected»). Non considerarla attiva. Impostarla richiede un'autorizzazione esplicita del proprietario; non va dichiarata come già configurata.

## Controllo locale di regressione (script storico `v7_gate.py`)

Prima di etichettare la release finale, su un checkout completo con Node, npm, Python e browser Playwright installati, esegui:

```bash
python3 scripts/release/v7_gate.py
```

Su Windows usa `py -3 scripts/release/v7_gate.py`. Il comando **non avvia GitHub Actions**; esegue i test Node esistenti, i test Python della build, Playwright Chromium, Playwright WebKit desktop e prepara i sorgenti Windows/macOS in cartelle temporanee **esterne al repository**. Ogni fase produce un log e un `report.json` nella directory QA stampata. L'esito è positivo soltanto se tutte e sei le fasi terminano correttamente.

Per vedere i comandi senza eseguirli: `python3 scripts/release/v7_gate.py --dry-run`. Le opzioni `--skip-browser` e `--skip-stage` producono risultati **incompleti**, mai una certificazione verde. Il gate verifica i sorgenti e gli staging, **non** sostituisce prove GUI native, verifica del file installato, firma/notarizzazione e test di recupero dopo un crash.

Il nome dello script `v7_gate.py` è **storico** e non determina la versione della release corrente. Per attribuire una versione usare [`versions.json`](../versions.json). Non pubblicare EXE o DMG senza prove native, verifica dei dati, firma/notarizzazione quando richieste e corrispondenza con il commit sorgente.

## OCR: benchmark locale e revisione delle zone

Procedura riproducibile, misure sintetiche e limiti del riconoscimento: [rapporto OCR](qa/2026-10-24-ocr-quality-and-regions.md). Il benchmark usa il motore WASM e gli asset locali inclusi nelle build; non richiede GitHub Actions o servizi OCR esterni.

Per scegliere controlli rapidi, regressioni mirate e verifiche complete di release,
vedere [la matrice dei gate](maintenance/TEST_GATES.md).
