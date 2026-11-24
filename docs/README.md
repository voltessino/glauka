# Documentazione Glauka

La cartella `docs/` contiene istruzioni correnti, progetti di architettura, verbali QA e documenti storici. **La data di un documento non garantisce che descriva il `main` attuale.** Per verificare il codice partire dalla revisione corrente del repository, non da un report di una vecchia release.

**Primo accesso?** [Inizia da qui](START_HERE.md). La [mappa delle funzioni](FEATURE_MAP.json) collega i problemi ai file sorgente e ai test.

## Navigazione consigliata

| Devo... | Parto da |
| --- | --- |
| **Sapere a che punto è Glauka e cosa fare dopo** | **[ROADMAP MASTER — priorità, stato, blocchi e PR](roadmap/GLAUKA_MASTER_ROADMAP.md)** |
| Capire rapidamente **quale file modificare** | [Mappa operativa del codice](CODE_NAVIGATION.md) |
| Conoscere struttura, moduli condivisi e staging | [Struttura del repository](REPOSITORY_LAYOUT.md) |
| Eseguire test o creare EXE/DMG/APK localmente | [Sviluppo e build](DEVELOPMENT.md) |
| Comprendere le differenze Windows / macOS / Android | [Parità tra piattaforme](PLATFORM_PARITY.md) |
| Leggere le regole sui rami Git e lo storico | [Workflow Git](GIT_WORKFLOW.md) · [Piano di manutenzione](REPOSITORY_MAINTENANCE_PLAN.md) · [Roadmap modularizzazione](maintenance/2026-10-31-modularization-roadmap.md) |
| Trovare le verifiche più recenti e i limiti dichiarati | [Indice QA](qa/README.md) |
| Capire le decisioni di architettura e i compromessi | [Proposte architetturali](architecture/) |
| Controllare le versioni e le modifiche documentate | [Changelog](CHANGELOG.md) · [`versions.json`](../versions.json) |
| Verificare l'edizione Free/Developer e le licenze | [Licenze](free-pro-licensing.md) |

## Attenzione allo storico

- `qa/` contiene numerosi rapporti datati ed evidenze: per orientarsi usare l'[indice QA](qa/README.md).
- `architecture/` raccoglie scelte e disegni: non tutti i documenti equivalgono a funzioni implementate.
- `history/` e `RELEASE_NOTES_*.md` sono archivi della loro epoca, non sostituiscono `versions.json`.
- `screenshots/` e `qa/evidence/` contengono evidenze da preservare; non eliminarle in una pulizia estetica.

**Regola:** ogni informazione essenziale allo sviluppo va collegata dalle pagine sopra. È meglio una navigazione affidabile che spostare centinaia di file e rompere riferimenti, test e cronologia.
