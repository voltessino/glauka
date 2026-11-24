# Glauka Windows — build locale

La versione esatta viene letta da `versions.json`. Il codice nativo e l'editor
risiedono in `apps/desktop-shared/src` e `apps/desktop-shared/editor`;
l'installer è in `apps/windows/installer`. Le vecchie copie ZIP in `apps/windows/legacy` non erano usate dalle build moderne e sono ora conservate nella [cronologia Git](../../docs/maintenance/legacy-source-archives.json), non più nel checkout corrente.

## Preparare il pacchetto (PowerShell)

Dal checkout pulito e aggiornato di `main`, con Go, Python, Node.js, npm
e i browser Playwright necessari installati:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/release/build_windows_local.ps1
```

Lo script verifica sorgenti pulite, test Go/Python/Node, suite browser (salvo
esplicita esclusione), genera Portable EXE, Setup EXE e ZIP in una cartella
**esterna al checkout**, e verifica gli SHA-256 del manifest. Non richiede
GitHub Actions. Per una build Developer privata utilizzare `-Developer`:
gli artefatti di test Developer **non devono essere distribuiti**.

La build produce metadati Windows e versioni dell'installer dal manifest
canonico, differenziando `Glauka` da `Glauka Developer`. I file sorgente
non vengono riscritti per cambiare variante. La firma Authenticode delle
release pubbliche richiede un certificato affidabile; un EXE non firmato
non è automaticamente distribuibile come build verificata.

## Finestre e import

I dialoghi Apri/Salva nativi sono associati all'HWND della finestra Glauka
(WebView2) quando disponibile, senza applicare uno stato `topmost` globale.
L'apertura multipla è limitata a 30 documenti e a 45 MiB complessivi.
Il filtro comprende `.gk`, `.glk`, `.neuromap`, `.xmind`, `.json`,
`.md`, `.markdown`, `.txt`, `.opml` e `.xml` (OPML).
Il formato FreeMind `.mm` non è ancora supportato dall'importer nativo
come formato strutturato: non viene più presentato impropriamente nel filtro.

I controlli dei monitor ad alto DPI mantengono PerMonitorV2 e un budget di
memoria del canvas; per verificare la nitidezza serve una prova dell'EXE
su monitor reali, non soltanto un controllo del sorgente.
