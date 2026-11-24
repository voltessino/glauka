# Design: estrazione selection/clipboard da app.js

**Branch:** `stabilization/selection-clipboard-extract-20261105`  
**Base:** `origin/main` @ `18071e0f`  
**Obiettivo:** migliorare navigabilità del codice su main con un’estrazione conservativa byte-identica; nessuna modifica funzionale.

## Scope

1. Aggiornare mappe/contratti (FEATURE_MAP, CODE_NAVIGATION) per selezione e clipboard.
2. Estrarre da `NeuroMapApp` i metodi di selezione e clipboard in `app-selection-clipboard.js` (desktop e Android), inseriti via marker come `app-tabs.js`.
3. Aggiornare `prepare.py` e i test di staging/struttura.
4. Verificare `compare_editor_bundles` IDENTICAL e `npm run test:structure`.

## Fuori scope

- Cambi comportamentali di copy/paste/selezione
- Modularizzazione `linked-views.js` / `ai-studio.js`
- Performance runtime e restyling UI (fasi successive)

## Architettura

Stesso pattern di `/* @neuromap-app-tabs */`:

- File sorgente `apps/*/editor/app-selection-clipboard.js` (metodi di classe, senza wrapper)
- Marker `/* @neuromap-app-selection-clipboard */` in `app.js`
- `editor_sources()` in `prepare.py` sostituisce il marker col contenuto del file

Metodi spostati (da `visibleSelectionOrder` a `duplicateSelection` inclusi): selezione multipla/range, clipboard interno, cut/copy/paste/duplicate.

## Criteri di successo

- Bundle desktop e Android IDENTICAL rispetto a `18071e0f`
- `npm run test:structure` verde
- `where-to-edit` / FEATURE_MAP indicano il nuovo file
- Nessuna modifica a `main` senza revisione esplicita
