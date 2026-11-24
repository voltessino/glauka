# Glauka — Fondamenta per le viste collegate (2026-11-03)

Branch: feat/linked-view-appearance-20261103
Commit base: e9cadc55b8d5bf70a24ab4b1cd8aa6ae3be3e0ef.
Non fare merge automatico. Il sito rimane indipendente. Aggiornamento 2026-11-03: il branch della selezione multipla `feat/multiselect-drag-handoff-20261103` è stato **integrato solo nel branch delle viste** con il merge commit `7208227`; `main` non è stato modificato. La roadmap corrente è [GLAUKA_LINKED_VIEWS.md](../roadmap/GLAUKA_LINKED_VIEWS.md).

## Audit iniziale

| Vista | Funzioni già presenti | Restano da completare |
| --- | --- | --- |
| Organigramma | Gerarchia e link ortogonali, modifica, espansione | Assi verticali/orizzontali, reparto, foto e icone |
| Albero concettuale | Classificazione gerarchica, editing, espansione | Gruppi, categorie e profondità grafica |
| Rete concettuale | Drag manuale persistente, relazioni etichettate | Cluster, auto-layout robusto e stili dei link |
| Flusso di lavoro | Relazioni esplicite e transizioni Sì/No, cicli | Rombo reale, terminatori, porte e collegamenti intelligenti |
| Kanban | Stati e drag mouse/touch, operazioni sul nodo condiviso | Colonne, priorità, etichette, riordino stabile |
| Timeline | Date reali, barre, dipendenze e conflitti | Scale, milestone, categorie e zoom semantico |

Il flowchart non deve dedurre transizioni dall'ordine dei rami. La timeline non deve inventare date.

## Codice scritto in questo branch

- packages/editor-ui/view-appearance-core.js: modello di presentazione validato, con API clean, update, resolve, palette e applyDensity; 4 temi per ogni vista (Studio, Aurora, Paper, Graphite), override per singolo nodo.
- apps/desktop-shared/editor/state.js: root.viewAppearance viene clonato nei snapshot, nel salvataggio di progetto e negli Undo/Redo. I vecchi documenti senza il campo restano compatibili.
- scripts/release/prepare.py: il nuovo modulo entra nel bundle desktop prima di linked-views.js.
- packages/editor-ui/linked-views.js: pannello compatto «Aspetto della vista», scelta tema, colori e densità, possibilità di intervenire sul singolo nodo; rendering sia principale sia affiancato.
- packages/editor-ui/linked-view-export.js: gli stili vengono riportati nell'SVG.
- packages/editor-ui/tests/view-appearance-core.test.js, view-appearance-persistence.test.js e linked-views-dom.test.js: prove di sicurezza, isolamento, persistibilità, DOM e SVG.

Modello: root.viewAppearance.version=1; root.viewAppearance.modes[mode] contiene preset, colori, fontSize, radius, density ed eventuali elements[nodeId]. Le impostazioni restano di presentazione: non modificano node.text, node.color, notes, relazioni, status o date. I colori condivisi del nodo rimangono visibili salvo override cromatico esplicito.

Validazione: colori #RRGGBB, font 10–18px, raggio 4–24px, densità 0.85–1.4, massimo 80 override per vista. Gli identificatori pericolosi di proprietà oggetto sono esclusi.

## Verifiche eseguite

Mediante esecuzione isolata delle vere sorgenti JS recuperate da GitHub, con mock di Node e del DOM: 5 test del modello puro, 70 test DOM (inclusi nuovi controlli e export SVG), 2 test di clonazione/JSON/Undo/Redo, controllo di compilazione sintattica del renderer assemblato e di state.js.

Non sono stati eseguiti nel checkout reale: npm test completo, Playwright con browser reale, EXE, DMG, APK, PDF/PNG, immagini comparative prima/dopo, benchmark nativi, apertura di veri progetti multipiattaforma. I test simulati non valgono come certificazione di rilascio.

## Prossimi passi per Codex

1. La selezione multipla Codex della PR #219 è già inclusa nel branch delle viste (merge `7208227`); non mergiare `main` automaticamente. Prima di ogni merge finale, ricontrollare eventuali nuovi commit di `main` e i conflitti.
2. Eseguire npm test, npm run test:structure, npm run test:build e test browser pertinenti, localmente e senza GitHub Actions. Controllare che il bundle carichi il nuovo modulo prima dei controller.
3. Verificare la compatibilità .gk su file vecchi e nuovi, la riapertura di schede e il versionamento Undo/Redo, anche con split view e SVG.
4. Completare le sei viste per fasi: Organigramma/Albero, Rete/Flusso, Kanban/Timeline. Non rifare funzionalità già esistenti.
5. Esaminare il percorso di export PDF/PNG: non promettere la parità con SVG prima di averla implementata e testata.
6. Android richiede una progettazione mobile touch-first. Non trasferire direttamente l'overlay desktop senza una verifica del supporto esistente.
7. Acquisire screenshot reali prima/dopo per le sei viste sullo stesso progetto demo; testare 100/500/1000 nodi rispettando i limiti dei proiettori.

## Criteri di successo

Le sei viste devono essere strumenti differenziati e usabili, con metadati isolati dal contenuto canonico, esportazione coerente e nessuna regressione sulla mappa mentale o nei layout Orario, Bilanciato e Fluido. Evidenziare ogni test non eseguito.
