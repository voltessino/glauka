# NeuroMap Architect 6.17.0 Developer — Source Lens e Atlas persistente

**Target:** Windows e macOS (editor condiviso). Android resta Free 0.5, funzioni editor 6.16.0.

## Source Lens

Nel pannello Visualizza → Source Lens si può selezionare un nodo, scegliere un PDF locale fino a 80 MB, indicare una pagina, incollare la citazione testuale e collegarla al nodo o creare un figlio dalla citazione con un solo Undo. Supporta anche link HTTP(S) espliciti e citazioni testuali, singola rimozione e riassociazione del PDF originale dopo la riapertura.

Il campo opzionale sourceRefs di ogni nodo salva soltanto ID, tipo, titolo, filename, SHA-256 del PDF, pagina, URL quando presente, citazione e data. Le operazioni esistenti cloneTree e il formato nativo v6 trasportano le referenze tramite i salvataggi .neuromap e i workspace XMind contenenti metadati NeuroMap, con Undo/Redo. Nessun PDF è incorporato nel progetto, sincronizzato o inviato a un server; dopo il riavvio va riselezionato e deve corrispondere all'hash.

Massimo 16 citazioni per nodo. I link devono usare HTTP(S) senza credenziali. Il viewer PDF usa un URL blob locale in iframe sandbox; il CSP desktop permette solo frame-src blob:, non siti terzi. Il testo evidenziato nel visualizzatore PDF deve essere COPIATO E INCOLLATO manualmente nel campo citazione: non è ancora disponibile un estrattore di testo PDF o OCR. Se l'anteprima embedded non funziona, è disponibile il PDF separato.

## Atlas persistente

Il precedente Atlas indicizzava solo le schede aperte. La versione 6.17 aggiunge un archivio locale nel workspace: registra snapshot sintetici dei documenti salvati o appena aperti esplicitamente, indicizzando nodi, titoli e brevi note senza moltiplicare la struttura logica. Sopravvive alla chiusura di schede e al riavvio dell'app. I riferimenti usano percorso canonico del progetto e indice foglio; nelle mappe native NeuroMap l'import mantiene gli ID logici.

Un clic su un risultato di una mappa chiusa non legge file silenziosamente: richiede conferma, poi il selettore file dell'app. Verifica percorso e ID prima di navigare. Se il nodo non esiste più, avvisa invece di indovinare. Dimentica indice elimina metadati locali e link Atlas relativi, mai il file sul disco.

Limiti: 60 documenti chiusi, massimo 1600 nodi per documento e 30000 nodi archiviati totali. L'indice usa unicamente matching testuale lessicale, non una ricerca AI. Non esegue scansioni automatiche di cartelle mai aperte. File XMind esterni privi di ID NeuroMap non garantiscono collegamenti stabili dopo modifiche del file esterno. Note troncate solo nell'indice, mai nel progetto. Nessun binario PDF conservato.

## Compatibilità e rilascio

Documenti vecchi privi di sourceRefs rimangono leggibili e invariati. Gli stili, le immagini, i rami e le relazioni sono conservati, poiché Source Lens riutilizza il normale modello dei nodi. La versione 6.17 è limitata ai sorgenti desktop Windows/macOS; Android continua a usare la base 6.16.0.

La suite dei test e i limiti dei collaudi nativi sono descritti in docs/qa/2026-10-22-source-lens-atlas-617.md.

**Nessun EXE/DMG nuovo viene prodotto dal solo merge.** I binari Developer 6.16.0 sul ramo downloads sono del commit 15c2dcd, precedente a Source Lens e Atlas 2.0. Non sono state usate GitHub Actions.
