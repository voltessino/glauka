# Orbit universal — Windows, macOS, browser desktop e Android

## Esperienza Orbit

Orbit è un **tema dell'interfaccia**, non uno stile dei rami o della mappa. Non modifica canvas, ID, geometria, palette dei nodi, licenze, esportazioni o dati dei progetti. Rimane **disattivato** nelle installazioni nuove.

### Windows, macOS e editor Web desktop

- Il pulsante **◇ Orbit** si trova in alto, vicino a **Schermo intero**; un secondo interruttore appare in **Stile → Aspetto dell'interfaccia**.
- **✦ Orbit** applica vetro scuro, dettagli ciano/viola, tabs e controlli armonizzati, pannello proprietà e dialoghi coerenti, hover/focus visibili.
- **Accenti:** Ciano elettrico, Viola aurora, Ambra solare.
- **Densità:** Spaziosa e Compatta. Cambia soltanto il padding della UI, non la mappa.
- **Command Deck:** pulsante **⌕ Comandi** oppure **Ctrl+Maiusc+P / Ctrl+Shift+P**. Cerca IT/EN le funzioni preesistenti, usa gli stessi pulsanti originari e non crea comandi duplicati. Navigazione ↑/↓/Invio, Tab e Esc, con focus confinato nel dialogo.
- Le scelte vengono salvate in `localStorage['nm_orbit_desktop_ui_v1']`, un oggetto limitato a `enabled`, `accent` e `density`. Non entrano mai nei file `.neuromap`.

### Android

- Dal pannello **Stile → Aspetto interfaccia** si attiva Orbit, come prima.
- Il selettore **Colore Orbit** offre gli stessi tre accenti e mantiene la preferenza indipendente `nm_android_orbit_accent_v1`.
- In Orbit vengono armonizzati il dock, i tab e il pannello **Comandi** già esistente, rispettando gesture, aree sicure e pulsanti da almeno 44 px.
- I vecchi utenti Orbit mantengono `nm_android_orbit_ui_enabled_v1`; il tema classico resta identico se Orbit è disattivato.

## Architettura

- `packages/editor-ui/orbit-core.js`: preferenze validate e catalogo dei comandi, senza accesso allo stato delle mappe.
- `packages/editor-ui/orbit-workspace.js`: comportamento Desktop/Web e dialogo accessibile.
- `packages/editor-ui/orbit-workspace.css`: sola skin, inclusa via `prepare.py` nel bundle editor desktop per Windows/macOS e distribuzioni Web che usano lo stesso editor.
- `apps/android/native/app/src/main/assets/assets/mobile-orbit-*.{js,css}`: estensione dell'Orbit già installato, non un secondo sistema concorrente.

## Verifiche e limiti

- Test puri/DOM: `orbit-core.test.js`, `orbit-workspace-dom.test.js`, `orbit-styling.test.js`.
- Regressioni Android: `mobile-orbit-toggle.test.js` e `mobile-orbit.test.js`.
- Test browser: `tests/browser/orbit-universal.spec.js` (da eseguire su browser reale).
- Build native Windows/macOS, run su Android fisico e test WebKit vanno ancora verificati in ambiente nativo prima di definire la release stabile.
- **Nessuna GitHub Action va eseguita**. La compilazione è esclusivamente locale; non modificare i trigger dei workflow.
