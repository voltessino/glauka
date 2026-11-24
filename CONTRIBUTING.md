# Contribuire a Glauka

1. Partire da `main` e usare un ramo con uno scopo chiaro.
2. Localizzare i sorgenti canonici con la [mappa del codice](docs/CODE_NAVIGATION.md) e seguire [`AGENTS.md`](AGENTS.md). Modificare i sorgenti leggibili indicati nella [struttura](docs/REPOSITORY_LAYOUT.md). Non modificare i blob legacy o le copie temporanee di build.
3. Per una funzione comune valutare Windows, Mac e Android. Aggiornare la [matrice](docs/PLATFORM_PARITY.md), indicando eventuali differenze.
4. Eseguire i test pertinenti e le build coinvolte. Per layout, importazioni e persistenza usare regressioni funzionali, non solo controlli di sintassi.
5. Aggiornare `versions.json` e i metadati delle app quando si cambia versione. Aprire una PR descrivendo comportamento, validazione e limiti.

Tenere l'edizione Android Free separata dall'attivazione Developer. Non inserire segreti, chiavi di firma, profili utente o output di compilazione. Gli archivi originali restano privati; la loro presenza non autorizza una distribuzione pubblica.

## Rami e manutenzione

Le modifiche partono da `main`, via PR verso `main`. Dopo il merge, conservare soltanto i rami ancora utili; quelli con commit successivi al merge richiedono controllo manuale. Non integrare nuovamente rami storici soltanto perché compare «Compare & pull request». Vedere [politica Git](docs/GIT_WORKFLOW.md) e [inventario](docs/BRANCH_INVENTORY_2026-10-21.md). I workflow rimangono manuali, **non avviare GitHub Actions**. Per test e build usare i comandi locali descritti in [sviluppo](docs/DEVELOPMENT.md).
