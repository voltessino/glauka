# Glauka — ricognizione dei branch (campione verificato)

**Data:** 31 ottobre 2026. **Repository:** `voltessino/neuromap-android`. **Base di confronto:** `main` a `81ceb5aa1695b600904cb23f6c671cfbc0ed76fb`.

Sono presenti **312 branch** (compreso `main`), rilevati tramite le quattro pagine dell'API GitHub, e **19 pull request aperte**. Questo documento verifica un **campione non esaustivo di 44 branch** attraverso il confronto di GitHub fra `main` e ciascun ramo.

| Esito del campione | Branch | Significato |
| --- | ---: | --- |
| `ahead_by = 0` | **22** | Commit del ramo già raggiungibili da `main` al momento del controllo |
| `ahead_by > 0` | **22** | Commit esclusivi sul ramo: **non eliminare, non fondere indiscriminatamente** |
| Ancora da confrontare | **267** | Include i rami di distribuzione `download/`/`downloads/` e gli altri non campionati |

L'inventario totale comprende 312 branch: 1 `main` + 44 campionati + 267 non confrontati. Non si tratta di una dichiarazione che tutti gli altri 267 siano obsoleti. L'assenza di commit esclusivi **non equivale a consenso per la cancellazione**, soprattutto per backup, release, distribuzione, PR aperte e riferimenti storici.

## Branch senza commit esclusivi (22)

La colonna `behind` misura quanto il ramo è indietro rispetto al `main` osservato.

| Branch | Ahead | Behind |
| --- | ---: | ---: |
| `audit/ai-flatten-integration-20261023` | 0 | 1467 |
| `audit/ai-flatten-iterative-20261023-07` | 0 | 1481 |
| `audit/atlas-snapshot-regression-20261023-06` | 0 | 1481 |
| `audit/atlas-stale-snapshot-20261023` | 0 | 1479 |
| `audit/glauka-cloud-concurrent-save-order-20261028` | 0 | 622 |
| `backup/main-pre-cloud-sync-20261027` | 0 | 854 |
| `backup/main-pre-glauka-20261027` | 0 | 893 |
| `fix/android-consistent-surfaces-20261027` | 0 | 696 |
| `fix/android-contextual-format-and-ai-20261028` | 0 | 490 |
| `fix/android-native-persistence-and-back-20261031` | 0 | 169 |
| `fix/android-phone-shell-20261027` | 0 | 822 |
| `feat/adaptive-clockwise-ui-themes-20261022` | 0 | 1687 |
| `feat/adaptive-learning-6191-20261022` | 0 | 1482 |
| `feat/ai-change-review-618-20261022` | 0 | 1553 |
| `feat/anatomical-vector-gallery-20261028` | 0 | 561 |
| `feat/android-06-release-hardening-20261027` | 0 | 639 |
| `feature/android-next-platform-layout` | 0 | 1894 |
| `integration/glauka-release-20261027` | 0 | 698 |
| `quality/v7-local-release-gate` | 0 | 1349 |
| `polish/glauka-icon-padding-20261030` | 0 | 314 |
| `safety/main-6.16.0-20261022-15c2dcd` | 0 | 1763 |
| `safety/main-before-adaptive-skins-20261022` | 0 | 1717 |

**Azione proposta:** verificare presenza di PR, tag, download e riferimenti esterni; soltanto dopo preparare eventuali candidati a pulizia. Nessuna eliminazione è stata eseguita.

## Branch divergenti da conservare per revisione (22)

| Branch | Commit esclusivi | Behind |
| --- | ---: | ---: |
| `audit/glauka-full-java-go-native-hardening` | 18 | 633 |
| `audit/glauka-full-release-native-and-tests-20261028` | 17 | 631 |
| `fix/adapt-corrective-backlog` | 2 | 1862 |
| `fix/ai-navigation-floating-help` | 3 | 1849 |
| `fix/android-074-windows-local-qa-20261023` | 3 | 1252 |
| `feat/ai-change-review-selective-20261022` | 32 | 1763 |
| `feature/branch-formatting-markers` | 4 | 1851 |
| `integration/nightly-v77-v83-crossplatform-20261024` | 3 | 1246 |
| `qa/ai-adversarial` | 2 | 1866 |
| `qa/critical-data-integrity` | 2 | 1870 |
| `perf/pdfjs-lean-offline-20261023` | 13 | 1247 |
| `perf/v78-bounded-canvas-backing-20261024` | 7 | 1246 |
| `refactor/editor-components` | 1 | 1855 |
| `refactor/editor-organization` | 2 | 1854 |
| `research/super-ocr-italiano-20261024` | 22 | 1246 |
| `review/latest-desktop-android-20261022` | 7 | 1767 |
| `ui/android-compact-touch-rail-20261022` | 1 | 1767 |
| `ui/android-orbit-futuristic-20261022` | 3 | 1767 |
| `ux/android-command-finder-20261022` | 1 | 1767 |
| `ux/central-settings-scope` | 3 | 1840 |
| `macos-private-preview` | 2 | 1935 |
| `feat/desktop-spacing-images-links` | 37 | 1856 |

**Azione proposta:** determinare se i commit esclusivi rappresentano funzioni ancora mancanti, correzioni superate, prove non integrate o codice deliberatamente isolato. Le differenze rispetto a `main` possono comprendere cambiamenti incompatibili; non si eseguono merge solo sulla base del numero di commit.

## Procedura sicura per una pulizia successiva

1. Aggiornare `main` e rieseguire il confronto: i conteggi mutano con nuovi commit. Non applicare questa fotografia automaticamente.
2. Usare la procedura esistente [`scripts/maintenance/prune_merged_branches.py`](../../scripts/maintenance/prune_merged_branches.py) **in sola modalità dry-run** da un checkout autenticato. Non invocare `--apply` senza revisioni puntuali.
3. Escludere esplicitamente `main`, `downloads/`, `download/`, `backup/`, `archive/`, `release/` e i rami citati dalle PR aperte, finché non è chiaro il ruolo di ciascuno. Alcune PR indicano **DO NOT MERGE**.
4. Conservare una lista dei branch approvati singolarmente dal proprietario, con SHA verificato prima di qualsiasi cancellazione.
5. Non avviare GitHub Actions. Nessuna PR è stata chiusa e nessun branch è stato eliminato in questa sessione.

Per la strategia completa vedere [il piano di manutenzione](../REPOSITORY_MAINTENANCE_PLAN.md) e [le regole Git](../GIT_WORKFLOW.md).

## Triage locale con rapporto JSON

Eseguire `python scripts/maintenance/prune_merged_branches.py --json-report ../glauka-branch-review.json` con un token custodito localmente. Il dry-run predefinito non modifica branch o PR. La nuova protezione include `download/` e `backup/`, tutte le PR aperte e **qualsiasi branch con commit esclusivi**. Non usare `--apply` prima di una revisione nominativa e autorizzazione esplicita.
