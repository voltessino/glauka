# Glauka — inizia da qui (non serve essere programmatori)

Questa è la porta d'ingresso per capire il codice. **Parti dal problema da risolvere**, non dal nome di un file.

## Come orientarti in tre passaggi

1. Descrivi cosa non funziona: «non salva», «la modalità Fluida dispone male», «APK non si compila».
2. Cerca la funzione nella tabella o con il comando illustrato qui sotto.
3. Apri il codice e il test indicati; non modificare vecchie copie o file generati.

| Se vuoi capire... | Primo file da aprire |
| --- | --- |
| Nodi, selezioni, Undo | [Stato desktop](../apps/desktop-shared/editor/state.js), [Android](../apps/android/editor/state.js) |
| Oraria, Bilanciata, Fluida | [Algoritmi comuni](../packages/map-core/index.js), [layout desktop](../apps/desktop-shared/editor/layout.js), [Android](../apps/android/editor/layout.js) |
| Spostamento dei rami | [Motore trascinamento](../packages/editor-ui/drag-preview.js) |
| Salvataggi e crash | [Coda desktop](../apps/desktop-shared/editor/workspace-save-queue.js), [recupero Android](../apps/android/native/app/src/main/java/it/neuromap/architect/preview/WorkspaceRecoveryStore.java) |
| Cloud e provider | [Core Cloud](../packages/cloud-sync/core.js) |
| Flashcard e studio | [Ripasso condiviso desktop/Android](../packages/editor-ui/editor-shared/navigation-flashcards.js) |
| AI e modelli | [Client desktop](../apps/desktop-shared/editor/ai-client.js), [Android](../apps/android/editor/ai-client.js) |
| PDF e OCR | [PDF.js](../apps/desktop-shared/editor/pdfjs-adapter.js), [OCR](../apps/desktop-shared/editor/ocr-core.js) |
| Pannelli e temi | [Interfaccia condivisa](../packages/editor-ui/workspace-chrome.js) |
| EXE Windows | [Istruzioni Windows](../apps/windows/README.md) |
| DMG Mac | [Istruzioni macOS](../apps/macos/README.md) |
| APK Android | [Build APK](../scripts/release/build_android_local.py), [Java](../apps/android/native/app/src/main/java/it/neuromap/architect/preview/MainActivity.java) |

## Un comando semplice per trovare i file

Dalla cartella principale del progetto, con Node installato:

    node scripts/maintenance/where-to-edit.cjs --list
    node scripts/maintenance/where-to-edit.cjs fluida
    node scripts/maintenance/where-to-edit.cjs salvataggio
    node scripts/maintenance/where-to-edit.cjs apk

La ricerca usa [FEATURE_MAP.json](FEATURE_MAP.json): 18 aree, percorsi del codice comune, delle due piattaforme, test e avvertenze.

Per verificare che i riferimenti esistano, senza modificare file né avviare build:

    node scripts/maintenance/where-to-edit.cjs --check
    npm run test:structure

## Le quattro cartelle principali

- **apps/** contiene le applicazioni. Windows e macOS condividono l'editor desktop; Android ha il proprio.
- **packages/** contiene il codice riutilizzabile: motore mappe, interfaccia, Cloud.
- **scripts/** contiene build locali, test e manutenzione.
- **docs/** contiene guide e storico. I rapporti vecchi non descrivono necessariamente il main attuale.

**Non fare pulizia spostando file alla cieca.** Gli editor usano due manifest che definiscono l'ordine esatto di concatenazione JavaScript. Non modificare asset generati, non eliminare backup e non avviare GitHub Actions. Un test isolato non certifica una build EXE/DMG/APK.

Se serve approfondire: [mappa tecnica completa](CODE_NAVIGATION.md), [architettura](REPOSITORY_LAYOUT.md), [test e compilazione](DEVELOPMENT.md), [differenze piattaforme](PLATFORM_PARITY.md), [istruzioni Codex](../AGENTS.md).
