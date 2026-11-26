# Glauka — campagna di revisione generale (design)

**Data:** 2026-11-26  
**Branch di avvio:** `cursor/revisione-generale-zone-a-c417`  
**Obiettivo:** rivedere il monorepo a pezzi isolati: togliere ciò che non serve più, velocizzare ciò che è lento, correggere difetti, senza regressioni su mappe, Undo, salvataggi o build.

## Principi

1. **Indicizzare prima di modificare.** Le 18 aree di `docs/FEATURE_MAP.json` e la mappa in `docs/CODE_NAVIGATION.md` restano la base.
2. **Tre zone di rischio.**
   - **Zona A (perimetro):** sito, tool interni, documentazione, inventari Git. Quasi nessun legame col cuore delle mappe.
   - **Zona B (bordi):** lingue, icone, OCR/PDF, Cloud, AI, packaging. Un pezzo per volta.
   - **Zona C (cuore):** nodi, layout, drag, zoom, import/export, salvataggi, viste, studio. Solo con difetto o lentezza misurata; mai due temi insieme.
3. **Prova prima di cancellare.** Nessuna rimozione senza riferimento (pagina che non carica il file, packaging che non lo include, test aggiornato).
4. **Desktop e Android.** Se si tocca codice comune, verificare entrambe le piattaforme applicabili.
5. **Niente azioni distruttive su rami/PR** senza ok del proprietario. Inventario a secco sì.

## Prima fetta (questa PR)

**Area:** sito (`apps/website/home-review` + packaging OVH).  
**Perché:** isolata dall’editor; la home attuale non usa più pezzi ancora spediti o caricati.

Interventi previsti:

- Rimuovere nove file vuoti (stub CSS/JS) ancora elencati nel packaging.
- Smettere di caricare e spedire `living-canvas.js`, `story-paths.js`, `living-canvas.css`, `story-cinema.css`, `home-en.js` (pagina senza i relativi elementi; `home.js` copre IT/EN).
- Allineare i test Python del packaging e i test browser del sito alla pagina attuale.
- Documentare l’indice di revisione in `docs/maintenance/`.

Fuori da questa fetta: prototipi di design (`prototypes*`, `prisma-evolutions`) restano archivio con i loro test; cuore editor intatto.

## Fette successive (ordine)

| Ordine | Zona | Tema | Gate minimo |
| --- | --- | --- | --- |
| 2 | A | Video Studio / tool interni: codice morto dimostrato | test tool locali |
| 3 | B | Lingue / cataloghi (se emergono buchi) | `test_interface_locales` |
| 4 | B | OCR/PDF o Cloud solo se c’è peso o bug misurato | test dedicati |
| 5 | C | Un solo tema (es. zoom o autosave) | Node + browser + recovery |

## Criteri di successo per ogni fetta

- Diff limitato a un’area isolata.
- Test aggiornati o esistenti verdi per quell’area.
- Dichiarazione esplicita di cosa è stato eseguito e cosa no (niente EXE/DMG/APK inventati).
- Nessuna modifica a formati salvati, ID, Undo, licenze o workflow GitHub Actions.
