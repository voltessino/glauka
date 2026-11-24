# NeuroMap 6.16.0 — integrazione nel ramo principale

Versione desktop Windows/macOS: **6.16.0 Developer**.
Android: **0.5.0-private-test**, codice versione **5**, funzioni editor **6.16.0**.

- Collegamenti HTTP(S) riconosciuti nel testo dei nodi; rimosso l'editor separato dei link.
- Modalità di disposizione con anteprime, continuazione dalla mappa attuale e limite minimo.
- Selezione più ampia e titoli contestuali dei recinti.
- Simboli, lettere greche e formule LaTeX offline con sorgente modificabile.
- Disegno sulla mappa, forme con testo, gruppi e libreria personale.
- Correzioni a immagini, didascalie, esportazioni e preferenze degli spazi.
- Opzioni del profilo browser dedicato contro sincronizzazione e promozioni Edge.

Le modifiche sono integrate in `main` per proseguire da una base comune. Questo
passaggio non certifica gli installer come stabili: avvio/installazione Windows,
avviso Edge e contenitore Swift/WebKit macOS richiedono ancora prove native.
Nessuna release stabile o tag di distribuzione viene pubblicato automaticamente.
GitHub Actions rimane attivabile soltanto manualmente; le build si eseguono in locale.

I formati dei progetti, le chiavi delle preferenze e i profili dedicati restano
compatibili. Le versioni 6.15.1/Android 0.4 e i loro report restano nello storico.

Verifiche: 530 test browser sulla revisione funzionale, seguiti da 29 test browser
su versioni e strumenti dopo il cambio versione; 46 test Node e 8 controlli di
staging/versionamento. Tutti superati. Le risorse Windows, il bundle macOS e il
versionCode Android sono allineati ai valori in `versions.json`.
