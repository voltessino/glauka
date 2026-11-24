# Glauka Android — audit prepubblicazione, intervento 1 (2026-11-02)

**Branch:** `audit/android-prepublication-hardening-20261102`  
**Base:** `main@9c31b5a24c006ef38ad645ad28599ca532f1fc1c`  
**Stato:** modifiche di sola hardening sul branch; **non mergiare nel main senza revisione e test completi**.

Per la review operativa usare **[ANDROID_AUDIT_HANDOFF.md](ANDROID_AUDIT_HANDOFF.md)**. Il runner `scripts/qa/run_android_security_gate.py` include i test rapidi, le suite Python e, con `--full`, le verifiche Node/Gradle. L'output rimane esterno al checkout.

## Interventi applicati

1. **Backup Android 12+** — `AndroidManifest.xml` ora imposta `android:dataExtractionRules="@xml/data_extraction_rules"`. Le regole escludono file, database, preferenze, storage device-protected ed external app data sia da backup cloud sia da trasferimenti dispositivo-dispositivo. Restano `android:allowBackup="false"` e `android:fullBackupContent="false"` per le versioni precedenti. I file salvati dall'utente attraverso Android Storage Access Framework NON vengono toccati.
2. **Recovery JavaScript bridge** — `MainActivity.RecoveryBridge` valida gli ID per `read`, `write` e `discard` prima della coda I/O, e rifiuta `write` null/oltre il limite di 32 MiB prima di accodare il lavoro. È difesa in profondità, non sostituisce una politica CSP sicura.
3. **Gate APK pubblico** — `scripts/release/verify_android_public.py` è un controllo *fail-closed* di un APK release già firmato, utilizzabile solo quando sarà disponibile il certificato di produzione e una versione stabile. Confronta certificato SHA-256 (inclusa esclusione della firma debug/preview), v2 signature, application ID, versione, non-debuggable, allowBackup=false, cleartext=false e presenza di data extraction rules nel manifest compilato. **Non crea né pubblica APK.** Non modifica gli attuali script di preview.
4. **WebView CSP / debug** — l'HTML Android limita gli script all'origine pacchettizzata, le connessioni di rete ai due host approvati, i worker a `self`/`blob:` e i frame a `none`. Per compatibilità, gli script inline e l'eval restano consentiti: **non equivale a eliminare XSS**. In una build release la WebView disabilita esplicitamente il debug remoto. Questa modifica richiede un collaudo UI di editor, OCR e PDF.
5. **Licenze Pro** — `scripts/licensing/issue.py` rifiuta ora directory di emissione chiavi e file di licenza dentro il checkout, anche se il path contiene `..` o symlink risolti. `.gitignore` esclude file `*.pem` e `*.key`, senza rimuovere file già tracciati; il rischio residuo su cronologia Git resta da auditare.
6. **Test** — `packages/editor-ui/tests/android-prepublication-security.test.js` verifica il contratto XML e bridge; `scripts/release/test_verify_android_public.py` verifica i principali casi di rifiuto del gate pubblico.

## Test da eseguire prima del merge (in locale, SENZA GitHub Actions)

```powershell
# Dalla root del repository, sul branch audit
node --test packages/editor-ui/tests/android-prepublication-security.test.js
python -m unittest discover -s scripts/release -p "test_verify_android_public.py" -v
python -m unittest discover -s scripts/licensing -p "test_issue_paths.py" -v
npm test
python scripts/release/prepare.py android ..\Glauka-Android-Security-Stage

# Nella directory Android preparata (JDK 17, Gradle 8.9, Android SDK API 35)
gradle --no-daemon :app:testDebugUnitTest :app:assembleDebug
```

Verificare successivamente il **manifest compilato** (aapt dump xmltree), il trasferimento D2D effettivo su almeno un Android 12+ e un Android 15+, le prove import/export, recupero crash e revisione regressioni su dati utente. Non eliminare l'app di preview dai dispositivi senza prima esportare e verificare i progetti.

### Gate per il futuro APK pubblico

Solo **dopo** aver configurato una vera firma di produzione, un versionName stabile (attualmente è `0.6.19-rc.1-private`, quindi viene giustamente rifiutato) e prodotto un APK release:

```powershell
$env:GLAUKA_PUBLIC_ANDROID_CERT_SHA256 = "<SHA-256 del CERTIFICATO PUBBLICO di firma, non la chiave privata>"
python scripts/release/verify_android_public.py --apk "<app-release.apk>" --apksigner "<percorso/apksigner>" --aapt "<percorso/aapt>" --application-id "it.neuromap.architect.preview" --report "<cartella-esterna>/android-public-verification.json"
```

Il gate **non sostituisce** firma APK/AAB, revisione privacy, test su dispositivi fisici, test cloud reali, scansione dipendenze o un pentest.

## Rischi non risolti, intenzionalmente fuori da questa prima patch

- **Cloud Android:** `GlaukaCloudAndroidPkce`, `GlaukaCloudAndroidTokenBroker` e `GlaukaCloudSecureVault` sono componenti preparatori: il manifest non dichiara App Links verificati, il broker non è istanziato in `MainActivity`, OneDrive non è incluso nei provider Android. Non pubblicizzare cloud Android finché non sono completati client ID, `assetlinks.json`, login esterno, scambio token, trasporto e verifiche reali.
- **WebView:** rimangono bridge `addJavascriptInterface`, `unsafe-inline` e `unsafe-eval` per compatibilità. Verificare la CSP rafforzata con browser/E2E, OCR, PDF.js e import di documenti SVG/HTML non fidati; in futuro migrare verso un bridge controllato per origine e nonce CSP.
- **Dati locali:** documenti, autosave e temporanei non hanno cifratura applicativa; i vault delle credenziali usano invece Android Keystore/AES-GCM.
- **Free/Pro:** il check ECDSA nativo è già presente; un APK offline ripacchettato può sempre modificare codice locale, quindi servono distribuzione autenticata e progettazione delle licenze, non la sola offuscazione.
- **Segreti / dipendenze:** completare una scansione della cronologia Git e degli artifact prima della pubblicazione.

## Ulteriori patch sullo stesso branch

- `AndroidRecoverySessionPolicy.java` e test JVM: impediscono letture, scritture e cancellazioni della recovery da callback appartenenti al renderer WebView precedente, sia all'ingresso sia prima del lavoro in coda. Uso di campi `volatile` per la visibilità tra thread.
- `scripts/qa/run_android_security_gate.py` + test: suite rapide e modalità `--full` e `--device-tests`, con log separati e `report.json` fuori da Git.
- `docs/security/ANDROID_AUDIT_HANDOFF.md` e `docs/CODE_NAVIGATION.md`: indice per revisione Codex file-per-file e criteri di merge.

- Protezione illustrazioni SVG importate nel modulo condiviso, applicata anche all'esportazione SVG Android/desktop; visita iterativa, blocco entity/DTD e tetto di 3000 elementi. Sorgenti: `packages/editor-ui/editor-shared/media-icon-core.js`, `apps/android/editor/io.js`, `apps/desktop-shared/editor/io.js`.
- Test di contratto `illustration-svg-import-security.test.js` e test di Chromium `illustration-svg-security.spec.js` tramite `playwright.security.config.js`, previsto dal gate `--full`.

## Stato verifiche

Lettura e revisione statica via connettore GitHub. Otto contratti JavaScript eseguiti con sorgenti GitHub e moduli filesystem simulati (8/8 superati); NON è stata eseguita una vera suite Node o browser. Il checkout privato non è montato nell'ambiente locale di questo audit; **non dichiarare come superati npm, Gradle, unittest Python, installazione APK, account OAuth o pen-test** fino all'esecuzione effettiva.

## Regola operativa

Nessun intervento su `main`, nessun merge automatico, nessuna GitHub Actions, nessuna modifica dell'identificativo applicativo, delle chiavi di licenza o della firma delle preview esistenti.
