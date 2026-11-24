# Script di Glauka: dove trovare ogni comando

Se non hai familiarità col codice, inizia dalla [guida semplice](../docs/START_HERE.md). Il comando di sola lettura per trovare un sorgente è:

    node scripts/maintenance/where-to-edit.cjs --list
    node scripts/maintenance/where-to-edit.cjs apk

Per capire quanto pesa davvero il `main` senza cancellare nulla: `python scripts/maintenance/repository_footprint.py` (opzione `--json` per il rapporto macchina). Vedere l'[inventario di pulizia](../docs/maintenance/2026-10-31-repository-cleanup-inventory.md).

| Cartella | Scopo |
| --- | --- |
| [maintenance/](maintenance/) | Controlli sulla struttura, navigazione del codice e manutenzione Git |
| [release/](release/) | Preparazione EXE, DMG, APK, staging e test di packaging |
| [qa/](qa/) | Audit e strumenti di verifica |
| [dev/](dev/) | Strumenti locali per sviluppo e anteprima |
| [licensing/](licensing/) | Strumenti collegati alle licenze |

Per controllare la recuperabilità dei sette vecchi archivi dalla cronologia Git, eseguire `python scripts/release/audit_legacy_assets.py` su un checkout pulito e completo. Gli SHA originali sono nel [registro di recupero](../docs/maintenance/legacy-source-archives.json).

**Controllo QA di sola lettura:** `node scripts/maintenance/qa-evidence-audit.cjs --check` verifica i collegamenti alle evidenze di collaudo; `--json` elenca le immagini potenzialmente senza riferimenti. Un'immagine non citata è soltanto un candidato alla revisione, non una richiesta di cancellazione.

**Protezione prima di eliminare branch:** il comando `prune_merged_branches.py` è un dry-run. Per `--apply` servono anche `--approved-file` (JSON con coppie `branch`/`sha` approvate individualmente) e la conferma esplicita. Non basta che un ramo risulti integrato.

**Prima di avviare uno script:** leggere la relativa documentazione o il parametro --help quando disponibile. Alcuni script di release creano file o richiedono dipendenze esterne; il navigatore where-to-edit è invece di sola lettura. Non avviare GitHub Actions.

Le versioni provengono da [versions.json](../versions.json), i sorgenti dagli editor [desktop](../apps/desktop-shared/editor/sources.json) e [Android](../apps/android/editor/sources.json). Per i test di struttura: `npm run test:structure` dalla root.
