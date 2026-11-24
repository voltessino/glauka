# Origine degli SVG anatomici — Health Icons (CC0)

## Provenienza e licenza

Gli oggetti anatomici di Glauka introdotti in questa integrazione sono
adattamenti dei **percorsi vettoriali** del progetto
[Health Icons](https://healthicons.org/), mantenuto nell'ambito di
[Resolve to Save Lives](https://github.com/resolvetosavelives/healthicons).

La raccolta di icone Health Icons è distribuita con **Creative Commons Zero
1.0 Universal (CC0 1.0)**, che consente la modifica e l'inclusione in prodotti
commerciali senza obbligo di attribuzione. Questo file conserva
volontariamente il riconoscimento delle fonti e facilita il controllo futuro
della provenienza.

Riferimenti di licenza:
- https://github.com/resolvetosavelives/healthicons
- https://creativecommons.org/publicdomain/zero/1.0/

## File sorgenti e adattamenti

Tutti i file sono nella directory
`public/icons/svg/filled/body/` del repository di Health Icons, ramo
`main` consultato il 28 ottobre 2026.

| Oggetto Glauka | File originale Health Icons | Adattamento |
| --- | --- | --- |
| Cuore | `heart-organ.svg` | Colori distinti per corpo dell'organo e vasi principali |
| Polmoni | `lungs.svg` | Palette rosea, vie aeree con colore contrastante |
| Cervello | `neurology.svg` | Palette cerebrale e sfondo a bassa opacità |
| Reni | `kidneys.svg` | Palette rosso-marrone, contrasto tra reni e componenti vascolari |
| Fegato | `liver.svg` | Palette epatica calda, sfondo a bassa opacità |

I tracciati anatomici di base provengono integralmente dagli SVG
originali; sono stati **ricolorati, scalati e inseriti in un disegno di
cornice vettoriale** (alone leggero e cerchi non anatomici). Non sono
state aggiunte strutture anatomiche inventate.

Codice incorporato (nessuna chiamata a Health Icons a runtime):
`packages/editor-ui/creative-core.js`, dati `anatomyBodies`.

## Accuratezza e limiti

Questi sono **simboli anatomici schematici** adatti a decorare mappe e
aiutare il riconoscimento visivo, NON illustrazioni per diagnosi, referti,
identificazione fine di tessuti, anatomia chirurgica o sostituzione di atlanti
anatomici verificati. In particolare il simbolo «Reni» contiene entrambi
gli organi, non una sezione renale di dettaglio.

Prima di introdurre disegni più dettagliati è necessaria una verifica
anatomica dedicata; non presentare queste immagini come schemi esaustivi.

## Prestazioni e conservazione

Gli SVG sono archiviati localmente e serializzati come data URI, usando
`objectArt.id` e una dimensione numerica limitata a 64–220 px.
Nessun download o tracciamento al momento di inserire un organo.
I tracciati rimangono vettoriali; alcuni importatori SVG terzi potrebbero
richiedere l'espansione manuale degli SVG incorporati.
