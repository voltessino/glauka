# NeuroMap 6.16.0 — confronto concetti per studio e analisi

## Funzionamento

- Dal percorso contestuale selezionare **⇄ Confronta**. È possibile scegliere due nodi con Ctrl+Clic; con un solo nodo, l'app propone il fratello adiacente o due rami principali.
- Due colonne presentano sottorami e dettagli esistenti, preservando etichette, livello e ID originali.
- Il comando **Profondità** mostra 1, 2, 3 o 5 livelli, senza espandere o modificare i rami collassati; **⇄ Inverti** scambia le colonne.
- Le etichette condivise sono riconosciute mediante normalizzazione del testo (minuscole, spazi, accenti); **non viene mai dedotta un'equivalenza scientifica, un sinonimo o una causalità**.
- Cliccando una voce si torna all'esatto nodo originale; se non è visibile per un collasso, la selezione viene effettuata senza espandere automaticamente il ramo.
- I contenuti e le didascalie sono sempre inseriti nel DOM tramite `textContent` (mai come HTML).
- È una vista **di sola lettura**: confronto, scambio e cambio di profondità non scrivono sul documento e non creano snapshot Undo.

## Limiti

- Il rendering del confronto visualizza massimo 240 elementi per colonna e segnala il limite; l'inventario tollera mappe fino a 25.000 nodi.
- Le relazioni `flowchart`, i metadati Kanban e le immagini non vengono inventati o reinterpretati.
- Supporto iniziale **desktop Windows/macOS**, nessuna modifica al modello dati o all'APK Android.
- Per mappe con alias visuali o topologie non valide, il confronto segnala un errore e lascia intatto il documento.

## Verifiche

- `packages/editor-ui/tests/compare-core.test.js`: catalogo, normalizzazione esatta, contenuti comuni, limiti e sicurezza.
- `packages/editor-ui/tests/compare-dom.test.js`: prova senza browser di UI, navigazione, Esc e non mutazione.
- `tests/browser/concept-comparison.spec.js`: test browser da eseguire manualmente su una build desktop reale.
- Preparazione Windows/macOS: `scripts/release/prepare.py`, `scripts/release/test_prepare.py`.

Non sono state eseguite GitHub Actions; i workflow del repository restano esclusivamente manuali. La distribuzione stabile richiede comunque la suite Playwright completa e i test installativi nativi.
