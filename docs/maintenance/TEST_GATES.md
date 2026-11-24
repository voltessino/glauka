# Scegliere i controlli in base al rischio

I comandi si eseguono dalla radice del checkout. Le selezioni mirate non
sostituiscono una certificazione di release; un comando non eseguito non è verde.
Non avviare GitHub Actions.

| Livello | Quando | Comando o fonte canonica |
| --- | --- | --- |
| Rapido | Documentazione, manifest, ambito e ordine dei sorgenti | `npm run test:structure`; `python3 -m unittest discover -s scripts/maintenance -p 'test_*.py' -v` |
| Estrazione testuale | Prima e dopo ogni commit che sposta codice senza cambiarlo | `python3 scripts/maintenance/compare_editor_bundles.py --base <prima> --head <dopo> --include-ui-fragments` |
| Impostazioni | Valori, selezioni e riepiloghi misti | `node --test packages/editor-ui/tests/settings-summary.test.js packages/editor-ui/tests/layout-mode-switch-regression.test.js`; browser `settings-summary.spec.js` e `paint-text-decoration.spec.js` |
| Schede e dati | Attivazione/chiusura, duplicazione, Undo/Redo, recovery | Browser `controller-tabs.spec.js`, `recovery.spec.js`, `native-close-choices.spec.js`; Node `workspace-recovery-integrity.test.js`, `workspace-autosave-race.test.js`; test Java/Go delle piattaforme interessate |
| Viste | Camere, schede, modifica del medesimo albero ed export SVG | Node `linked-views-dom.test.js`, `view-workspace-persistence.test.js`; browser `linked-views.spec.js` e `universal-workspace.spec.js` |
| Canvas/drag | Cache, zoom, nitidezza e continuazioni | Node `measurement-cache-draft.test.js`, `canvas-frame-selection.test.js`, `closed-raster-cache.test.js`; browser `preview-measurement-reuse.spec.js`, `canvas-frame-selection.spec.js`, `android-continuation-selection.spec.js`, `closed-image-cache.spec.js`, `selected-drag-layout.spec.js` |
| Integrazione | Codice definitivo e risoluzione dei conflitti | `npm test`, `npm run test:build`, gate browser delle aree interessate, build locali e suite native disponibili |
| Release | Prima di distribuire | Suite browser completa applicabile, test Go Release/Developer, gate Gradle/Java, prove Windows/macOS/Android fisico, Cloud con account reali; firma e notarizzazione richieste |

Per i file Node nella tabella usare il prefisso `packages/editor-ui/tests/`;
per i browser `tests/browser/`. Esecuzione: `npx playwright test <file...>` con
Chromium installato, oppure `CHROMIUM_EXECUTABLE_PATH` predisposto. I comandi
completi di staging, Go e Gradle sono nella [guida sviluppo](../DEVELOPMENT.md).
Il backend multi-open reale dispone dei runner in `scripts/qa/`; il picker
simulato su Linux non equivale a Windows Explorer o ai dialoghi macOS.

## Contenuto effettivamente controllato

- `sources.json` elenca gli script in ordine; `app-tabs.js` è un corpo di classe
  espanso in `app.js`, non uno script autonomo.
- La sintassi del frammento è controllata nel contesto di classe, e il contratto
  di composizione compila entrambi gli editor completi dopo l'inserimento.
- Il comparatore legge revisioni Git senza modificarle. Per le due IIFE UI
  espande i frammenti, prima delle sostituzioni CSS/font. Non confronta tutti
  gli asset nativi; i test Python confrontano anche il suo risultato con la
  composizione reale di `prepare.py`.
- Un cambiamento algoritmico deve risultare `DIFFERENT`: usare equivalenza dei
  dati, test funzionali e misure, senza aggiornare attese soltanto per farlo passare.
- Distinguere fallimenti introdotti dal diff, problemi già riproducibili sulla
  base e prove saltate per strumenti/host mancanti. Non escludere test corretti.
