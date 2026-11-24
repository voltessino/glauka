# Revisione delle viste desktop — 21 ottobre 2026

## Base e ambito

Allineamento all'ultimo `main`, `bc76ab7` (PR 28–30): organigramma, albero concettuale, flussi semantici, Kanban e timeline. Correzioni applicative nel commit `b3a1732`, nei sorgenti **condivisi Windows/macOS**. Android conserva le sue funzionalità precedenti; queste viste restano desktop, come previsto dai nuovi sviluppi. Versione 6.16.0 invariata. GitHub Actions non utilizzato.

## Problemi risolti

1. **Riapertura del progetto:** l'importatore ricostruiva i nodi senza copiare vista, stato e date. La stessa validazione dei metadati ora viene usata da importazione e snapshot. I test riaprono un vero payload `.neuromap` in tutte e cinque le viste e controllano anche i riferimenti rimappati delle transizioni.
2. **Campi delle attività:** un ridisegno riscriveva i valori di stato e date ancora da applicare. La sincronizzazione ora distingue una bozza da una modifica effettiva ai dati o al nodo di destinazione; le date non valide restano correggibili senza perdere quanto digitato.
3. **Tastiera:** Tab/Invio/Spazio dei nuovi pannelli potevano attivare i comandi di inserimento/rinomina della mappa sottostante. Le viste isolano tali eventi, mantenendo i comandi modificati con Ctrl/Cmd. Le barre timeline sono selezionabili anche da tastiera.
4. **Destinatario Kanban:** Spazio selezionava visivamente una scheda senza aggiornare il destinatario dei campi, rischiando di applicare lo stato all'attività precedente. Mouse e tastiera ora usano la stessa attivazione.
5. **SVG e salvataggio nativo:** il nuovo esportatore usava direttamente un download del browser. Ora passa da `io.triggerDownload`, come gli altri formati, usando il bridge nativo comune. Le etichette Sì/No rispettano la lingua selezionata anche nell'esportazione.
6. **Lingua e contenuti:** le nuove viste gestiscono autonomamente IT/EN, senza sottoporre nomi e percorsi dell'utente al traduttore generico. Sono aggiornate anche le etichette accessibili.
7. **Timeline leggibile:** aggiunte date e guide dell'asse temporale, identiche nell'interfaccia e nell'SVG, derivate solo dalle date esplicite. Rimossi i confronti `indexOf` ripetuti dall'ordinamento: a date uguali resta l'ordine originale.
8. **Finestre basse e molti collegamenti:** il pannello dei comandi ora scorre autonomamente e lascia almeno 100 px alla vista. Con 13 frecce e finestra 844×390 l'area disponibile passa da 29 a circa 126 px.
9. **Comandi coerenti:** rimossa la compressione dei rami dalle schede Kanban, dove il proiettore non la applica. Il comando resta nelle viste gerarchiche.

La scelta del motore di proiezione e la costruzione dell'asse temporale sono condivise tra vista ed esportazione. È stato corretto anche un selettore nel test dei flussi: cercava una classe SVG inesistente invece dell'ID reale.

## Verifiche eseguite su Linux

| Controllo | Esito |
| --- | --- |
| `npm test` | 85/85 |
| Unittest composizione/build release | 15/15, inclusa identità byte per byte dell'editor Windows/macOS |
| Nuovi casi prima delle correzioni | 10/10 fallivano: perdita dei metadati, bozza, tastiera, lingua, percorso SVG e asse temporale |
| Viste, attività, flussi e regressioni dopo il primo gruppo di correzioni | 23/23 |
| Suite browser generale | 700/700 |
| Regressioni sulla versione applicativa finale servita dal backend Go reale | 13/13 |
| Verifica aggiuntiva Ctrl+Z/Ctrl+Shift+Z e Cmd+Z/Cmd+Shift+Z | superata |
| Bridge reale, percorso di esportazione senza File System Access API | richiesta nativa intercettata correttamente; SVG valido con testo inglese; nessun errore JavaScript |
| Controllo visivo | Chromium a 390×844, 844×390, 1440×960; flussi, Kanban e timeline, anche con molti collegamenti |
| Windows locale | Setup e Portable compilati; editor incorporato verificato in entrambi |
| macOS locale | backend Go amd64 e arm64 compilati; editor incorporato verificato in entrambi |

I test generali sono stati avviati dopo le prime correzioni. Gli ultimi affinamenti di selezione Kanban, area dei comandi e fattorizzazione delle proiezioni sono coperti dalla successiva esecuzione dei 13 casi contro il backend reale del commit `b3a1732`. I conteggi dei gruppi si sovrappongono e non vanno sommati come test distinti.

Le build locali dichiarano `sourceDirty=false` e revisione `b3a1732`. Pacchetti, manifest e profili di prova rimangono fuori dal repository. L'esportazione nativa è stata verificata tramite richieste intercettate, senza dichiarare un salvataggio attraverso un dialogo Windows/macOS reale.

## Verifiche native ancora necessarie

Avvio dell'installer su Windows; esecuzione dell'app su macOS/WebKit; produzione/verifica del DMG e notarizzazione su un Mac. L'EXE compilato qui non è firmato Authenticode. Le compilazioni e l'identità dei sorgenti non sostituiscono queste verifiche native e non dimostrano identità pixel per pixel fra i sistemi.
