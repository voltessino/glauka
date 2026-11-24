# NeuroMap — diagrammi di flusso semantici, fase 2 (desktop)

La fase 2 dipende dalla fase 1 (viste collegate a ID stabili). Le nuove viste
sono **renderizzazioni dello stesso documento**, non copie di nodi.

## Quali informazioni hanno significato di processo?

- `root.viewMode = "flowchart"` seleziona la rappresentazione, senza cambiare
  la disposizione o la gerarchia dei nodi originali.
- In `relationships[]`, una proprietà **opzionale** `kind` distingue:
  - `sequence`: passaggio diretto
  - `yes`: uscita positiva da una decisione
  - `no`: uscita negativa da una decisione
- I collegamenti precedenti, privi di `kind`, restano collegamenti generici.
  **Non** vengono trasformati automaticamente in transizioni.
- `MindMapStateMachine.cloneRelationships` conserva i `kind` ammessi nelle
  copie, in Undo/Redo, nel workspace e nel formato `.neuromap`. Il formato
  SingleTab-v6 resta retrocompatibile: per i documenti vecchi non viene aggiunto
  `kind` ai collegamenti generici.
- Il motore ignora per la *sola vista* frecce verso nodi mancanti, auto-frecce e
  duplicati, senza modificare l'archivio originale. I cicli espliciti restano
  nel grafo; non si cerca di "ripararli" reinterpretando il processo.

## Interazione

In «Visualizza come → Flusso di lavoro», la barra permette di scegliere
**Da**, **A** e **Collegamento**, quindi premere **Collega**. Le due liste di
nodi usano etichette con parte del percorso gerarchico; la decisione Sì/No
resta salvata semanticamente. Le linee terminano con frecce direzionali.

- Se non esistono collegamenti tipizzati, la vista resta vuota ma spiega come
  costruirli. Non si inventano collegamenti a partire dall'ordine dei rami.
- Rinominare un nodo modifica il nodo originale.
- «+» da un nodo del flusso aggiunge un sottoramo e la transizione `sequence`
  con **un'unica** operazione Undo.
- L'elenco dei collegamenti nel pannello consente di eliminare una freccia
  con Undo, senza tornare alla mappa mentale.
- Le rinomine in corso vengono salvate sul **nodo e sulla scheda originali**
  quando si passa rapidamente a una vista o scheda diversa.
- Il bottone «Esporta vista SVG» è disponibile per organigrammi, alberi
  concettuali e diagrammi di flusso. Produce un SVG vettoriale con testo
  escapato tramite elementi XML. Non modifica i dati del documento.
- «Torna alla mappa» ripristina i layout già memorizzati e lascia intatte le
  relazioni semantiche. Le normali esportazioni File restano per ora basate
  sulla mappa originale; il pulsante dedicato esporta la vista alternativa.

## Perché non convertire subito tutta la gerarchia?

Una gerarchia di argomenti non implica una sequenza temporale né una condizione
decisionale. Ordinare automaticamente `A → B → C` potrebbe essere falso.
La futura «conversione guidata» potrà suggerire passaggi da confermare
esplicitamente: il dato confermato verrà registrato con provenienza e Undo.

## Test

- `packages/editor-ui/tests/flow-core.test.js`: 6 casi per frecce tipizzate,
  assenza di inferenze, cicli, validazione, preservazione dati e XSS.
- `packages/editor-ui/tests/view-core.test.js`: aggiornato per distinguere
  il motore di geometria gerarchica dal motore semantico.
- `tests/browser/semantic-flow.spec.js`: interazioni GUI, salvataggio v6,
  decisioni, Undo atomico ed esportazione SVG.
- `scripts/release/test_prepare.py`: bundle Desktop Windows e macOS
  identici con FlowCore incluso; Android rimane invariato.

I test **puri** sono stati eseguiti fuori GitHub: 13/13 superati; un test
d'integrazione reale della classe di stato ha verificato addFlowTransition,
salvataggio della relazione, Undo, Redo e assenza di frecce duplicate.
I test Playwright su build completa e installazione Windows/macOS **restano
da eseguire**: non considerare i nuovi EXE certificati.

GitHub Actions non deve essere avviato senza autorizzazione esplicita.
