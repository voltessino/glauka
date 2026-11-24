# Pannelli impostazioni — verifica locale del 21 ottobre 2026

Base aggiornata: `6cfdcb5` su `main`, compresi i menu recenti. Implementazione: `ecebd66` + `afb0034`. Nessuna modifica di versione e nessuna esecuzione di GitHub Actions.

## Comportamento

- Layout e Testo e stile hanno ciascuno una barra superiore persistente: «Applica a» e «Salva come predefiniti». Eliminati i comandi stella/copia ripetuti per ogni parametro.
- «Questa scheda» è l'ambito iniziale. «Tutte le schede aperte» modifica soltanto i parametri toccati successivamente. Cambiare ambito non cambia le mappe. L'ambito torna alla scheda corrente al riavvio.
- Per testo e colore si sceglie anche il destinatario: selezione, ramo, discendenti, intera mappa o livello. Nell'ambito di tutte le schede sono disponibili mappa e livelli, evitando di usare selezioni arbitrarie di altre schede.
- Gli slider mostrano valore, automatico, assenza di selezione o valori diversi. Ogni trascinamento crea una sola voce di cronologia per ciascuna scheda realmente modificata; Undo/Redo rimangono per scheda.
- Il salvataggio dei predefiniti presenta un riepilogo dei valori e caselle di scelta. I valori misti non vengono salvati. Una revisione divenuta obsoleta non può sovrascrivere le preferenze.
- I predefiniti valgono per nuove mappe/nodi e persistono al riavvio. Il ripristino riguarda soltanto il gruppo del pannello; non modifica le mappe aperte. Android conserva i propri valori originali al ripristino.
- Le vecchie preferenze sono migrate. È stato rimosso il vecchio comportamento che imponeva il profilo tipografico predefinito durante apertura/importazione, sovrascrivendo quello salvato.
- Su Android il controller è condiviso; spaziatura orizzontale e verticale sono reali e conservate in cronologia, autosalvataggio, duplicazione e import/export. I documenti Android precedenti senza questi campi mantengono la spaziatura precedente.
- Le impostazioni di continuazione per nuove mappe non conservano ID degli antenati o limiti minimi misurati su un'altra mappa. Il passaggio a senso orario calcola i limiti indipendentemente per ogni scheda.
- Windows/macOS condividono lo stesso editor composto. Sfondo dell'app e strumenti contestuali mantengono il loro comportamento esistente. Il selettore di ambito riguarda le impostazioni di mappa e nodo gestite dai pannelli.

## Verifiche effettivamente eseguite

Host Linux; Chromium `/usr/bin/chromium`, senza Actions.

| Verifica | Risultato |
| --- | --- |
| `npm test` | 61 test superati |
| `npm run test:build` / unittest release | 14 test superati, inclusa identità dell'editor Windows/macOS |
| Suite browser generale | 669 superati, 2 problemi Android rilevati e poi corretti: inventario dei nuovi slider e valori iniziali nel round trip workspace |
| Riesecuzione mirata di controlli, integrità dati, pannelli, lingua, marcatori e chiarezza UI | 127 superati; 2 segnalazioni di inventario per la nuova dicitura «Automatico», traduzione verificata e inventario aggiornato |
| Verifica finale UI, IT/EN, tastiera, tooltip e pannelli compatti | 65 superati dopo le correzioni |
| Ulteriore verifica dopo affinamento degli spazi e dei selettori | 53 superati |
| Ultima verifica dopo il ripristino specifico Android | 31 test pannelli superati |
| Backend desktop reale con CSP | Chromium: ambito, persistenza selettiva dei predefiniti, riavvio, inglese e pannello stretto senza sovrapposizione allo zoom; nessun errore JavaScript |
| Build Windows locale | Portable e Setup compilati; entrambi verificati contro l'editor incorporato |
| Build macOS locale | Backend Go Intel e Apple Silicon compilati e verificati contro l'editor incorporato |
| Android Gradle offline | `assembleDebug` riuscito; firma APK debug verificata |

I gruppi browser si sovrappongono: i numeri non rappresentano test distinti da sommare. La suite generale non è stata dichiarata interamente verde senza riesecuzione: i problemi individuati sono coperti dalle successive verifiche mirate. Le immagini dei pannelli sono state ispezionate anche a larghezza 390 px; i controlli di zoom non coprono più l'ultimo slider e la barra resta sotto il titolo durante lo scorrimento.

## Limiti

Non sono stati eseguiti l'installer su Windows, l'app nativa su macOS o un'installazione su telefono Android reale. Il DMG, Swift/WebKit nativo e la notarizzazione richiedono un host Mac; l'EXE locale è privo di firma Authenticode. Un tentativo aggiuntivo di avviare WebKit Linux è stato bloccato da librerie di sistema mancanti, quindi non viene dichiarato un test Safari/WebKit riuscito. L'APK compilato usa la firma debug ed è destinato ai test.

I pacchetti e i profili di prova rimangono fuori dal repository; nessuna credenziale, chiave API o chiave di firma è inclusa nei commit.
