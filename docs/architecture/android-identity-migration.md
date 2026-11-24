# Identità Android Glauka: migrazione dati prima del cambio package

**Nome pubblico definitivo:** **Glauka**.

**Namespace/Application ID attuali** `it.neuromap.architect.preview` sono mantenuti intenzionalmente per l'APK 0.6.0-rc.1. Modificarli adesso significherebbe installare una seconda applicazione isolata e rendere inaccessibile dalla nuova app la cache WebView, le mappe locali e le credenziali Keystore della vecchia installazione.

## Piano per il futuro Application ID

1. Scegliere e registrare il nuovo package definitivo (nome previsto `it.glauka.app` se disponibile e approvato); verificare certificato di firma, package non conflittuale e policy di distribuzione.
2. Nell'installazione precedente richiedere **esportazione esplicita di tutte le mappe e delle impostazioni senza segreti** tramite Android Storage Access Framework. Non esportare refresh token, API key o vault Keystore.
3. Verificare che il file esportato si riapra nell'app vecchia prima di procedere.
4. Preparare una **nuova applicazione** con package nuovo e importazione guidata delle mappe nell'archivio locale, con verifica dell'hash e conteggio delle schede. Non tentare accessi cross-package ai dati privati.
5. Richiedere di riconnettere manualmente Google/Dropbox e reinserire le chiavi AI nella nuova installazione; il vault è legato al package e al dispositivo.
6. Solo dopo collaudi di migrazione, aggiornare insieme namespace, applicationId, directory Java, manifest, intent e test, con copia di riserva. Eventuali link della vecchia app andranno aggiornati.

**Repository GitHub:** `voltessino/neuromap-android` resta il percorso attuale. Rinominarlo richiede permessi amministrativi del proprietario e un controllo dei riferimenti hardcoded, dei collegamenti ai download e degli script build. Non simulare la rinomina cambiando soltanto README/URL.

**Release gate:** non dichiarare stabile una release minificata o firmata senza `bundleRelease`, test su WebView/Android reali e restore verificato.
