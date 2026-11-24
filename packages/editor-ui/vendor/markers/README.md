# NeuroMapSymbols

Sottoinsieme di DejaVu Sans 2.37, rinominato NeuroMapSymbols. Include tutti i
caratteri del catalogo `creative-markers.js`, il punto di ripiego e le cifre.
La licenza originale è in `LICENSE.txt` e nei record 13/14 della tabella `name`
del TTF distribuito. Copyright originale conservato nel record 0.

Il font è incorporato come data URI dal preparatore dei bundle e nelle
esportazioni SVG che contengono marcatori. Nessuna richiesta di rete o dipendenza
dai font installati dall'utente. Canvas e pannello usano la stessa famiglia.

Per rigenerarlo con fontTools: selezionare i codepoint presenti nel catalogo,
disabilitare le feature di layout non utilizzate e conservare i record di licenza
0/13/14; rinominare i record 1/3/4/6/16. Verificare che ogni codepoint del catalogo
sia nel cmap prima di salvare il sottoinsieme. fontTools non serve per compilare
l'app: il file già preparato è incluso nel repository.
