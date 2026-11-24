# Glauka Android — handoff operativo per Codex

**Branch:** `audit/android-prepublication-hardening-20261102`  
**Base originale di main:** `9c31b5a24c006ef38ad645ad28599ca532f1fc1c`  
**Ambito:** sicurezza Android e strumento condiviso per l'emissione delle licenze.  
**Regola:** non fare merge e non pubblicare APK senza approvazione del proprietario. Non avviare GitHub Actions.

## 1. Come orientarsi, senza aprire tutto il monorepo

La lista qui sotto descrive i **file realmente modificati**, non tutti i file storici. **Mantenere questo unico branch di audit**: ogni nuovo intervento va in un commit tematico, non in un nuovo branch. Visualizzare il diff con:

```bash
git fetch origin
git switch audit/android-prepublication-hardening-20261102
git diff --stat 9c31b5a24c006ef38ad645ad28599ca532f1fc1c...HEAD
git log --oneline --reverse 9c31b5a24c006ef38ad645ad28599ca532f1fc1c..HEAD
```

| Blocco / ordine di review | Codice modificato | Protezione | Verifica |
| --- | --- | --- | --- |
| 1 — Integrità dei dati | `MainActivity.java`, `AndroidRecoverySessionPolicy.java` | Richieste recovery legate alla sessione WebView viva; ID e payload verificati prima di accodare I/O | `AndroidRecoverySessionPolicyTest.java`, `android-prepublication-security.test.js` |
| 2 — Backup Android 12+ | `AndroidManifest.xml`, `res/xml/data_extraction_rules.xml` | Esclusione di backup cloud e trasferimento D2D di file, database, preferenze e cache | `android-prepublication-security.test.js`, prova D2D reale |
| 3 — WebView | `MainActivity.java`, `assets/app/index.html` | Remote debugging spento in release, CSP limitata a origini e tipi di risorse | Test source + Playwright/WebView con OCR, PDF e illustrazioni |
| 4 — Release | `scripts/release/verify_android_public.py` | Rifiuto di APK con firma preview, debug, versione privata o manifest insicuro | `test_verify_android_public.py`, un APK pubblico reale |
| 5 — Emissione Pro | `scripts/licensing/issue.py`, `.gitignore` | Blocca scrittura di private key/grant dentro il checkout | `test_issue_paths.py` |
| 6 — Collaudo | `scripts/qa/run_android_security_gate.py` | Sequenza ripetibile di prove con log e report esterni al repository | `test_run_android_security_gate.py` |

La storia contiene piccoli commit progressivi nel blocco 1 del precedente audit. Per una review Codex è più semplice valutare **per blocco e per diff di file** che per commit isolato. I nuovi interventi mantengono commit tematici.

### Blocco 7 — SVG importati (Android + desktop)
- `packages/editor-ui/editor-shared/media-icon-core.js`: `nm54IconUri` riapplica la sanitizzazione SVG a illustrazioni importate, con cache che si invalida quando cambia la stringa SVG; i file originali del progetto non vengono sovrascritti.
- `apps/android/editor/io.js`, `apps/desktop-shared/editor/io.js`: esportazione SVG attraverso `nm54IconUri` (mai attraverso SVG importati non filtrati).
- La sanificazione rifiuta DOCTYPE/ENTITY e oltre 3000 elementi SVG; la visita è iterativa per non esaurire lo stack.
- Test specifico: `packages/editor-ui/tests/illustration-svg-import-security.test.js` (contratto) e `tests/browser/illustration-svg-security.spec.js` (DOMParser reale). Confermare graficamente PNG/SVG, Iconify legittimi, documenti creati nelle versioni precedenti e il caso di SVG ostile.

**Test Chromium isolato, senza avviare i tre server dell'editor:** `npx playwright test --config playwright.security.config.js`. È incluso anche nel runner `--full`. Non dichiararlo eseguito finché non è stato lanciato su un checkout completo.

## 2. Un comando per raccogliere le prove

Dalla radice del repository (nessun download APK, nessuna GitHub Actions):

```bash
# Prove rapide mirate: Node e tre suite Python
python scripts/qa/run_android_security_gate.py

# Completo: aggiunge struttura, npm test, prepare Android, JUnit/Gradle, APK DEBUG
python scripts/qa/run_android_security_gate.py --full

# Soltanto se è già collegato un emulatore o telefono Android
python scripts/qa/run_android_security_gate.py --full --device-tests
```

Ogni esecuzione genera fuori da Git una directory temporanea con `report.json` e singoli `.log`. Per scegliere dove salvarla, aggiungere `--output <directory-vuota-esterna>`. I report non dichiarano mai una release pubblicabile: persino `--full` assembla un **APK debug privato**, non un APK release.

## Controllo della cronologia Git (senza esporre i segreti)

`scripts/qa/scan_git_secrets.py` legge la cronologia locale completa (tutti i ref) e segnala solo percorso, commit e categoria. Non stampa mai token o chiavi private; oscura anche eventuali token presenti nei nomi dei file. I risultati sono **indicatori da verificare**, non prove automatiche di compromissione. I file non committati e il contenuto dei binari non vengono esaminati. Il runner rapido esegue il test del parser, ma **non** la scansione effettiva della cronologia (che va avviata separatamente).

```bash
python -m unittest discover -s scripts/qa -p "test_scan_git_secrets.py" -v
python scripts/qa/scan_git_secrets.py --report ../glauka-security-history-report.json
```

Il report deve rimanere **fuori dal repository**. Non caricarlo automaticamente nella PR; esaminare prima i riscontri e, se necessario, revocare/ruotare le credenziali rilevate. Nessuna scansione storica è stata eseguita da questa sessione.

## 3. Criteri prima di proporre il merge

- **Java/Android:** `testDebugUnitTest`, `assembleDebug` e test su dispositivo reali senza regressioni. Confermare che vecchie callback recovery non cancellino i checkpoint del renderer nuovo.
- **Persistenza:** recuperare mappe esistenti, molte schede, immagini, salvataggi SAF; verificare prima/dopo crash/rotazione, annullamento e scelta di salvataggio.
- **WebView:** aprire editor, OCR, PDF.js, Iconify, traduzione, AI Pro su ambiente di prova. La CSP mantiene `unsafe-inline` e `unsafe-eval` per compatibilità: non dichiararla immune da XSS.
- **Backup:** verificare manifest fuso e migrazione D2D su Android 12+/15+, e il backup manuale dal picker (che non viene disabilitato).
- **Licenze:** firma ECDSA e accesso Free/Pro restano invariati; confermare con i test di licenza nativi; non committare file PEM.
- **Release:** nessuna chiave di firma debug va riutilizzata per l'APK pubblico; quando il proprietario crea una versione stabile, eseguire il verificatore `verify_android_public.py` e testare il pacchetto firmato.
- **Cloud:** modulo Android Google/Dropbox ancora non cablato end-to-end, OneDrive Android ancora incompleto. Non attivare login fittizi e non inserire secrets o token in JavaScript.

## 4. Verifiche già eseguite e limiti

- **8/8 contratti statici superati** eseguendo le asserzioni JavaScript dei due file di test sui sorgenti effettivamente letti dal branch GitHub, con `fs`/`path` simulati in V8. Sono test *di codice sorgente*, non equivalgono a `node --test` nel checkout o a prove WebView.
- **Verificata la sintassi JavaScript** dei file modificati e del nuovo test Playwright tramite parser JavaScript; non prova che il test browser passi.
- **Non verificati:** compilazione Java/JUnit/Gradle, test Node completi, esecuzione Playwright, test OAuth con account reali, backup Android 12+, APK e installazione su dispositivo. Nessuna prova Java compilata deve essere considerata superata senza log reale.

## 5. Rischi da verificare senza modificare i documenti degli utenti

- Il nuovo filtro SVG è applicato al rendering e all'export delle illustrazioni importate, ma lo stato originale può mantenere SVG preesistenti non sicuri per preservare i dati. Verificare round-trip dei progetti, immagini e altre vie d'export. Non è stata dimostrata esecuzione di script.
- L'apertura di collegamenti di progetto tramite `MainActivity.AndroidExport.openExternalURL` ammette anche HTTP nel browser esterno. Definire se richiedere conferma, mantenendo compatibilità con i progetti che contengono link non HTTPS.

## 6. Cosa NON è stato verificato qui

Queste patch sono state controllate via diff e controlli statici sul connettore GitHub. Non sono stati avviati `npm test`, Gradle/Javac, browser end-to-end, test con dispositivi o login cloud reali da questa sessione. Il runner è predisposto per Codex/checkout locale e dovrà essere eseguito per produrre prove effettive.

## 7. Ordine suggerito per l'integrazione

1. Revisionare e testare i blocchi dati/recovery e backup, incluso l'aggiornamento senza perdita di dati.
2. Verificare il comportamento WebView/CSP su dispositivo; se si rompe OCR/PDF, correggere il vincolo specifico prima di qualunque merge.
3. Verificare release gate e protezione chiavi di licenza.
4. Eseguire il gate completo, poi consegnare un riepilogo `PASS/FAIL` con `report.json`, file cambiati e regressioni.
5. Solo successivamente, in un lavoro distinto, collegare OAuth Android reale e OneDrive, senza inventare App Link/client ID.
