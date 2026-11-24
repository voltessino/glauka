# Componenti dell'editor

**Guida semplice per trovare le funzioni:** [Inizia da qui](../../docs/START_HERE.md). I file di questa cartella sono spiegati per problema dall'[indice delle funzioni](../../docs/FEATURE_MAP.json). Non spostare un componente senza verificare entrambi gli editor e i relativi test.

`theme-picker.js` crea la palette degli sfondi nel pannello Formato & Stile, condivisa da Windows, Mac e Android. Include anteprime, stato selezionato, navigazione da tastiera e nomi IT/EN. Il componente non gestisce dati utente o persistenza: passa il tema scelto al callback dell'app.

`scripts/release/prepare.py` lo incorpora nell'HTML desktop o lo copia tra gli asset Android. I valori `night`, `slate`, `ocean`, `paper`, `pearl` e la preferenza salvata dalle versioni precedenti restano compatibili.

`creative-core.js` contiene riconoscimento URL e primitive SVG serializzabili;
`creative-tools.js` integra modalità di disposizione, titolo dei recinti, simboli,
formule LaTeX e disegno nei due editor. I dati modificabili sono conservati nel
campo `graphic` delle immagini, attraverso gli stessi percorsi di salvataggio,
annulla/ripristina e importazione delle immagini esistenti. `layoutMode` rimane nel
nodo radice; le copie della continuazione restano rappresentazioni visive.

Il motore MathJax in `vendor/mathjax` è incorporato durante lo staging, con licenza
e provenienza conservate nella stessa directory. Non richiede una CDN. La libreria
personale usa localStorage; gli elementi inseriti in mappa sono parte del progetto.

Le regressioni delle nuove interazioni sono in `tests/browser/creative-tools.spec.js`;
`npm test` verifica anche le primitive e i dati, `npm run test:build` controlla la
parità degli HTML Windows/macOS e la disponibilità degli asset nel contenitore Android.

Gli strumenti creativi sono composti in ordine da `prepare.bundles()`:
`creative-ui.js` (controlli comuni e link), `creative-formulas.js`,
`creative-boundaries.js`, `creative-drawing.js` e `creative-tools.js` (integrazione).
Le dipendenze passano attraverso `NeuroMapCreativeModules`. Il CSS è in
`creative-tools.css` e viene incorporato nello stesso bundle offline: Android
mantiene gli URL già autorizzati e il desktop mantiene la propria CSP.

Lo staging sostituisce soltanto marcatori espliciti, verificati come unici.
Installazione dei componenti ed esportazione immagini sono dichiarate nel sorgente
HTML, senza riscrivere frammenti JavaScript durante la build. I controlli creativi
si aggiornano quando cambiano i dati pertinenti; il riconoscimento URL usa una
cache debole invalidata quando cambia testo o collegamento del nodo.

## Galleria di oggetti anatomici schematici

La sezione «Inserisci e disegna → Oggetti illustrati» mostra 3 oggetti
decorativi e 5 simboli anatomici (cuore, polmoni, cervello, reni, fegato),
raggruppati tramite filtri Tutti/Oggetti/Anatomia. Il disegno del nodo
usa lo stesso `NeuroMapCreativeCore.objectSVG` della preview e dello
SVG esportato, mentre `measureNode` riserva lo spazio per immagine
vettoriale e titolo. I singoli oggetti vengono identificati dal solo
`objectArt.id` e da `objectArt.size` (64–220 px), senza salvare SVG
arbitrari provenienti da mappe di terzi.

Gli SVG anatomici sono adattati da **Health Icons, CC0 1.0**; provenienza
e limiti educativi sono registrati in
`docs/third-party/healthicons-anatomy.md`. Si tratta di simboli
illustrativi e non di tavole anatomiche diagnostiche. Tutti gli
asset sono offline, inseriti nel bundle condiviso Windows/macOS/Android.
I test di regressione `packages/editor-ui/tests/curated-object-art.test.js`
e `tests/browser/curated-object-art.spec.js` coprono catalogo, geometria,
filtri e salvataggio/Undo.


## Catalogo SVG Glauka: 636 illustrazioni offline

La Libreria Creativa include **636 SVG** selezionabili e serializzati con un ID stabile:
**8 disegni classici**, **213 asset di collezioni curate**, **80 simboli originali Glauka**
e **335 nuovi pittogrammi Lucide**. I nuovi disegni sono
in `object-gallery-parts-glauka.js`, con nomi italiani/inglesi, parole chiave,
geometria SVG e provenienza `glauka/`. Non richiedono Internet.

Le principali aree coperte dagli 80 SVG: studio e università, anatomia e salute,
tecnologia e cloud, diagrammi e processi, lavoro e progetti, luoghi,
sport e movimento, alimentazione e natura. Nella galleria, **Nuovi SVG ✦**
filtra i simboli originali Glauka e i nuovi pittogrammi Lucide. Ricerca e paginazione continuano a mostrare
24 anteprime alla volta, con «Mostra altri» e conteggio risultati.
I termini di ricerca usano nomi IT/EN, ID e sinonimi controllati.

I vecchi ID non vengono rinominati e la mappa salva soltanto
`objectArt: {id,size}` anziché incorporare il markup SVG. Le stesse risorse
sono usate da canvas, esportazione e anteprime per Windows, macOS e Android.

Sono disponibili anche **127 marcatori rapidi** (79 già esistenti più 48
nuovi, nei gruppi Logica, Progresso, Comunicazione e Scienze avanzate),
applicabili a un massimo di tre per nodo con Undo.

**Attribuzioni:** i file `object-gallery-parts-*.js` precedenti conservano
le rispettive licenze/notice (Health Icons CC0 e Icons8 MIT). Le
80 sagome `gl-` sono originali Glauka. I **335 SVG `lc-`** sono pittogrammi
Lucide (ISC, inclusi i simboli derivati da Feather con nota MIT); le licenze
sono in `docs/licenses/LUCIDE-ISC-LICENSE.txt`. Tutte le icone sono incorporate
offline, senza CDN o script remoti. Il pannello illustrazioni mostra
la provenienza corretta in base a `source`; non attribuisce a terzi i nuovi SVG.

Il preparatore `scripts/release/prepare.py` include i 21 moduli `object-gallery-parts-lucide-*.js`
dopo quelli Glauka e prima del registro `object-gallery-healthicons.js`.
L'ampliamento usa categorie, ricerca e griglia preesistenti: non crea 335 richieste
HTTP o file SVG separati da scaricare, e il documento salva soltanto ID/dimensione.
La validazione continua a escludere SVG arbitrari, script, immagini remote e
ID sconosciuti.

## Libreria creativa unificata e finestre con colori del tema

Da questo intervento, il percorso `Aggiungi → Libreria creativa` apre
**una sola finestra** con le schede **Simboli / Icone / Oggetti SVG /
Personali**. Non sono quattro overlay sovrapposti: le schede cambiano
il contenuto del medesimo dialogo e riusano senza duplicarli
`objectDialog` e `libraryDialog` in modalità incorporata.
Gli accessi preesistenti ai marcatori `nm62OpenAssets()` e alla
galleria emoji `nm62OpenAssets('gallery')` portano alla scheda
corrispondente, preservando Undo/Redo e i dati del nodo.
I simboli greci e matematici modificano il testo del nodo; i marcatori
rimangono limitati a tre; l'icona emoji usa `node.illustration`,
mentre gli SVG curati usano `node.objectArt`. Gli elementi personali
continuano a usare la libreria locale e `state.images`.

Desktop e Android condividono questa UX. Le finestre di inserimento,
formule e disegno derivano sfondo, bordi, pulsanti, testo e campi
dalle variabili `--nm-skin-*` e `--nm-theme-*`. I colori scelti
dall'utente per formule e disegni non vengono sovrascritti dal tema.
Il colore iniziale della formula è ricavato dall'inchiostro della
skin (normalizzato per i campi HTML color), non dal tema della
mappa, che è una preferenza indipendente.

Per la regressione: `tests/browser/unified-creative-library.spec.js`
e suite esistenti aggiornate per i nuovi accessi. Il collaudo
visivo reale delle build desktop e Android rimane un gate separato.
