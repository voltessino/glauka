# NeuroMap 6.16.0 — Focus, minimappa e zoom semantico (desktop)

**Base:** `main` dopo #35 (`c347d6f`). **Obiettivo:** rendere navigabili mappe di centinaia/migliaia di nodi senza cambiare un singolo ID o salvataggio.

## UX

- **Focus sul ramo:** barra contestuale discreta. Seleziona il nodo corrente (o il primo ramo principale); sfuma i rami estranei, centra e ingrandisce con transizione di circa 430 ms già implementata. `Esc` o **Ripristina vista** rimette la camera precedente.
- **Zoom semantico opzionale:** sotto il 56% nasconde soltanto le etichette di profondità 3+; sotto il 24% nasconde le etichette di profondità 2+, conservando root e primo livello, nodi, immagini, forme, colori e hitbox. Selezione e hover mantengono i testi visibili. L'overview mostra nomi e conteggi dei rami principali in caratteri leggibili.
- **Minimappa:** panoramica cliccabile/trascinabile con rettangolo della viewport, indicatore del nodo selezionato e navigazione da tastiera. I canvas di minimappa e mappa principale restano separati.
- **Preferenze:** si possono disattivare zoom semantico e minimappa indipendentemente. Solo due semplici flag nel localStorage dell'app; **Focus, minimappa, navigazione e zoom non cambiano la struttura o la cronologia Undo**.
- **Accessibilità:** bottoni etichettati IT/EN, focus visibile, tasti freccia, Escape, rilevamento `prefers-reduced-motion`, misure responsive.
- **Prestazioni:** proiezione geometrica derivata dal layout attuale e cache per scheda; grafi molto grandi decimati solo durante il disegno della miniatura (mai nella struttura dati).

## Compatibilità e confini

- File puri: `packages/editor-ui/navigation-core.js` e `navigation-experience.js`.
- Editor canvas: sola modifica transitoria ai metodi di disegno in `apps/desktop-shared/editor/renderer.js`.
- Installazione: `apps/desktop-shared/editor/startup.js` e bundle desktop in `scripts/release/prepare.py`.
- Nessuna modifica ad Android, `versions.json`, modello dati, import/export, AI o licenze.
- Esportazioni `render(customCtx)` disabilitano la sfumatura del Focus e la riduzione dei dettagli; restituiscono la mappa intera.
- Unit/DOM: `navigation-core.test.js`, `navigation-dom.test.js`, `navigation-renderer.test.js`.
- Browser: `tests/browser/knowledge-navigation.spec.js` da eseguire localmente su Chromium/Windows.
- Test installativi Windows e macOS **non eseguiti tramite GitHub Actions**; il repository conserva workflow solo `workflow_dispatch`, che non vengono invocati.

### Limiti

Il Focus è un livello di presentazione, non un nuovo tipo di nodo o una duplicazione di documento. La minimappa usa le coordinate correnti e non crea relazioni. Al momento è solo desktop e non costituisce collaborazione online o sincronizzazione cloud. Per la distribuzione vanno completate le prove browser e native, soprattutto su mappe dense e monitor HiDPI.
