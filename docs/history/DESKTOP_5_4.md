> Documento storico 5.4. Per installare e compilare le versioni correnti usare [README](../../README.md) e [DEVELOPMENT](../DEVELOPMENT.md).

# NeuroMap Architect Desktop 5.4 — Windows 10/11 (64 bit)

## Installazione e aggiornamento
1. Se hai NeuroMap già aperto, salva un backup **File → Batch JSON** e chiudi tutte le finestre NeuroMap.
2. Esegui `NeuroMap-Architect-Setup-5.4.exe` per installare/aggiornare il programma.
3. In alternativa esegui `NeuroMap-Architect-Portable-5.4.exe` senza installazione.
4. Le mappe locali e le impostazioni rimangono nella cartella `%APPDATA%\NeuroMap Architect`.

## Correzioni 5.4
- Barra superiore adattiva: icone e menu si ridistribuiscono senza sovrapporsi anche con finestra piccola.
- **Ctrl+O** apre il selettore Windows in primo piano tramite una finestra proprietaria; Ctrl+Shift+O non serve.
- **Ctrl+S** salva sul percorso esistente, se noto; per un progetto mai salvato propone un file `.neuromap`. Per duplicare/esportare con altro nome rimane la voce File → Salva con nome.
- Chiusura di una scheda modificata: conferma in stile NeuroMap con Salva e chiudi / Chiudi senza salvare / Annulla. Non più i popup "127.0.0.1 dice".
- **Salvataggio**: risolto il problema per cui il servizio poteva chiudersi 90 secondi dopo la partenza del processo di Edge, causando `Failed to fetch` con la finestra ancora aperta.
- File `.xmind` salvati nel loro formato, con copia di sicurezza alla prima sovrascrittura di un file XMind esterno (`*.before-NeuroMap.bak.xmind`).

## Il significato di "Failed to fetch"
Il messaggio precedente indicava che la pagina non riusciva più a contattare il processo locale che salva i file. Non segnala una chiave API errata o un formato XMind sbagliato. Con la versione 5.4 il server segue gli heartbeat dell'interfaccia, anziché il ciclo di vita del processo di lancio di Edge.

## Altri dettagli
- La chiave API può essere salvata solo con tua scelta esplicita tramite protezione Windows DPAPI.
- I backup Workspace vengono scritti in `%APPDATA%\NeuroMap Architect\workspace-autosave.json`.
- Le chiavi API **non** sono incluse nei file di progetto e nel backup JSON.
- Richiede Microsoft Edge o Chrome installato. L'installer e il programma non sono firmati digitalmente.

## Verifiche svolte
Controlli unitari Go sulle operazioni XMind e API locali; test del browser su finestre da 440 a 1440 px, scorciatoie, popup e navigazione. Compilazione per Windows x64. La prova dell'installer e del comportamento di primo piano della finestra Windows richiede un PC Windows reale e non è stata eseguita in questo ambiente.


## Novità 5.4

- `Ctrl+O` oppure **File → Importa File...** permette di scegliere contemporaneamente più mappe Windows (fino a 18 file, limite complessivo 45 MB). Ogni documento viene importato in una nuova scheda; gli XMind multi-scheda mantengono le proprie schede.
- **Formato & Stile** → **Testo su più righe**: massimo 8–60 caratteri per riga sul nodo o sui nodi selezionati. Valore predefinito 18. `Ctrl+A` seleziona tutti i rami. Il testo originale non cambia.
- **Layout** (pannello compatto in basso a sinistra) → **Testo a capo · mappa**: predefinito per i nodi che non hanno una regolazione personale.
- **Formato & Stile** → cinque geometrie dei rami: Neon, Buzan, Padri spessi, XMind 8 e Minimal. Indipendenti dai temi colore.
- **Illustra** nella barra o **Inserisci → Auto-Illustra Mappa**: cerca icone vettoriali colorate su Iconify. Le nuove illustrazioni vengono incorporate nel nodo, sono presenti nei backup e si vedono offline dopo il download.
- Per una singola illustrazione: clic destro su un nodo → **Cerca illustrazione...**. Non compare alcun suggerimento mentre scrivi.
- Auto-illustrazione per livelli: 1, 1–2, 2, 1–3; le icone esistenti non sono sostituite, salvo richiesta esplicita. Massimo 100 nodi alla volta; puoi interrompere.

### Informazioni importanti sulle icone

La ricerca richiede Internet. Se il termine non è presente nel dizionario locale, NeuroMap invia una breve parola chiave a MyMemory per tradurla; ricerca e scarica le icone da Iconify. Non invia la chiave API dell'AI per queste operazioni. Per ragioni di sicurezza accetta soltanto le risposte SVG contenenti elementi vettoriali consentiti.

I dati dell'illustrazione e il limite di larghezza sono conservati nel formato NeuroMap e nei metadati integrati negli XMind salvati da NeuroMap. I programmi XMind esterni potrebbero non mostrare tutti gli attributi NeuroMap. Mantieni una copia originale degli XMind importanti.

### Test della versione 5.4

Sono stati verificati i test Go del salvataggio XMind, di sicurezza degli endpoint Iconify e della persistenza delle illustrazioni. In Chromium sono stati provati interfaccia, selezione multipla, limiti del testo, Undo/Redo, anteprima e applicazione delle icone con servizi simulati, auto-illustrazione e reimport di progetti. Il selettore nativo Windows, l'installer e le chiamate effettive ai servizi gratuiti devono essere verificati sul PC dell'utente.
