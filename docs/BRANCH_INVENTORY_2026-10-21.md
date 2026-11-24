# Inventario Git — 21 ottobre 2026

Fotografia del repository privato `voltessino/neuromap-android`: **31 rami**, **26 pull request integrate**, nessuna PR aperta.
Il ramo ufficiale è `main`. Le vecchie PR non devono essere unite una seconda volta.

## Da conservare

- `main`: codice attuale e sorgente per Windows, macOS e Android.
- `downloads/windows-6.16.0` e `downloads/android-0.5.0`: riferimenti dedicati agli artefatti con cronologie indipendenti; **non sono rami sorgente**.
- `macos-private-preview`: anteprima privata storica; conservare finché non è verificata la necessità.
- `feat/desktop-spacing-images-links`: la PR #17 è integrata ma sono arrivati altri commit e la PR #25 è stata integrata su quel ramo, mentre la #26 ha portato i menu su `main`. **Non eliminare o rimergeare alla cieca**.

Gli altri rami sono storici; molti puntano a commit già antenati di `main`, altri hanno SHA diversi per via delle PR integrate. Per rimuoverli è disponibile uno script **con simulazione predefinita** e verifiche sulle PR.

## Riferimenti al momento della verifica

| Ramo | SHA | PR correlata | Stato |
| --- | --- | --- | --- |
| `downloads/android-0.5.0` | `dea97cdeb892` | — | Artefatti Android; cronologia separata |
| `downloads/windows-6.16.0` | `e330afcbee58` | — | Artefatti Windows; cronologia separata |
| `feat/clockwise-continuation` | `8ee81e6780aa` | #16 | PR integrata; storico |
| `feat/desktop-spacing-images-links` | `9ef1c4327602` | #17 | Push dopo PR #17; controllare prima di rimuovere |
| `feat/platform-source-alignment` | `783454a9518e` | #5 | PR integrata; storico |
| `feature/android-next-platform-layout` | `a39be010abed` | #2 | PR integrata; storico |
| `feature/branch-formatting-markers` | `35a4ff67cb35` | #22 | PR integrata; storico |
| `feature/voice-and-map-ai` | `232ca61b13c6` | #21 | PR integrata; storico |
| `fix/adapt-corrective-backlog` | `d6c023c1947d` | #15 | PR integrata; storico |
| `fix/ai-navigation-floating-help` | `14ef3c50ada2` | #24 | PR integrata; storico |
| `fix/background-theme-picker` | `30b5f52b2f1e` | #6 | PR integrata; storico |
| `fix/branch-rendering-and-context-tools` | `ef70875fb2b8` | #20 | PR integrata; storico |
| `fix/compact-inspector-installer-signing` | `1b74ced282a5` | #23 | PR integrata; storico |
| `fix/desktop-6.15-order-theme-mac-keyboard` | `28d0cc63cbfd` | #4 | PR integrata; storico |
| `fix/drag-preview-and-background` | `9424e562bd41` | #13 | PR integrata; storico |
| `fix/macos-6.15.1-dmg` | `68c26f142d5c` | — | Storico senza PR |
| `fix/neuromap-order-menu-large-import` | `93700729e963` | #1 | PR integrata; storico |
| `fix/platform-parity-close-labels` | `229497658404` | #14 | PR integrata; storico |
| `fix/windows-6.14-reliable-save-dock` | `c95e362fc4f1` | #3 | PR integrata; storico |
| `macos-private-preview` | `83681b789d60` | — | Anteprima Mac privata: conservare |
| `main` | `ea6489bf3762` | — | Ufficiale |
| `qa/ai-adversarial` | `fe83a527138b` | #11 | PR integrata; storico |
| `qa/critical-data-integrity` | `65f533dc65a0` | #7 | PR integrata; storico |
| `qa/graphics-centering-export` | `19037f396f24` | #12 | PR integrata; storico |
| `qa/recovery-drag-import-localization` | `7dbe9d630774` | #10 | PR integrata; storico |
| `qa/roundtrip-and-native-engines` | `564604c987a3` | #8 | PR integrata; storico |
| `qa/sliders-and-language` | `52193800b9ec` | #9 | PR integrata; storico |
| `refactor/editor-components` | `16b0a919ae57` | #18 | PR integrata; storico |
| `refactor/editor-organization` | `743e0b4f283b` | #19 | PR integrata; storico |
| `ux/desktop-menus-latest-main` | `a657a105040e` | #26 | PR integrata; storico |
| `ux/desktop-menus-sentence-case` | `570a34cd4a9a` | #25 | PR integrata; storico |

Gli SHA documentano quali versioni erano raggiungibili a questa data. **Se un commit è raggiungibile esclusivamente da un ramo poi cancellato, lo SHA documentato non garantisce che GitHub lo conservi indefinitamente.** Confrontare e archiviare i rami realmente divergenti prima della cancellazione.

Consultare [Politica Git](GIT_WORKFLOW.md) e `scripts/maintenance/prune_merged_branches.py`.
