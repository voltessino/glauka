# Come creare l'APK Android Glauka sul tuo Windows

**Nessuna GitHub Actions.** APK debug privato basato sul **main aggiornato**.

Il repository contiene un progetto Android nativo, ma gli asset dell'editor vanno **rigenerati** prima di ogni compilazione, tramite `scripts/release/prepare.py android`. Non compilare direttamente `apps/android/native` senza la preparazione: i suoi asset tracciati potrebbero non includere le modifiche successive all'ultimo staging. Lo script seguente fa entrambe le cose.

## Prima esecuzione: cosa installare

1. **Git for Windows**, dal sito ufficiale https://git-scm.com/downloads/win.
2. **Python 3**, dal sito ufficiale https://www.python.org/downloads/windows/ (comando `py -3 --version`).
3. **Node.js con npm**, necessario per eseguire tutti i test JavaScript prima della build. Installare la versione indicata in `.node-version`.
4. **Android Studio**, https://developer.android.com/studio. Da **Settings → Languages & Frameworks → Android SDK** (o **SDK Manager**) installare:
   - **Android 15 / API 35** (SDK Platform);
   - **Android SDK Build-Tools 35** e **Android SDK Platform-Tools**;
   - approvare le licenze richieste dall'SDK Manager.
5. Connessione Internet per il primo download di Gradle 8.9, del plugin Android e delle dipendenze PDF.js/OCR usate durante il packaging. Sono tutte scaricate durante la build e verificate dove previsto dal codice; **l'app resta offline durante l'uso normale**.

Android Studio fornisce generalmente anche il JDK. Il progetto richiede **Java 17 o superiore**, **Gradle 8.9** e **Android Gradle Plugin 8.7.3**. Non serve installare Gradle globalmente: lo script scarica la distribuzione ufficiale 8.9 in `%LOCALAPPDATA%\Glauka\BuildTools` e ne verifica SHA-256.

## Da zero: copia il main sul Desktop

Apri **PowerShell** e incolla:

```powershell
cd "$HOME\Desktop"
git clone https://github.com/voltessino/neuromap-android.git Glauka
cd "$HOME\Desktop\Glauka"
```

Se il repository è privato, devi autorizzare GitHub nel terminale/browser. Se hai già scaricato il repository, non clonarlo di nuovo: entra direttamente nella sua cartella.

## Ogni volta che vuoi un nuovo APK

Dalla cartella del repository esegui **un solo comando**:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\release\build_android_local.ps1
```

Lo script:
- controlla che tu sia su `main`, non scarta modifiche personali e aggiorna con `git pull --ff-only origin main`;
- individua Python, Android SDK API 35 e JDK;
- scarica e verifica Gradle 8.9 se non presente;
- **esegue obbligatoriamente `npm test`** e interrompe la build in caso di errori;
- prepara **una nuova** cartella di build esterna al repository, includendo gli ultimi file dell'editor, PDF.js e OCR offline;
- **esegue i test Java/Gradle**, rifiutando rapporti mancanti, vuoti, tutti saltati o falliti;
- crea l'APK debug firmato dalla chiave di debug Android;
- copia l'APK finito nella cartella **Desktop → Glauka-APK**, con nome simile a `Glauka-Android-main-fe60ed24b7-debug.apk`, più file SHA-256.

Lo stesso percorso contiene il log, in una cartella temporanea sul Desktop:

```text
Desktop\Glauka-APK\Glauka-Android-main-<commit>-debug.apk
Desktop\Glauka-APK\Glauka-Android-main-<commit>-debug.apk.sha256.txt
Desktop\Glauka-Android-Stage-<data>-<pid>\glauka-apk-build.log
```

Il file APK standard contiene il codice sorgente di `main` **al momento della compilazione**. Se il branch cambia, occorre compilare di nuovo. Una compilazione con `-PreviewBranch -SkipUpdate` e' esplicitamente una **prova privata del branch**, salvata con nome `Glauka-Android-preview-...`; non va confusa con una build approvata di `main`.

### Opzioni

```powershell
# La precedente opzione -RunTests rimane accettata per compatibilita:
# adesso i test sono SEMPRE obbligatori, anche senza l'opzione.

# Se hai già scaricato manualmente main, non eseguire git pull
powershell -ExecutionPolicy Bypass -File .\scripts\release\build_android_local.ps1 -SkipUpdate

# Solo per collaudare una PR in un branch pulito, senza alterare main:
powershell -ExecutionPolicy Bypass -File .\scripts\release\build_android_local.ps1 -PreviewBranch -SkipUpdate
```

## Se lo script si interrompe

- **Git o Python non trovato:** installa il programma indicato e riapri PowerShell.
- **Android SDK API 35 mancante:** apri Android Studio → SDK Manager, installa API 35, Build-Tools 35 e accetta le licenze.
- **JDK mancante:** verifica che Android Studio sia installato, o imposta `JAVA_HOME` alla cartella di un JDK 17+.
- **SHA256 Gradle errato:** lo script elimina lo ZIP scaricato e interrompe la build, evitando di eseguire pacchetti non verificati.
- **Errore di download PDF.js/OCR:** occorre Internet durante la prima preparazione. Non eliminare i controlli dei checksum.
- **Test JavaScript falliti:** l'APK non viene copiato sul Desktop; leggere l'output `npm test` e correggere i casi `not ok`.
- **Gradle fallito o report Java assenti:** leggi il file `glauka-apk-build.log` indicato nell'errore; controlla licenze, toolchain Android e i risultati `testDebugUnitTest`.

### In alternativa: usare Android Studio senza compilazione da terminale

Esegui comunque:

```powershell
cd "$HOME\Desktop\Glauka"
git switch main
git pull --ff-only origin main
python scripts/release/prepare.py android "$HOME\Desktop\Glauka-Android-Studio"
```

**Importante:** la cartella `Glauka-Android-Studio` non deve già esistere. Poi in Android Studio scegli **Open** e seleziona quella cartella (non `apps/android/native`). Imposta la Gradle version **8.9** se richiesto. Attendi il sync, scegli variante **debug**, poi **Build → Generate Bundle(s) / APK(s) → Generate APK(s)** (voce equivalente nelle versioni IDE). Il file sarà in:

```text
Desktop\Glauka-Android-Studio\app\build\outputs\apk\debug\app-debug.apk
```

## Installazione sul telefono

Copia l'APK sul telefono Android e aprilo, autorizzando solo quando necessario **Installa app sconosciute** per il file manager usato. L'APK debug è destinato a test personali, **non** alla vendita né al Play Store. Se hai già un'app con lo stesso applicationId installata e con una **firma differente**, Android può rifiutare l'aggiornamento: fai prima un backup/esporta le tue mappe; la disinstallazione può eliminare i dati locali.

**Non confondere il ramo Android con la versione Windows:** Android Free usa la versione corrente di `versions.json` e include correzioni e strumenti recenti, ma il suo editor base non ha ancora completa parità con il desktop 7.4. La compilazione non può attivare le funzioni cloud Android che richiedono client OAuth e App Link verificati.

## Fonti tecniche

- [Compatibilità Android Gradle Plugin 8.7 / Gradle 8.9 / Java 17](https://developer.android.com/build/releases/agp-8-7-0-release-notes)
- [Compilazione APK con Android Studio](https://developer.android.com/build/build-for-release)
- [Checksum ufficiali Gradle, versione 8.9](https://gradle.org/release-checksums/)

## ZIP verificato con Python, anche su Linux/macOS

Con JDK17, SDK35, Build Tools35.0.0, Gradle8.9 e Node/npm già disponibili:

```bash
python3 scripts/release/build_android_local.py --output /percorso/nuovo/glauka-apk
```

Impostare `ANDROID_HOME` oppure passare `--sdk`. La cartella di output deve essere nuova e fuori dal repository. Il comando esegue test Node, staging pulito, test Java e build, verifica firma/versione/commit/asset, crea lo ZIP e ne ricontrolla il contenuto. Produce manifest, SHA256 e log. Non usa Actions e non carica nulla su GitHub.

Per impostazione predefinita richiede un checkout pulito dello stesso commit del main remoto, verificato anche a fine build. `--allow-unmerged` consente esplicitamente una preview privata di un ramo con commit; `--offline` usa origin/main locale e registra che il main remoto non è stato verificato. Nessuna delle due opzioni consente file modificati senza commit.

La chiave preview deve corrispondere al certificato già registrato: non viene sostituita automaticamente. La build pubblica usa un percorso separato con identità di firma e verifiche reali dei dispositivi. Anche l’opzione PowerShell `-AllowDifferentPreviewSigner` non può saltare i controlli di versione, commit e asset; `-SkipUpdate` salta soltanto il pull, non il controllo del checkout pulito.

### Verifica dei gate della PR #201

Il builder Windows ora rende obbligatori `npm test`, `:app:testDebugUnitTest`
e la validazione dei rapporti JUnit prima della copia dell'APK verificato.
`-RunTests` resta accettato soltanto per compatibilità e non permette di saltare test.

Il test `scripts/release/test_android_powershell_gates.py` esegue i percorsi di
successo e fallimento con PowerShell 7 su POSIX: Git/npm/Gradle/SDK sono comandi
fixture e il controllo JUnit usa il vero helper Python. Nel solo fixture si
sostituisce la scoperta della cartella Windows ProgramFiles, assente su Linux.
I casi negativi coprono Node fallito, Gradle fallito, zero test, tutti saltati,
XML corrotto, Java fallito, hash errato e commit cambiato. Nessun caso negativo
deve produrre un APK nella cartella di distribuzione.

Questi test non sostituiscono PowerShell 5.1 su Windows, una compilazione nativa
con SDK reale o una prova su telefono. La PR resta draft fino a quei collaudi.
