# NeuroMap 6.16.0 — vista affiancata sincronizzata (desktop)

## Scopo e funzionamento

Il comando **Affianca** si abilita quando la modalità principale è **Mappa mentale**.

- La mappa mentale rimane nella metà sinistra della finestra, operativa e modificabile.
- Un pannello a destra apre un'altra rappresentazione selezionabile: organigramma, albero concettuale, rete concettuale, flusso, Kanban o Timeline.
- Entrambe le rappresentazioni usano **la stessa istanza di `MindMapStateMachine`**; nessun nodo, ID, relazione, immagine o proprietà viene duplicato.
- Le interazioni supportate nel pannello (rinomina, aggiunta nodi, relazioni, stato, date, spostamento dei nodi e Kanban) scrivono sui dati originali e preservano Undo/Redo.
- La selezione della vista affiancata è **solo una preferenza di sessione** (WeakMap) e non altera `root.viewMode`; non genera un'operazione Undo o una modifica al documento.
- Il pannello può essere chiuso da **Chiudi vista affiancata**, dal pulsante Affianca o tramite Esc. Si può anche passare a una vista alternativa a schermo intero con il selettore principale.
- Durante l'affiancamento la camera viene spostata in modo reversibile verso il centro dello spazio rimasto a sinistra. La chiusura recupera l'offset, mantenendo gli spostamenti manuali dell'utente.
- Quando il pannello è chiuso, la normale mappa e le altre modalità funzionano come nella 6.16.0 precedente.
- Su finestre inferiori a 750 px il pannello diventa a larghezza piena per non comprimere i controlli.

## Implementazione e limiti

`packages/editor-ui/linked-views.js`: classe CSS `nm-side-panel`, pulsante `nm-view-split`, selezione e camera indipendenti dai dati.
`tests/browser/split-view.spec.js`: modifica bidirezionale, selezione del diagramma e chiusura.
`packages/editor-ui/tests/linked-views-dom.test.js`: regressioni senza browser e test di offset/camera.

La vista affiancata è attualmente disponibile solo su Windows/macOS Developer. Le due rappresentazioni non sono finestre native indipendenti né documenti separati; non sono state aggiunte nuove API cloud. I test sintetici non sostituiscono la suite Playwright su browser reali, la verifica Windows o WebKit macOS. Nessuna GitHub Action viene eseguita automaticamente.
