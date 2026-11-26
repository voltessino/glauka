# Zona A — peso morto del sito (piano)

> **For agentic workers:** eseguire task per task. Checkbox per avanzamento.

**Goal:** togliere dal sito selezionato file e script non più usati dalla home Prisma Vivo, aggiornare packaging e test, senza toccare l’editor.

**Architecture:** `package_website_preview.py` / `build_anteprima_update.py` copiano `HOME_FILES` da `home-review/`. La pagina carica solo un sottoinsieme; stub e mappa viva storica restano fuori dal DOM.

**Tech Stack:** HTML/CSS/JS statici, unittest Python packaging, Playwright `playwright.website.config.js`.

## Global Constraints

- Non cancellare `prototypes/`, `prototypes-light/`, `prisma-evolutions/` (archivio + test dedicati).
- Non toccare `apps/desktop-shared`, `apps/android`, `packages/map-core`.
- Aggiornare README locale del sito se elenca file stub.
- Dichiarare prove realmente eseguite.

---

### Task 1: Manifest packaging

- [x] Rimuovere da `HOME_FILES` in `scripts/release/package_website_preview.py`: stub (`features.*`, `downloads.*`, `launch.css`, `site-evolution.*`, `product-guide.*`) e asset morti (`living-canvas.js`, `living-canvas.css`, `story-paths.js`, `story-cinema.css`, `home-en.js`).
- [x] Aggiornare asserzioni in `test_package_website_preview.py` e `test_build_anteprima_update.py`.
- [x] Run: packaging Python OK (9+4).

### Task 2: Sorgenti home-review

- [x] Eliminare i file stub e gli asset morti elencati sopra.
- [x] Togliere i `<script>` di `living-canvas.js` e `story-paths.js` da `index.html` e `home-en.html`.
- [x] Aggiornare `apps/website/home-review/README.md`.

### Task 3: Test browser allineati

- [x] Riscrivere i test Playwright della home sulla DOM attuale.
- [x] Run: suite website Playwright (vedi report commit).

### Task 4: Indice campagna

- [x] Aggiungere `docs/maintenance/2026-11-26-code-review-index.md` e spec/plan in `docs/superpowers/`.
- [ ] Commit + push + PR.
