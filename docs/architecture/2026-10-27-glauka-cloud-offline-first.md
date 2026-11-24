# Glauka Cloud — Offline-First: architettura e stato dell'implementazione

**Data:** 27 ottobre 2026  
**Repository:** `voltessino/neuromap-android`  
**Branch di sviluppo:** `feat/cloud-sync-offline-first-20261027`  
**Stato:** **fondazioni integrate, accesso cloud non abilitato in produzione**. Questa distinzione è obbligatoria per la sicurezza dei documenti.

## Scopo e vincoli

Glauka rimane offline-first. I salvataggi standard sul dispositivo, l'importazione XMind/PDF, Undo e i backup non dipendono da account Google/Dropbox. La sincronizzazione è **opt-in** ed è disattivata di default. Nessun server Glauka proprietario, nessuna GitHub Actions, nessun token nei JSON delle mappe o nel web storage.

## Diagramma del flusso

```text
                   UI Glauka Windows/macOS/Android
                               |
                     serializzatore esistente
                               |
                   salvataggio locale confermato
                               |
                   GlaukaCloudCore.save(id, json)
                               |
                 +-------------+--------------+
                 |                            |
          disco privato                 coda persistente
          (Go AtomicFile /              indice JSON nativo
           Android AtomicFile)          hash, revision, dirty
                 |                            |
                 +------ acknowledgment ------+
                          "Solo locale"
                               |
                scheduler nativo (NON ANCORA CABLATO)
                               |
                    Cloud Core flush / pull
                               |
                   trasporto HTTP nativo
                  + Google         + Dropbox
                  | drive.file     | App Folder
                  | snapshot       | revision CAS
                  | append-only    | update by rev
                  +-----------------+
                               |
                  Synced / Conflict / Error
```

## Codice presente

| Area | File | Funzionalità |
|---|---|---|
| Stato e sincronizzazione | `packages/cloud-sync/core.js` | save locale durabile, index, recupero crash, upload non bloccante, dirty, retry con backoff, baseline remoto, pull, conflitti e copia separata |
| PKCE | `packages/cloud-sync/oauth-pkce.js` | generatore PKCE S256, state, URL Google/Dropbox, richiesta al broker nativo; non mantiene token |
| Google/Dropbox | `packages/cloud-sync/providers.js` | file metadata, cartella Glauka Drive, area `/Glauka` interna alla Dropbox App Folder, upload, revisione e controllo del contenuto remoto |
| Adattatori native storage | `packages/cloud-sync/native-store.js` | API uniforme disco Go/Android con errori propagati |
| Presentazione | `packages/cloud-sync/ui.js` | 7 stati localizzati IT/EN con accessibilità |
| Desktop | `apps/desktop-shared/src/cloud_storage.go`, `main.go`, `bridge.js` | file locali atomici e rotte isolate con autorizzazione sessione; nessun OAuth token |
| Android | `MainActivity.java` | archivio privato con `AtomicFile`, API JS local-only, whitelist corretta per le nuove risorse Android della PR #146 |
| Test | `packages/cloud-sync/tests/*.test.js` | mock network/concorrenza, PKCE, driver provider, contratti native |

**Limite di Android:** il bridge opzionale `GlaukaCloudLocal` accetta file cloud locali fino a 12 MiB. Un documento più grande non va mai falsamente marcato come salvato/sincronizzato. Lo stato locale e il cloud non sostituiscono il backup legacy: sono due percorsi distinti fino all'integrazione completa.

## Controlli di integrità

- ID locali strettamente convalidati, nessun percorso arbitrario.
- Prima il file JSON; poi l'indice duraturo. Dopo un crash tra le due operazioni, `initialize()` confronta le impronte dei file con l'indice e ricrea le operazioni mancanti.
- Chiave di conflitto = ID documento + revisione remota + hash/cronologia; **non solo timestamp**.
- Dropbox: richiesta di aggiornamento con `mode.update` e `rev`, conflitti HTTP 409 mai trattati come successo.
- Google Drive: niente patch distruttive senza compare-and-swap documentato; nuove versioni append-only con `appProperties`. Per gli upload oltre 5 MiB è richiesta una sessione resumable nativa (non ancora implementata): le operazioni falliscono in modo esplicito e non eliminano la copia locale.
- Il ciclo cloud verifica che la revisione locale non sia cambiata durante il caricamento; in caso contrario lascia la nuova modifica in coda.
- I conflitti non vengono risolti in modo silenzioso. `resolveKeepBoth()` crea prima una copia remota separata e non modifica l'altra revisione.
- Gli errori remoti esposti all'utente non includono credenziali o header sensibili.

## Configurazione OAuth richiesta per un rilascio

**Google**: progetto Google Cloud, OAuth consent screen, Drive API abilitata, client ID desktop (loopback su 127.0.0.1 autorizzato per installed apps), client ID Android con identity e callback Android verificata, scope `https://www.googleapis.com/auth/drive.file`. Non usare `drive` o `drive.readonly`. Alternativa per archiviazione nascosta: `drive.appdata` (ma non mostra `/Glauka` in My Drive).

**Dropbox**: app con access type `App Folder`, scope `files.content.read`, `files.content.write`, `files.metadata.read`, `files.metadata.write`, autorizzazione PKCE S256 con `token_access_type=offline`; client key pubblico, **mai client secret nell'APK/EXE**. La cartella `/Glauka` è relativa all'area dell'app Dropbox, non alla root generale dell'account.

**Token**: broker nativo da realizzare con Credential Manager/DPAPI Windows, Keychain macOS, Keystore Android; richiede gestione sicura di refresh/access token, logout/revoke, restrizione endpoint, binding `state` + URI callback e classificazione 401/403/429. Il coordinatore PKCE presente rifiuta connessioni quando il broker nativo non è configurato. Un refresh token **non deve mai** arrivare allo script WebView.

## Cancelli bloccanti prima di abilitare il cloud agli utenti

1. **Implementare e collaudare il broker nativo OAuth, lo storage segreti e un HTTP transport che non restituisca token a JS**, con client ID verificati e redirect corretti per piattaforma. Non lasciare il protocollo in JavaScript puro.
2. **Cablare il salvataggio esistente al nuovo core solo dopo consenso esplicito** e assicurare la persistenza dell'ID documento tra macchine. Gestire il ciclo di vita Android (background/offline/foreground) senza perdere i job.
3. **Confermare Google append-only in presenza di due dispositivi concorrenti**, inclusa selezione deterministica della cartella quando esistono cartelle duplicate; implementare query/riconciliazione di tutte le revisioni e upload resumable.
4. **Implementare scoperta e download** dei documenti remoti non ancora presenti sul dispositivo e la selezione manuale della copia in conflitto, non solo l'operazione «Mantieni entrambe».
5. **Integrare gli stati UI nel pannello Cloud**, verificare contrasto, navigazione da tastiera, annunci accessibili e localizzazione effettiva su Windows/macOS/Android.
6. **Eseguire davvero** compilazioni Go/Windows/macOS e Gradle APK, la suite `npm test` e collaudi API su sandbox Google/Dropbox. Non basta che la sorgente compili sintatticamente in V8.

Fino al superamento di questi cancelli, il sync rimane **disabilitato**; Glauka mantiene i propri salvataggi offline precedenti. Non inserire token fittizi o affidare al browser `localStorage` i refresh token.

## Test riproducibili senza GitHub Actions

```bash
npm test
node --test packages/cloud-sync/tests/*.test.js
# dopo configurazione SDK su ogni piattaforma
cd apps/desktop-shared/src && go test ./...
# Android: compilazione Gradle e test sul dispositivo, con network disconnect
```

### Verifiche realmente effettuate in questa sessione

- 13/13 test `core` completati in V8 isolato con file e provider simulati;
- 6/6 test `providers` completati in V8 isolato con trasporto simulato;
- 4/4 test `oauth-pkce` completati in V8 isolato con URL e digest di test;
- Nessuna autenticazione Google/Dropbox reale, nessuna chiamata di rete con token, nessun test Chromium/native APK, nessuna compilazione Gradle/Go completa in questa sessione.
- `npm test` include adesso la nuova directory di test; **non** va dichiarato superato finché non viene eseguito con il runner Node completo.
