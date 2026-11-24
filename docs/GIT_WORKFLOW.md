# Git e organizzazione del repository NeuroMap

**Un solo ramo di riferimento:** [`main`](https://github.com/voltessino/neuromap-android/tree/main).
Il monorepo resta privato, con codice distinto per piattaforma e librerie riutilizzabili:

| App | Sorgenti specifici | Condivisione |
| --- | --- | --- |
| Windows Developer | [`apps/windows`](../apps/windows) | `apps/desktop-shared` + `packages/` |
| macOS Developer | [`apps/macos`](../apps/macos) | `apps/desktop-shared` + `packages/` |
| Android Free | [`apps/android`](../apps/android) | `packages/map-core` |

Le versioni sono in [`versions.json`](../versions.json). Dividere questi sorgenti in tre repository separati introdurrebbe tre copie dell'editor comune, rendendo più difficile mantenere ordine dei rami, sicurezza e salvataggi coerenti.

## Nomi e ciclo di vita dei rami

- `main`: unica versione di riferimento per nuove modifiche e compilazioni.
- `feat/<funzione>`: nuove funzionalità, `fix/<problema>`: correzioni, `ux/<area>`: UI e microcopy, `qa/<area>`: test, `refactor/<area>`: manutenzione.
- Aprire una PR verso `main`, verificare i test, poi integrare. Non mantenere un secondo ramo `develop` sempre attivo.
- Dopo il merge, esaminare i commit successivi e rimuovere **solo** i rami completamente integrati.
- Non eseguire mai un nuovo merge indiscriminato di un ramo vecchio: rischia di reintrodurre codice precedente.
- I rami `downloads/` sono riferimenti di distribuzione storica con propria cronologia, non vanno fusi nei sorgenti. Per nuove release preferire GitHub Releases con tag, checksum, commit e note di test.

## Pulizia sicura dei rami

Usare `scripts/maintenance/prune_merged_branches.py` da un checkout locale autenticato.
Lo script è di sola lettura per impostazione predefinita. Per una cancellazione richiede `--apply`, una seconda conferma e un file `--approved-file` contenente le coppie `branch`/`sha` approvate individualmente. Protegge `main`, `downloads/`, `backup/`, `safety/`, `build/`, `archive/`, sia le **head** sia le **base** delle PR aperte, la preview Mac e il ramo Codex ancora divergente. Prima di cancellare controlla che il ramo sia antenato di `main` oppure coincida con il commit esatto di una PR integrata su `main`; verifica nuovamente lo SHA immediatamente prima della cancellazione.

L'accesso GitHub richiesto è quello dell'account proprietario. Non condividere token in chat. Per le differenze attuali vedere l'[inventario](BRANCH_INVENTORY_2026-10-21.md).

La barra «Compare & pull request» di GitHub è solo una proposta UI legata ad attività recente, non la prova che manchi un merge. Soprattutto, **non aprire un'ulteriore PR di `feat/desktop-spacing-images-links` senza confronto**: la sua storia è divergente.

## Test senza costi GitHub Actions

I workflow in `.github/workflows/` sono configurati su `workflow_dispatch` **solo manuale**. Non attivare o eseguire Actions senza autorizzazione. Per test e build locali: [`DEVELOPMENT.md`](DEVELOPMENT.md).

Mai committare token, chiavi API AI, credenziali Developer, chiavi di firma, profili utente o binari privati di rilascio.
