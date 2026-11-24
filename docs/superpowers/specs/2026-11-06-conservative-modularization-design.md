# Design: modularizzazione conservativa P0→P1→P4→P3

**Data:** 2026-11-06 (Europe/Rome). **Base:** ramo di lavoro cloud da `stabilization/selection-clipboard-extract-20261105` (+ catalogo UI #234).

## Obiettivo

Completare i quattro passi della roadmap di modularizzazione **senza cambiare il funzionamento**: stessi salvataggi, ID, Undo/Redo, mappe, clipboard, viste e Home.

## Sequenza deciduta

1. **P0** — gate locali applicabili (structure, prepare, locales, comparator) prima e dopo ogni estrazione.
2. **P1 restante** — spezzare da `app.js` (desktop + Android) pezzi contigui ancora nel corpo di `NeuroMapApp`, con marker `prepare.py` e bundle **IDENTICAL**.
3. **P4** — spezzare dettagli Home/dialoghi ancora in `shell.js` desktop (Android già ridotto).
4. **P3** — spezzare ulteriormente `packages/editor-ui/linked-views.js` (alto rischio; solo dopo P1/P4 e con marker UI già usati per `linked-view-export`).

## Vincoli

- Nessun cambiamento semantico: confronto `compare_editor_bundles.py --include-ui-fragments` = IDENTICAL per ogni estrazione puramente testuale.
- Nessun modulo ES nuovo; niente rinomina formati; niente Actions GitHub; niente segreti.
- Un commit/PR pezzo per pezzo; rollback via Git semplice.
- Aggiornare `CODE_NAVIGATION.md` / `FEATURE_MAP.json` solo dove il punto di modifica canonico cambia.
- Non toccare `interface-languages.js` salvo compose di staging.

## Pattern tecnico (invariato)

Frammento = corpo metodi di classe. Marker `/* @neuromap-<nome> */\n` sostituito una sola volta in `prepare.editor_sources()` / `ui_source()` e nel comparatore.

## Ordine P1 in questo programma

1. Menu contestuale + trova (`showContextMenu`…`updateFindResults`) → `app-context-find.js`
2. Binding UI / tastiera (`bindUI`) → `app-bind-ui.js`
3. Helper immagini/hit ancora in `app.js` solo se restano contigui e utili dopo i passi sopra

## Fuori scope

- Riscrivere algoritmi di layout/map-core
- Separare i repository
- Tradurre creativamente le lingue non-IT/EN
- Merge automatico su `main`
