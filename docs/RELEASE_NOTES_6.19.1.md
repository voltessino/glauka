# NeuroMap Architect 6.19.1 Developer — Adaptive Learning

**22 ottobre 2026 · sorgenti Windows e macOS.** Questa versione si aggiunge alla 6.19.0 Learning Core, alle funzioni AI controllabili della 6.18 e a Source Lens/Atlas 6.17. Android resta alla versione Free 0.5 / funzioni 6.16. Nessun nuovo EXE, DMG o APK è stato costruito.

## 1. Mistake-to-Map

Dal pannello **🧠 Studio → Radar** è possibile vedere gli argomenti con errori registrati nei quiz. Il comando **Evidenzia errori sulla mappa** disegna indicatori temporanei accanto ai nodi originali:

- Rosso: l'ultima risposta osservata a quel nodo è errata.
- Ambra: esiste almeno un errore passato, ma l'ultima risposta è corretta.
- Il numero è il conteggio reale delle risposte errate disponibili (visualizzato fino a 9+).

Gli indicatori **non sono marcatori salvati nel progetto**, non cambiano colori e forme del nodo, non generano uno snapshot Undo e sono rimossi alla chiusura del pannello o al cambio scheda. I nodi rimangono selezionabili dal Radar tramite **Vai al nodo**, usando la navigazione dell'editor.

## 2. Learning Radar 2.0

Aggrega **esclusivamente** le risposte reali dei quiz della scheda attiva e gli orari di ripasso effettivi delle flashcard con origine valida. I risultati il cui contenuto sorgente non corrisponde più alla firma registrata vengono separati come **obsolete**, anziché conteggiati come errori o successi correnti. Si visualizzano conteggi di risposte, successi, errori, date, scadenze SRS delle flashcard e argomenti prioritari.

La priorità dei nodi e le date suggerite di ripasso sono **euristiche deterministiche di pianificazione**, non stime di padronanza né diagnosi della memoria. Non modificano le date dei ripassi spaziati preesistenti e non chiamano alcun provider AI.

I quiz offline della 6.19.0 ora privilegiano gli argomenti con errori o ripassi scaduti, preservando la logica per cui ogni domanda resta collegata al proprio ID originale.

## 3. Exam Planner

La scheda **Esame** permette di scegliere la data d'esame e il tempo di studio quotidiano (10–180 minuti). Mostra una proposta di calendario giornaliero usando i nodi esistenti, gli errori e le flashcard da ripassare, con una stima convenzionale di **7 minuti per concetto**. Le scadenze reali future delle flashcard entrano nel piano nel giorno corretto (o successivo, se la capacità quotidiana è esaurita), mentre le altre sessioni sono suggerimenti euristici. Anteprima dei primi 14 giorni, orizzonte massimo 180 giorni; una data nel passato o non valida viene rifiutata. Il risultato è un **suggerimento locale**, non una prenotazione nel calendario né un promemoria automatico.

Un piano per scheda è salvato facoltativamente in `learningPlans`; l'anteprima non salva nulla. Il piano è associato alla mappa, archiviato nell'autosalvataggio del workspace e nei metadati opzionali dei progetti `.neuromap`, JSON e XMind. La modifica di un piano durante una scrittura asincrona lascia il progetto segnalato come non ancora salvato. Importare lo stesso documento in una nuova scheda associa il piano all'ID della nuova scheda.

## Privacy, sicurezza e compatibilità

Nessun invio dei risultati a server esterni, nessun modello AI aggiunto e nessuna mutazione automatica dei dati della mappa. La cronologia delle risposte introdotta con la 6.19.0 rimane distinta dalle flashcard; i risultati sono contati solo quando la firma sorgente è attuale. Nessun nuovo campo obbligatorio nei nodi. I progetti precedenti possono aprirsi senza `learningPlans`.

## Stato QA

46/46 test mirati superati in ambiente JavaScript isolato con adapter Node/DOM simulato, inclusi stress test di 1.000 scenari. Scenario Playwright `tests/browser/learn-adaptive-6191.spec.js` aggiunto, **non eseguito**. Sono ancora da verificare il runner ufficiale npm, il browser Chromium/WebKit, backend Go e i formati XMind su disco, e i binari desktop. **Nessuna GitHub Action avviata.** Dettagli in `docs/qa/2026-10-22-adaptive-learning-6191.md`.

**Non incluso:** 6.19.2 AI Tutor contestuale e qualunque integrazione cloud/calendar.
