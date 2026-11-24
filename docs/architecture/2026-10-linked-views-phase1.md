# NeuroMap — viste collegate, fase 1

## Obiettivo

Permettere di rappresentare **gli stessi nodi** come mappa mentale (originale),
organigramma verticale e albero concettuale orizzontale. Le viste NON creano
copie del contenuto. Questo evita la desincronizzazione tra mappe e diagrammi.

## Contratto dati

- Gli ID dei nodi, i parentId, i figli, note, collegamenti, immagini, marcatori e
  relazioni restano quelli della mappa di partenza.
- La sola nuova proprietà è `root.viewMode`:
  `mindmap` (o assente, per retrocompatibilità), `orgchart`, `concept-tree`.
- `MindMapStateMachine.cloneTree` conserva la scelta della vista negli snapshot,
  Undo/Redo, workspace locale e nei salvataggi `.neuromap`. Nessuna migrazione
  invasiva o cambio dello schema v6.
- Le viste non scrivono mai coordinate nel grafo: `NeuroMapViewCore.project(root,mode)`
  è una proiezione deterministica a partire dai dati esistenti.
- `viewMode` e `layoutMode` sono **indipendenti**: uscire dalla vista collegata
  restituisce esattamente la disposizione della mappa mentale preesistente.
- La scelta è per scheda, senza moltiplicare i nodi. Il passaggio fra
  rappresentazioni avviene **nella scheda attiva**. La possibilità di mantenere
  due viste *simultanee* dello stesso documento in schede distinte è pianificata
  per una fase successiva: non è ancora implementata.

## Esperienza utente

Il controllo «Visualizza come» offre:
1. **Mappa mentale**, con tutti i cinque layout già presenti;
2. **Organigramma**, con rami dall'alto verso il basso;
3. **Albero concettuale**, con rami da sinistra verso destra.

L'utente può cambiare vista direttamente dal pannello, ritornare alla mappa
originale, selezionare un nodo, rinominarlo con doppio clic/Invio, aggiungere un
figlio con «+» o espandere/comprimere un ramo. Le modifiche usano
`MindMapStateMachine.updateNodeText/addChildNode/toggleCollapse`, quindi
mantengono Undo/Redo e comportamento di salvataggio originali.
I testi sono creati come nodi DOM con `textContent`, mai con HTML non fidato.

Per mantenere la vista navigabile anche in mappe estese, il contenitore dispone
di scorrimento in entrambe le direzioni e centra la radice all'apertura.
Una protezione impedisce di creare migliaia di elementi DOM oltre la soglia
fissata dal proiettore: la mappa originale rimane comunque intatta e accessibile.

## Limiti deliberati del primo rilascio

- Organigramma e albero concettuale sono **viste gerarchiche**; non sono ancora
  un diagramma di flusso o una rete semantica.
- Le relazioni incrociate, le immagini e gli oggetti liberi restano nel documento
  originale, ma non vengono ancora disegnati da queste due viste. Le
  esportazioni esistenti continuano a usare la visualizzazione originale.
- Un vero flowchart non può essere prodotto deducendo arbitrariamente
  «prima/dopo» o «Sì/No» dall'ordine dei sottorami: serve prima un modello
  esplicito di passaggi, transizioni, condizioni ed eventuali cicli.
- Da verificare ancora: avvio e interazioni complete sul pacchetto
  Windows/macOS, WebKit nativo, integrazione grafica con tutti i popup, accessibilità.

## Percorso per le fasi successive

**Fase 2**: metadati semantici separati dalla gerarchia
(`relations[{id,fromId,toId,type,label}]`, tipi `sequence`, `decision`,
`dependency`, `reference`), anteprima delle ambiguità e diagramma di
flusso/decisionale con frecce direzionali e nessuna perdita dati.

**Fase 3**: timeline/Kanban utilizzando date/stati tipizzati, non inventati;
viste miste per ramo, rappresentazioni multiple simultanee e layout
professionali esportabili.

**Fase 4**: conversioni assistite offline/AI con conferma delle informazioni
mancanti, provenienza esplicita di ogni inferenza e rollback.

## Test introdotti

- `packages/editor-ui/tests/view-core.test.js`: 7 casi Node per modalità,
  proiezioni pure, identità, ordine, geometrie, collassi, cicli, dimensioni e
  contenuti non fidati.
- `tests/browser/linked-views.spec.js`: 3 casi Playwright desktop
  (editing, Undo/Redo, aggiunta nodi, payload salvato e ritorno alla mappa).
- `scripts/release/test_prepare.py`: test specifico che verifica il bundle
  identico Windows/macOS e la corretta inclusione in staging.

**Nessun GitHub Actions**: i test di integrazione desktop vanno eseguiti da
checkout completo in ambiente locale prima del rilascio binario.
