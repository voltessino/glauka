# Indice revisione generale Glauka — 26 novembre 2026

Fotografia di partenza su `main` (`5fd88a3d` e successivi). Serve a lavorare **a zone isolate**, non a rifare tutto insieme.

## Zone

| Zona | Contenuto | Isolamento | Stato |
| --- | --- | --- | --- |
| **A** | Sito, Video Studio, license-manager, docs, inventari Git | Alto | **In corso** — sito + gate Video Studio |
| **B** | Lingue, icone, OCR/PDF, Cloud, AI UI, packaging nativo | Medio | Baseline: lingue e OCR/PDF già verdi |
| **C** | Nodi, layout, drag, zoom, file, salvataggi, viste, studio | Basso (molto collegato) | Solo con bug/lentezza misurata |

## 18 aree prodotto (FEATURE_MAP)

`nodi`, `layout`, `drag`, `schermo`, `file`, `salvataggi`, `cloud`, `ai`, `studio`, `viste`, `documenti`, `immagini`, `interfaccia`, `lingue`, `windows`, `macos`, `android`, `sito`.

## Fette chiuse / in PR

1. **Zona A · sito:** stub CSS/JS, living-canvas/story-paths, PNG legacy non linkati, tour-player inutilizzato; test packaging e Playwright aggiornati.
2. **Zona A · Video Studio:** rimosso il passo duplicato `p6-p7-targeted` dal release-gate (già coperto da `qa.cjs --fast`); tolto export morto `escapeHTML` da `review.cjs`.

Dettaglio: [design](../superpowers/specs/2026-11-26-code-review-campaign-design.md), [piano sito](../superpowers/plans/2026-11-26-zone-a-website-dead-weight.md).

## Regole operative

1. Un’area per PR.
2. Prova di non-uso prima di cancellare.
3. Dichiarare test eseguiti / non eseguiti.
4. Non avviare GitHub Actions; non cancellare rami senza ok.

## Repo pubblica `voltessino/glauka`

Allineata dal proprietario (26 nov 2026): aggiornamento **diretto** dopo ogni pezzo di nucleo open.  
Procedura: [`2026-11-26-public-glauka-sync.md`](2026-11-26-public-glauka-sync.md).  
Ultimo sync pubblico: `ae1efeb` ← privata `32986cb0`.  
Sito / Video Studio da soli non richiedono sync.

## Baseline Zona B (26 nov 2026)

- Lingue: 8 cataloghi × 7063 chiavi allineati; `test_interface_locales` 6/6 OK; structure shell dictionary/locale OK.
- OCR vendor: 3/3 OK. PDF.js vendor: 5/5 OK.
- Nessun buco cataloghi da chiudere subito; prossima fetta = pezzo isolato con prova di non-uso (es. license-manager o packaging), non il cuore editor.

## Prossime fette proposte

1. Zona B: un bordo alla volta solo se emerge peso morto verificato.
2. Zona C: un solo tema solo con prova misurata.
3. Dopo ogni pezzo open: export + push su `voltessino/glauka`.
