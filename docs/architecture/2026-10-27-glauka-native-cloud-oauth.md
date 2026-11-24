# Glauka — OAuth nativo desktop e trasporto Cloud

**Data:** 27 ottobre 2026  
**Branch:** `feat/cloud-native-oauth-20261027`  
**Stato:** OAuth desktop e trasporto nativo implementati nel sorgente; **non ancora collaudati con account reali e non abilitano la sincronizzazione automatica**.

## Architettura implementata

- Windows/macOS: `apps/desktop-shared/src/cloud_oauth.go` apre il **browser di sistema**, genera `state` e PKCE S256 con CSPRNG e accetta una sola risposta OAuth sul server `127.0.0.1`. L'URL di callback resta valido per cinque minuti e il backend verifica lo stato con confronto in tempo costante.
- Windows: il file cifrato `cloud-sync/oauth-google.vault` o `oauth-dropbox.vault` usa l'esistente API DPAPI (account Windows). macOS: usa il gestore già presente che deriva la chiave da Keychain e cifra con AES-GCM. OAuth token **mai restituiti alla WebView**.
- Automatic token refresh: se la scadenza è vicina, il processo Go usa il refresh token cifrato e aggiorna il vault. La risposta OAuth/refresh del provider non viene mai inoltrata in chiaro al JavaScript.
- Native transport `cloud_transport.go`: HTTPS solo verso gli endpoint Drive/Dropbox esplicitamente autorizzati; niente redirect, header arbitrari, username/password in URL o operazioni in aree Dropbox diverse dalla cartella Glauka. Upload fino a 12 MiB; per upload Google più grandi resta necessario il protocollo resumable.
- `bridge.js`: aggiunge `neuromapDesktop.cloudAuth.status/start/disconnect` e `cloudTransport.send`. Solo il Go backend inserisce Bearer.
- `cloud_panel.js` e `cloud_panel.css`: pannello **File → Cloud e sincronizzazione** con stato account, avvio OAuth Google/Dropbox e disconnessione. Distingue esplicitamente **account collegato ≠ mappe sincronizzate**; nessun upload automatico finché i gate sotto non saranno completati.
- La disconnessione tenta anche la revoca online delle autorizzazioni Google/Dropbox. Se fallisce, elimina comunque la copia locale delle credenziali e avvisa che la revoca sul provider **non è stata confermata**.
- Google usa lo scope `https://www.googleapis.com/auth/drive.file`; Dropbox richiede app configurata in modalità App Folder con i permessi minimi richiesti dall'adattatore.
- Android rimane in modalità cloud **solo archivio locale protetto**. Mancano ancora il broker OAuth Android con Keystore, callback/App Link verificato e background scheduling.

## Configurazione delle app OAuth necessaria prima del test reale

**Google Cloud Console**
1. Crea un progetto dedicato Glauka, abilita Drive API e configura OAuth consent screen.
2. Crea un OAuth Client ID di tipo **Desktop** con loopback locale.
3. Prima di avviare il programma, configura la variabile `GLAUKA_GOOGLE_CLIENT_ID` con il client ID pubblico. Non inserire client secret nel repository.

**Dropbox App Console**
1. Crea una Scoped App con accesso **App Folder** e scope `files.content.read`, `files.content.write`, `files.metadata.read`, `files.metadata.write`.
2. Attiva OAuth PKCE con token di accesso offline e registra **esattamente** il callback `http://127.0.0.1:43117/__desktop/cloud/oauth/callback` nel provider, se accettato dalla console dell'app configurata. Il redirect Dropbox esatto è vincolante; su build Developer la porta prevista è `43118`, mentre un'istanza con porta alternativa richiede nuova registrazione.
3. Configura `GLAUKA_DROPBOX_APP_KEY` con la chiave pubblica e `GLAUKA_DROPBOX_REDIRECT_URI` con lo stesso URL registrato.
4. Non distribuire client secret né token di prova.

Esempio PowerShell **solo per l'ambiente di collaudo**:

```powershell
$env:GLAUKA_GOOGLE_CLIENT_ID = "INSERISCI-CLIENT-ID-PUBBLICO"
$env:GLAUKA_DROPBOX_APP_KEY = "INSERISCI-APP-KEY-PUBBLICA"
$env:GLAUKA_DROPBOX_REDIRECT_URI = "http://127.0.0.1:43117/__desktop/cloud/oauth/callback"
# Avvia Glauka dallo stesso terminale
```

**Nota:** i valori di esempio non funzionano; sono necessari veri client ID autorizzati. Non è stata effettuata alcuna autorizzazione reale in questa sessione.

## Sicurezza e limiti ancora aperti

- Il token vault impiega implementazioni native già presenti, ma non è stato ancora validato sulle versioni Windows/macOS compilate da questo branch. Gli errori di cifratura bloccano l'attivazione e non fanno fallback su `localStorage`.
- L'aggiornamento dei token si basa su `expires_in` e mantiene il vecchio refresh token se il provider non ne restituisce uno nuovo.
- L'API nativa cloud richiede sempre la sessione autenticata del desktop, come gli altri servizi privati. La callback OAuth è un'eccezione **esclusivamente GET** al filtro sulle navigazioni cross-site, ma richiede il segreto `state` monouso.
- Lato cloud, i moduli `packages/cloud-sync/core.js` e `providers.js` non sono ancora integrati automaticamente nel pulsante Salva. Questo preserva i salvataggi locali finché non sono stati provati migrazione dell'ID documento, discovery dei file remoti, risoluzione conflitti e assenza di perdita dati.
- Per Android devono essere implementati Android Keystore, Activity result e App Link verificato; non usare URL OAuth o token nel web storage.
- Per il rilascio servono collaudi OAuth completi Google/Dropbox, `go test ./...`, build EXE/DMG, suite standard e test offline/concorrenza. Nessuna GitHub Actions.

## Test presenti

`apps/desktop-shared/src/cloud_oauth_test.go`: verifica URL e header autorizzati, callback false, client ID e parsing/redazione delle risposte OAuth simulate con un RoundTripper locale.

`packages/cloud-sync/tests/desktop-broker-contract.test.js`: verifica che il bridge non esponga token, che il pannello dichiari la sincronizzazione ancora inattiva e che i file nativi registrino le protezioni previste.

```bash
npm test
cd apps/desktop-shared/src
go test ./...
```

**Prove eseguite qui:** sintassi JavaScript validata, quattro controlli statici del contratto native eseguiti con adattatore V8, struttura lessicale Go verificata. **Non** è stato eseguito `go test` sul repository completo, né un login/salvataggio di file reale sui provider. Nessun workflow GitHub Actions avviato.
