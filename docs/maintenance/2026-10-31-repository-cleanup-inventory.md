# Glauka — inventario preliminare per una pulizia sicura

> **Fotografia**: 31 ottobre 2026; `main` = `7c8028dc543d0819a8c18161f0d2e36945993cfe`. Dati letti dall'albero GitHub e da confronti GitHub; non costituiscono una lista autorizzata di cancellazioni.

## Pulizia effettuata: sette archivi ritirati dal main

I sette vecchi archivi compressi sono stati rimossi dal checkout corrente, ma **non dalla cronologia Git**. Prima della rimozione sono stati registrati percorso, dimensione, SHA Git e commit sorgente nel [registro di recupero](legacy-source-archives.json). Uno [script di verifica](../../scripts/release/audit_legacy_assets.py) permette di controllare i blob storici in un clone completo.

- **7 file storici rimossi**: 3.421.897 byte di vecchie copie ZIP e B64 in meno nel contenuto attivo
- Il confronto preventivo degli alberi ha accertato che **nessun altro file** venisse eliminato o cambiato dalla sola rimozione
- **Cronologia, branch, tag, PR, librerie, traduzioni, sito ed evidenze QA** rimangono conservati
- La riduzione complessiva netta del `main` è leggermente inferiore a 3,42 MB perché sono stati aggiunti registro, script, test e documentazione

Per recuperare una copia storica da un checkout completo, senza cambiare branch:

```bash
git restore --source=45434484d4f9c86caa41a22726cbd6ec8386f9d6 --worktree -- apps/windows/legacy/NeuroMap-Desktop-Developer-6.12-source.zip
```

Il ripristino crea un file nel working tree locale; non pubblica nulla. Prima di eseguire l'audit automatico riportare il checkout allo stato pulito: la verifica segnala correttamente come anomala la presenza di vecchi archivi nell'indice corrente.

**Le dimensioni e le indicazioni riportate di seguito sono la fotografia precedente alla rimozione**; non rappresentano il nuovo totale del `main`.
## Dimensioni rilevate (prima della pulizia)

| Gruppo | File | Dimensione | Indicazione |
| --- | ---: | ---: | --- |
| Intero `main` (tutti i blob Git versionati) | 1.413 | **43.569.489 byte (43,57 MB)** | Dimensione esatta del contenuto corrente, non della cronologia Git |
| Codice / HTML / CSS / script per estensione | 868 | 9,69 MB | Include test e librerie: non equivale soltanto al codice applicativo |
| Evidenze `docs/qa/evidence/` | 150 | 12,20 MB | Conservare finché non si verifica il loro ruolo nei report e nei test |
| Screenshot `docs/screenshots/` | 18 | 3,23 MB | Archiviare solo le prove non referenziate |
| Asset e sorgenti sito `apps/website/` | 85 | 7,98 MB | Potenzialmente necessari alla preview e al sito |
| Librerie terze `packages/editor-ui/vendor/` | 12 | 2,43 MB | Non cancellare: verificare dipendenze e licenze |
| Traduzioni `packages/editor-ui/locales/` | 10 | 4,12 MB | Non eliminare: sorgenti della localizzazione |
| Archivi storici compressi sotto `legacy/` | 7 | **3.421.897 byte (3,42 MB)** | **Candidati da esaminare**, non ancora dichiarati inutili |

*Le righe raggruppano percorsi che possono sovrapporsi (es. gli archivi sono inclusi anche nelle app). Non sommare queste dimensioni.* La dimensione `size=627664` dichiarata da GitHub per il repository non rappresenta i soli file del `main`: non usarla per stimare un risparmio certo.

## Tutti i 7 archivi storici da verificare

| Percorso | Byte | Stato |
| --- | ---: | --- |
| `apps/windows/legacy/NeuroMap-Desktop-Developer-6.12-source.zip` | 1.306.743 | Conservare fino alla verifica di riferimenti, provenienza e copia esterna |
| `apps/windows/legacy/NeuroMap-Desktop-Developer-6.11-source.zip` | 1.294.420 | Conservare fino alla verifica di riferimenti, provenienza e copia esterna |
| `apps/macos/legacy/mac-beta-source.zip.b64` | 443.756 | Conservare fino alla verifica di riferimenti, provenienza e copia esterna |
| `apps/android/legacy/neuromap-source.zip.b64` | 350.768 | Conservare fino alla verifica di riferimenti, provenienza e copia esterna |
| `apps/desktop-shared/legacy/neuro615.tar.gz.b64` | 10.517 | Conservare fino alla verifica di riferimenti, provenienza e copia esterna |
| `apps/desktop-shared/legacy/neuro613.tar.gz.b64` | 8213 | Conservare fino alla verifica di riferimenti, provenienza e copia esterna |
| `apps/desktop-shared/legacy/neuro614.tar.gz.b64` | 7480 | Conservare fino alla verifica di riferimenti, provenienza e copia esterna |

**Nota sullo stato storico:** i 3,42 MB erano inizialmente soltanto un risparmio ipotetico; gli archivi sono stati successivamente ritirati (vedere il resoconto in apertura).

**Seconda passata, evidenze QA:** 38 screenshot di grande e piccola dimensione sono stati verificati contro la ricerca dei riferimenti GitHub, e tutti risultano collegati a rapporti QA. Non sono quindi stati eliminati. Per una scansione ripetibile di tutte le immagini si usa `node scripts/maintenance/qa-evidence-audit.cjs --json`; i casi senza riferimenti devono essere riesaminati manualmente.

## Audit ampliato dei branch

La [verifica aggiornata di 48 rami](2026-10-31-branch-review-expanded.md) distingue **34 antenati di main** e **14 divergenti**. Nessun branch è stato eliminato; le 17 voci del campione precedente sono in parte sovrapposte, quindi non sommare i conteggi.

## Branch e PR: audit aggiornato

- Branch trovati: **316**, di cui `main` è uno. PR aperte: **19**.
- Branch confrontati nuovamente con il `main` di questa fotografia: **32**. Di questi, **23** sono antenati di `main` (`ahead_by=0`) e **9** hanno commit esclusivi.
- Fra i 23 antenati, **4** sono head o base di PR aperte e **2** appartengono a prefissi di backup/sicurezza. Restano **17 candidati tecnici alla revisione**. **Questi 17 non sono approvati per la cancellazione.**
- Gli altri branch non sono stati riconfrontati in questa passata: non interpretarli come già integrati.

### I 17 candidati tecnici (solo revisione)

| Branch | SHA osservato |
| --- | --- |
| `audit/ai-flatten-integration-20261023` | `9f4d923a7266059ea73a1c35a26b5456d93a4fcb` |
| `audit/ai-flatten-iterative-20261023-07` | `7a73f32de9b450e798ceb2b9f36b6b1441545361` |
| `audit/atlas-snapshot-regression-20261023-06` | `7a73f32de9b450e798ceb2b9f36b6b1441545361` |
| `audit/atlas-stale-snapshot-20261023` | `1c3112901d3846caba7578f63b13b19520ad8846` |
| `audit/glauka-cloud-concurrent-save-order-20261028` | `4f102af3babab34e5f525537ff94090b10422e64` |
| `fix/android-contextual-format-and-ai-20261028` | `f30c637259fbe8eeffb3a020ce16c81f6b88368c` |
| `fix/android-native-persistence-and-back-20261031` | `da489638e8ecb16c65b5e6e3589a1de69e7dcdfd` |
| `feat/adaptive-clockwise-ui-themes-20261022` | `cb643a87f06edcae08aba8ccfe148a90a6321f90` |
| `feat/adaptive-learning-6191-20261022` | `cbbaecc96239115a43b401e7a31707884ba89b37` |
| `feat/ai-change-review-618-20261022` | `8071a7125e9c7b7d37ce19951910dcd71ccceec1` |
| `feat/android-06-release-hardening-20261027` | `ea4a4773adda449cd740465cfc0974d5f6b1e68a` |
| `feature/android-next-platform-layout` | `a39be010abed7d947fa80625945b077cd43e1afe` |
| `polish/glauka-icon-padding-20261030` | `428e4a923d49bea17a6b22c89c90092ff54f261d` |
| `quality/v7-local-release-gate` | `95ed2047cc0b631d11e60bee2dc8f44212bc7168` |
| `audit/save-preflight-20261023` | `7a73f32de9b450e798ceb2b9f36b6b1441545361` |
| `audit/import-depth-guard-20261023-06-ready` | `efbf140f0980d977b973f10f749d30bf7a1fd3de` |
| `feat/anatomical-vector-gallery-20261028` | `be5e3d51fe83e4c2db8c088bfa7a1f43fd2cd147` |

**Protezione aggiunta:** il comando di pruning ora richiede un file di approvazione esplicita con branch e SHA; protegge anche i rami usati come **base** di PR aperte e i prefissi `safety/`/`build/`.

Prima di eliminare **qualunque** ramo: confermare che non sia usato da un PR aperto, da una release, da una distribuzione o da riferimenti esterni, confrontare di nuovo gli SHA e usare una lista di approvazione esplicita.

## Decisioni raccomandate

1. **Subito e senza perdita di dati:** aggiornare `.gitignore`, eseguire il rapporto di sola lettura e impedire che nuovi ZIP, cache e file temporanei entrino nel `main`.
2. **Successivamente:** archiviare altrove i 7 pacchetti `legacy/` solo dopo controllo di dipendenze e copie recuperabili; non trattare come equivalenti gli asset attivi del sito.
3. **Branch:** audit completo delle 316 refs da un checkout autenticato, protezione sia della head sia della base delle PR aperte, revisione individuale dei 17 candidati.
4. **Solo dopo la verifica:** rimuovere i file dal `main` se opportuno, e osservare l'effetto; **non** riscrivere la storia Git per ottenere subito meno MB.
5. **Sempre:** conservare progetti utente, formati storici, tag, test e licenze; non avviare GitHub Actions.

## Comandi locali di sola lettura

```bash
python scripts/maintenance/repository_footprint.py
python scripts/maintenance/repository_footprint.py --json
python scripts/maintenance/prune_merged_branches.py --json-report ../glauka-branch-review.json
python -m unittest discover -s scripts/maintenance -p 'test_*.py' -v
```

Il comando dei branch richiede un token GitHub presente **solo sul computer locale** in `GH_TOKEN` o `GITHUB_TOKEN`; non inserirlo in chat o nei file del repository. Il rapporto non elimina nulla senza ulteriori autorizzazioni.

Per il metodo generale vedere il [piano di manutenzione](../REPOSITORY_MAINTENANCE_PLAN.md) e la [politica Git](../GIT_WORKFLOW.md).
