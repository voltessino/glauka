# Conversione guidata in diagramma di flusso — 21 ottobre 2026

Le viste desktop ora supportano un'**anteprima non distruttiva** dei collegamenti di sequenza fra sottoargomenti consecutivi dello stesso genitore.

## Comportamento

1. In **Flusso di lavoro**, il pulsante `Crea flusso dai rami…` apre una preview. Selezionare il ramo da convertire.
2. L'app mostra soltanto coppie di nodi fratelli, nell'ordine attuale del documento, senza salvarle.
3. L'utente **seleziona manualmente** le coppie corrette. Il pulsante di conferma è disabilitato se nessuna coppia è selezionata.
4. Una singola conferma aggiunge le transizioni `sequence` selezionate attraverso `addFlowTransitionsBatch`: un unico snapshot Undo e nessuna duplicazione dei nodi.
5. Sono esclusi i collegamenti di sequenza già presenti e le proposte che, combinate con i flussi esistenti, introdurrebbero cicli. Le relazioni precedenti restano intatte.
6. Annulla, Esc, cambio di vista o scheda non applicano transizioni.
7. Non vengono mai indovinate decisioni Sì/No, date, condizioni o dipendenze.

## Limiti e verifiche

- Anteprima limitata a 1200 nodi e 100 nuove coppie per volta; non converte automaticamente ogni ramo.
- Modulo puro: `packages/editor-ui/guided-flow.js`, con test sui grafi, sulle collisioni e sulla non mutazione dei dati.
- Stato: `apps/desktop-shared/editor/state.js`, operazione batch atomica e retrocompatibile.
- UI: `packages/editor-ui/linked-views.js`, localizzata IT/EN.
- Test DOM simulati e browser: `linked-views-dom.test.js` e `guided-flow.spec.js`.
- Integrazione esclusivamente desktop; Android non modificato.
- Le prove browser reali, gli installer Windows e WebKit macOS devono essere eseguiti prima di dichiarare il rilascio certificato.
