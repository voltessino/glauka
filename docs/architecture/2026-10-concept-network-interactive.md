# NeuroMap 6.16.0 — rete concettuale libera e Kanban trascinabile (desktop)

## Contratto della prima integrazione

Questo sviluppo aggiunge la modalità `concept-network` alle viste collegate per Windows e macOS. Non modifica lo schema nativo v6 né le coordinate della mappa mentale.

- Tutte le viste continuano a utilizzare gli stessi ID dei nodi.
- La rete rappresenta i rapporti gerarchici e le relazioni già registrate in `relationships[]`; non inventa collegamenti semantici.
- Il pulsante «Collega due concetti» permette di scegliere con un clic origine e destinazione e inserire un'etichetta. Il collegamento usa `addRelationship`, con Undo/Redo e i normali percorsi di salvataggio.
- Il trascinamento di un nodo conserva solo una proprietà opzionale `networkPosition: {x, y}`, validata e limitata all'area consentita. Il layout della mappa mentale rimane indipendente.
- Riapertura, copia, salvataggio `.neuromap`, snapshot e Undo/Redo usano il percorso comune `MindMapStateMachine.cloneTree`.
- Le frecce e le relative etichette appaiono nella vista e nell'esportazione SVG; tutte le stringhe utente sono trattate come testo, non HTML.
- Le relazioni di processo `sequence/yes/no` non vengono reinterpretate o mutate dalla vista a rete.
- Kanban può spostare schede fra `Da classificare`, `Da fare`, `In corso`, `Completato` tramite drag & drop. La sola proprietà modificata è `taskStatus`; le date restano intatte e Undo è atomico.

## Principali file

- `packages/editor-ui/concept-network.js`: proiezione pura e percorsi SVG.
- `packages/editor-ui/linked-views.js`: controllo visivo, drag, collegamento, rendering ed export.
- `apps/desktop-shared/editor/state.js`: validazione, cronologia e persistenza.
- `packages/editor-ui/view-core.js`: registrazione della modalità.
- `scripts/release/prepare.py`: inclusione nell'editor desktop condiviso.

## Verifiche

- `packages/editor-ui/tests/concept-network.test.js`: layout, ID, limiti di sicurezza, dati immutabili e relazioni.
- `tests/browser/concept-network.spec.js`: collegamento visuale, etichette, posizione manuale, Kanban drag/drop, salvataggio e Undo/Redo.
- Controllare inoltre tutte le regressioni desktop, dati/import/export, IT/EN e le build con `npm test`, `npm run test:build` e `npm run test:browser`.

### Limiti prima del rilascio

L'integrazione rimane **solo desktop**. Non include ancora modifiche alla UI Android, split-view simultanea, autorouting avanzato, Gantt, riordinamento di massa, AI generativa o sincronizzazione cloud. Le posizioni sono per nodo, non per vista simultanea. Il canvas con oltre 1200 nodi viene rifiutato dalla rete (il documento originale rimane intatto). I layout molto densi, i cicli e i collegamenti sovrapposti richiedono ulteriori prove visive.

I test browser e le installazioni native su Windows e macOS non sono stati eseguiti da questa integrazione remota; non dichiarare il pacchetto stabile prima delle prove sul sistema operativo.
