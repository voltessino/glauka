# NeuroMap 6.16.0 — Zen, percorso contestuale e immagini ingrandite

## Nuove funzioni desktop

- **Modalità Zen**: pulsante vicino a Schermo intero, nasconde le barre alte e il dock degli strumenti senza cancellare nulla. Rimangono zoom, Focus, minimappa e un comando visibile **Esci da Zen**. Uscita anche tramite Esc, rispettando editor e modali attivi. Nessun fullscreen forzato e nessuna perdita della posizione camera.
- **Percorso del concetto**: quando si seleziona un nodo non centrale compare una barra compatta con il percorso `Mappa › Ramo › Nodo`; si può saltare a qualunque antenato. Se il percorso è lungo, si conserva root e gli ultimi livelli.
- **Azioni contestuali**: **Modifica**, **+ Figlio**, **Focus**, **Stile**, collegati alle funzioni preesistenti (niente implementazioni duplicate).
- **Anteprima immagini**: nuovo comando nella scheda dell'immagine e nel menu contestuale. Overlay ad alta risoluzione, zoom tra 40% e 300%, Adatta, tastiera (Tab/Esc), modalità assistive e focus restaurato. L'immagine originale mantiene dimensioni, posizione, ID e layer inalterati.
- **Protezione sorgenti:** il visualizzatore accetta solo protocolli di immagini previsti. Il testo delle didascalie entra nel DOM via `textContent`, mai HTML.
- **Responsive e accessibilità:** contrasto, stati hover/focus, layout ridotto, preferenze di movimento ridotto, localizzazione IT/EN. Nessuna dipendenza esterna o richiesta AI.

## Invarianti

La modalità Zen, la navigazione contestuale e l'anteprima sono **solo UI temporanea**. Non scrivono in `.neuromap`, non effettuano copie dei nodi né aggiungono stati Undo. Le azioni **Modifica** e **+ Figlio** continuano a utilizzare esplicitamente le operazioni canoniche dell'editor.

## File e prove

- `packages/editor-ui/presentation-experience.js`: pannelli e integrazione app, caricato **solo su desktop**.
- `packages/editor-ui/tests/presentation-dom.test.js`: Zen, percorso, azioni, modal, validazione URL e focus.
- `tests/browser/zen-image-workspace.spec.js`: scenari Playwright da eseguire localmente.
- Bundle Windows/macOS condiviso in `scripts/release/prepare.py` e guardia test in `scripts/release/test_prepare.py`.

**Non usare GitHub Actions:** i workflow restano solo manuali; nessuno è stato avviato per questa modifica. Prima del rilascio sono comunque necessarie le prove desktop reali Chromium/Windows e WebKit/macOS.
