# NeuroMap Architect 6.19.0 Developer — Learning Core

**22 ottobre 2026 · Sorgenti Windows/macOS.** Android rimane Free 0.5 con il precedente set di funzioni. Non è stato prodotto alcun nuovo EXE, DMG o APK.

## Map Recall

Il pulsante **🧠 Studio / Learn** apre un pannello con modalità **Map Recall** e **Quiz**.

Map Recall sostituisce temporaneamente le etichette del canvas con punti interrogativi, mantenendo intatti testo originale, identità dei nodi, note, geometria, immagini e struttura. Può nascondere fino a 1.200 titoli sull'intera mappa o nel ramo selezionato. Cliccando un nodo si rivela la sua etichetta. Un comando ripristina tutte le etichette; cambio scheda o chiusura disattivano la maschera. La modalità è solo visiva, non genera Undo e non viene salvata nel progetto. Il pannello Inspector viene chiuso temporaneamente per evitare che le note rivelino subito la risposta.

La mascheratura non nasconde tutte le forme, i collegamenti o i contenuti di ogni altro pannello. Non è un sistema di occultamento sicuro dei dati.

## Quiz offline

Il quiz crea domande senza connessioni AI da:
- flashcard già esistenti con collegamento sorgente ancora valido;
- scelta multipla sui rapporti di filiazione DIRETTA esplicitamente rappresentati nella mappa, senza interpretazioni scientifiche;
- note dei nodi e percorsi gerarchici, con risposta rivelata e autovalutazione manuale.

Le alternative multiple sono etichette della mappa, non asserzioni necessariamente false. Le risposte aperte non ricevono voti automatici. Le risposte corrette e gli errori vengono registrati separatamente dal calendario SRS delle flashcard, che resta invariato.

## Persistenza dei progressi

La cronologia learningAttempts conserva tab ID, node ID, question ID, formato, esito, data e firma del contenuto originale; massimo 2.500 record globali. I risultati sono inclusi nei backup workspace, nei progetti .neuromap, nei JSON esportati e nei metadati proprietari degli XMind desktop, con tentativo di rimappare gli ID quando il documento viene importato. La fingerprint di salvataggio copre anche questi risultati, così una nuova risposta durante una scrittura non viene erroneamente marcata già salvata. Nessuno schema obbligatorio dei nodi è modificato.

## Ambito e limiti

Questa versione realizza la **6.19.0 Learning Core**, non ancora le successive 6.19.1 (Mistake-to-Map, Learning Radar 2.0, Exam Planner) e 6.19.2 (AI Tutor). Non è avvenuto alcun test nativo o Playwright su browser reale, né compilazione di installer. Nessuna GitHub Action utilizzata. I vecchi binari 6.16 del repository non includono queste funzioni. Vedi il QA specifico in docs/qa/2026-10-22-learning-core-619.md.
