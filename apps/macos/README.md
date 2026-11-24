# Glauka per macOS

Versione attuale: **1.0.4** (Release). I metadati nativi in `native/Info.plist` e in [`versions.json`](../../versions.json) sono allineati: `CFBundleShortVersionString` = `1.0.4`, `CFBundleVersion` = `100049000`, macOS 12.0 o successivo.

Sorgenti del launcher nativo Swift/WebKit in `native/`; backend Go ed editor condivisi con Windows in `../desktop-shared/`.

Il pacchetto `.dmg` non è un file già pronto in questo repository. Si compila su un computer Mac con `scripts/release/build_desktop.py macos`.

Il main contiene il nuovo modello Free / Pro: tutti gli strumenti locali sono
Free, tutte le funzioni AI richiedono una licenza firmata e il provider personale.
La build privata accetta anche la licenza del proprietario e può simulare i due
piani. Il precedente codice di prova non attiva più Pro.

Non è ancora disponibile un DMG completo compilato da questi sorgenti aggiornati.
I vecchi archivi Mac non contengono le nuove licenze. Compilare il launcher Swift
sul Mac; non riutilizzare il vecchio eseguibile. Il builder locale è
`scripts/release/build_desktop.py macos OUTPUT --go GO`.
La distribuzione pubblica richiede Developer ID e notarizzazione; `--developer`
produce soltanto un pacchetto privato di prova. I backend Go cross-compilati da Linux
non costituiscono un'app Mac installabile.

Vedere [licenze e preparazione pubblicazione](../../docs/free-pro-licensing.md) e
[sviluppo](../../docs/DEVELOPMENT.md). La vecchia base compressa è stata ritirata dal checkout corrente e resta recuperabile dal [registro Git](../../docs/maintenance/legacy-source-archives.json).
