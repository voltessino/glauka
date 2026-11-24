# NeuroMap Architect 6.18.0 Developer — AI controllabile

**22 ottobre 2026 · Windows e macOS (editor desktop condiviso).** Android mantiene la versione applicativa Free 0.5 / set di funzioni editor 6.16, sebbene alcune librerie condivise AI ricevano i miglioramenti di validazione e approvazione.

## AI Change Review

La 6.18 introduce un'interfaccia di revisione AI nell'Assistente AI: ogni trasformazione supportata produce una bozza, una lista di differenze, spunte selezionabili e un pulsante di approvazione. I dati reali non cambiano prima di Applica. Le revisioni sono vincolate allo stato/scheda originali e all'epoca della richiesta: se la mappa viene modificata mentre si prepara l'anteprima, il commit è rifiutato.

Il confronto distingue: aggiunte/rimozioni/spostamenti di nodi, testi, note, stili, metadati dinamici inclusi link e sourceRefs, immagini, relazioni e impostazioni dello snapshot. Tutti i nodi mantengono lo stesso ID logico. Le continuazioni di layout restano solo visuali; non entrano come nodi logici nel diff.

Il comando Applica prepara l'intera nuova struttura in memoria, verifica che la revisione di base non sia obsoleta e valida riferimenti pendenti verso immagini, relazioni e sommari. Solo allora inserisce **un unico snapshot Undo** e aggiorna la mappa. Se qualcosa fallisce, tenta di ripristinare lo stato, la pila Undo e Redo. Non è una transazione su disco: il salvataggio resta quello già previsto dall'app.

**Operazioni collegate:** traduzione dell'intera mappa, suddivisione in concetti, riordino della gerarchia, espansione classica del ramo, salvataggio di spiegazioni AI come note e nuovi contenuti dalla dettatura. In particolare la dettatura non modifica più silenziosamente la mappa: dopo ogni segmento AI il microfono viene fermato e l'utente deve approvare o scartare la proposta. La creazione di una mappa in una nuova scheda mantiene la preview esplicita già esistente.

## Confronto delle revisioni

La scheda **Revisioni** di AI Studio permette di confrontare fino alle ultime 12 istantanee **Undo della scheda attiva** con lo stato corrente. È possibile selezionare le modifiche da ripristinare con un nuovo, unico Undo. Per consultare le versioni su disco resta disponibile Time Machine: **il confronto delle revisioni dei backup Time Machine non è compreso in questa fase**. Chiudere una scheda o riavviare l'app non garantisce il mantenimento della cronologia Undo: i backup Time Machine rimangono separati.

## Ricerca contestuale nelle fonti

La scheda **Fonti** ricerca in locale soltanto le referenze **Source Lens** già registrate nei nodi della mappa attiva. Mostra titolo, nodo, citazione originale, pagina e nome del PDF oppure URL registrato; non estrae automaticamente contenuti dai PDF, non esplora il web e non interroga documenti mai aperti.

**Cerca citazioni** non invia dati ai provider. Soltanto il pulsante **Invia estratti all'AI** trasmette esplicitamente fino a 12 estratti al provider configurato, sotto una richiesta che li tratta come dati non affidabili. Riferimenti PDF senza hash SHA-256 e pagina e link HTTP(S) non sicuri vengono respinti. Fonti senza testo citato non costituiscono materiale di supporto per una risposta AI. La risposta appare in sola lettura e viene etichettata come da verificare; **Prepara risposta come nota** genera un'ulteriore proposta, sempre da approvare. Non sono garantite veridicità o verifica scientifica automatica.

## Sicurezza e compatibilità

- Nessuna esecuzione di codice proveniente dal modello, nessun HTML inserito tramite innerHTML dai risultati AI. I campi di anteprima usano textContent.
- Il diff analizza anche attributi dei nodi non previsti in un elenco statico; gli attributi riservati o le strutture malformate sono rifiutati.
- Identità degli oggetti dei nodi esistenti conservata nel commit. Undo/Redo e altre funzionalità dell'editor rimangono riutilizzate.
- Nessun cambio di schema obbligatorio per i progetti .neuromap e .xmind.
- Le richieste AI usano solo il provider e le credenziali già scelti dall'utente. Il confronto, le spunte e la ricerca locale non richiedono un servizio AI.
- I grandi grafi superano i limiti operativi del motore di revisione (15.000 nodi e 6.000 cambiamenti): l'operazione si interrompe senza commit.

## Distribuzione

Questa è la versione **sorgente 6.18.0** Windows/macOS, non un installer già compilato. La precedente build Windows/macOS 6.16.0 sul ramo downloads non include 6.17 o 6.18. **Non sono state usate GitHub Actions.** Prima di distribuire sono necessari npm test, browser Playwright completo, test Go e prova EXE/DMG nativa. Vedi [rapporto QA](qa/2026-10-22-ai-change-review-618.md).
