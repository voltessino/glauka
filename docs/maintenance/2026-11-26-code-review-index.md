# Indice revisione generale Glauka — 26 novembre 2026

Fotografia di partenza su `main` (`5fd88a3d` e successivi). Serve a lavorare **a zone isolate**, non a rifare tutto insieme.

## Zone

| Zona | Contenuto | Isolamento | Stato |
| --- | --- | --- | --- |
| **A** | Sito, Video Studio, license-manager, docs, inventari Git | Alto | **In corso** — sito + gate Video Studio |
| **B** | Lingue, icone, OCR/PDF, Cloud, AI UI, packaging nativo | Medio | In coda |
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

Deve restare allineata al **nucleo open** della privata, con export manuale.  
Procedura: [`2026-11-26-public-glauka-sync.md`](2026-11-26-public-glauka-sync.md).  
Le fette Solo-sito / Solo-Video-Studio **non** bastano da sole a richiedere un sync.

## Prossime fette proposte

1. Integrare la PR Zona A (#343), poi decidere se serve un sync pubblico (solo se c’è nucleo open da portare).
2. Zona B: un bordo alla volta (lingue / OCR / packaging) se emerge un problema concreto.
3. Zona C: un solo tema (es. lentezza zoom o salvataggio) solo con prova misurata.
4. Dopo ogni merge sul nucleo open: ripetere l’export verso `voltessino/glauka`.
