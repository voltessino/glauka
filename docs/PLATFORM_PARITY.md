# Funzioni e compatibilità

## Stato corrente — 24 ottobre 2026

`versions.json` distingue desktop/editor **7.4.0-rc.1**, pacchetto Android **0.6.0-rc.1-private** e base storica Android **6.16.0**. Quest'ultima non descrive tutti gli aggiornamenti successivi: `editor_features_scope` ne chiarisce il significato; `shared_modules_version` e `shared_modules` elencano il sottoinsieme di codice condiviso aggiornato. Il gate locale registra entrambe le informazioni. Questi campi non certificano parità completa o collaudo nativo.

- Windows/macOS usano gli stessi sorgenti dell'editor desktop e gli stessi componenti condivisi. Backend, finestra nativa, installazione e gestione file richiedono prove sui rispettivi sistemi.
- Android integra OCR offline, Documento, dashboard, dati Knowledge, grafica e salvataggio/recupero condivisi, con interfacce/adattatori mobili. Corsivo, allineamento e rientro sono ora rispettati anche nel Canvas e nell'esportazione SVG Android.
- La cache delle misure tipografiche, la separazione dei rami con marcatori, i limiti della centratura e lo stato salvataggio/recupero sono condivisi. L'indice del Canvas veloce appartiene all'editor desktop; non si attribuisce ad Android un renderer che non usa.
- I limiti di importazione Android, le funzionalità Developer desktop e la disposizione dei pannelli restano distinti. Verifiche browser/staging/compilazione non equivalgono a prove fisiche Windows/macOS/Android.

Dettagli e prove di questo incremento: [percorso di miglioramento](qa/2026-10-24-main-quality-path.md).

## Riferimento storico — editor 6.15.1

| Funzione editor 6.15.1 | Windows / Mac 6.15.1 | Android Free 0.4 |
| --- | --- | --- |
| Ordine originale dei rami senza ordinamento per altezza | Sì, algoritmo comune | Sì, algoritmo comune |
| Navigazione visiva destra alto→basso, sinistra basso→alto | Sì | Sì, pulsante touch Ramo |
| Lati espliciti nei file XMind JSON/XML | Sì | Sì |
| Anteprima e soglie 80/100/125/150/200 nodi | Sì | Sì, testo/Markdown e XMind esterni |
| Conservazione di note, immagini e lati durante la suddivisione | Sì | Sì, con test |
| Etichette sui recinti | Sì | Sì, modifica touch e salvataggio nel modello |
| Sfondi Notte/Ardesia/Oceano/Carta/Perla | Palette con anteprime in Formato & Stile | Stessa palette in Stile, scelta persistente |
| Distribuzione a passi 25% | Sì | Sì |
| ID dei modelli AI invece del nome visualizzato | Sì | Sì, nei controlli disponibili all'edizione |
| Controlli aggiunti in IT/EN | Sì | Sì |
| Installer con EXE vecchio in uso | Windows 6.15.1 | Non applicabile |
| Swift/WebKit, firma e DMG | Solo Mac | Non applicabile |
| Attivazione Developer e backend Go | Edizione privata desktop | Non inclusi nell'app Free |

## Limiti da conoscere

La UI mobile non replica la disposizione dei pannelli desktop. I backup NeuroMap nativi continuano a usare il percorso originale, per conservare schede, relazioni e metadati; non vengono divisi come semplici outline. Un XMind con metadati NeuroMap nativi segue lo stesso percorso di ripristino. Le altre importazioni XMind usano la nuova anteprima.

Il motore Android mantiene i limiti di sicurezza per file (100 MB), profondità (100 livelli) e singola mappa (3500 nodi). La suddivisione crea schede più piccole; il numero di schede e il consumo di memoria dipendono dal telefono. Gli stili e gli oggetti esterni a quelli supportati dal parser XMind non sono coperti da una promessa di round-trip completo.

I test browser esercitano la UI touch e il modello, senza simulare un dispositivo Android reale o tutto WebKit macOS. Installazione su telefono, dialoghi nativi, tastiera Mac e uso prolungato restano verifiche manuali. Le build debug/private non equivalgono a release firmate per gli store.
