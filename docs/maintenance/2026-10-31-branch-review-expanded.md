# Glauka — verifica ampliata dei branch (nessuna cancellazione)

**Base di confronto:** `main` al commit `bea09ba74903ac2361634274a55ad42c9fc0b18e`. **Data:** 31 ottobre 2026. Confronto effettivo GitHub `main...branch`; branch e PR ricontrollati immediatamente prima di pubblicare il rapporto.

Il repository contiene **316 branch** e **19 PR aperte**. Fra gli ulteriori 48 rami selezionati e privi di collegamenti head/base a PR aperte, **34 sono antenati di main** (`ahead_by=0`) e **14 divergono** (hanno commit esclusivi). Questo campione amplia il precedente; **non sommare** i risultati con i 17 candidati già citati nell'inventario, perché alcuni nomi si sovrappongono.

**Non sono state effettuate cancellazioni.** Un branch antenato è soltanto un candidato alla revisione: possono esistere link esterni, riferimenti di release o obblighi di conservazione. Prima della cancellazione servono approvazione individuale, controllo degli SHA e verifica delle PR aggiornata. Nessuna operazione di merge, push o GitHub Actions è stata eseguita durante il confronto.

## 34 rami già contenuti in main (possibili candidati, NON approvati)

| Branch | SHA verificato |
| --- | --- |
| `audit/6191-workspace-tests-20261023` | `7a73f32de9b450e798ceb2a9f36b6b1441545361` |
| `audit/ai-flatten-integration-20261023` | `9f4d923a7266059ea73a1c35a26b5456d93a4fcb` |
| `audit/ai-flatten-iterative-20261023-07` | `7a73f32de9b450e798ceb2a9f36b6b1441545361` |
| `audit/atlas-snapshot-regression-20261023-06` | `7a73f32de9b450e798ceb2a9f36b6b1441545361` |
| `audit/atlas-stale-snapshot-20261023` | `1c3112901d3846caba7578f63b13b19520ad8846` |
| `audit/glauka-cloud-concurrent-save-order-20261028` | `4f102af3babab34e5f525537ff94090b10422e64` |
| `audit/glauka-preview-credential-and-tls-guards-20261028` | `e58066836f2e8bb03ac86505aad5d4b17ba521e6` |
| `audit/import-depth-guard-20261023-06` | `054d77c6905a6d749578f7716b4485d8a0a72fc7` |
| `audit/import-depth-guard-20261023-06-ready` | `efbf140f0980d977b973f10f749d30bf7a1fd3de` |
| `audit/iterative-large-import-20261023-04` | `7a73f32de9b450e798ceb2a9f36b6b1441545361` |
| `audit/iterative-subtree-sizes-20261023` | `c3e71ddd926f397f5631e8c2b5cb3aaa9c9b13c2` |
| `audit/reliability-security-20261027` | `9f320b744faa8b8325c31a998aaa6fcd4700f0b5` |
| `audit/restore-pr160-android-export-close-20261028` | `d85f3e5b75f61b58276de319d4782c1a3ae157d3` |
| `audit/restore-v78-canvas-bounds-20261028` | `84154a6d17d60e3f58ac75735edd07ce6e043730` |
| `audit/save-preflight-20261023` | `7a73f32de9b450e798ceb2a9f36b6b1441545361` |
| `audit/save-preflight-guard-20261023-03` | `6018bff135a0d5da9bc1c91a3091edf28b5bd764` |
| `audit/workspace-learning-fixtures-20261023` | `4062a0c8971848c1f4449042a713650a0182e6ce` |
| `feat/adaptive-clockwise-ui-themes-20261022` | `cb643a87f06edcae08aba8ccfe148a90a6321f90` |
| `feat/adaptive-learning-6191-20261022` | `cbbaecc96239115a43b401e7a31707884ba89b37` |
| `feat/ai-change-review-618-20261022` | `8071a7125e9c7b7d37ce19951910dcd71ccceec1` |
| `feat/anatomical-vector-gallery-20261028` | `be5e3d51fe83e4c2db8c088bfa7a1f43fd2cd147` |
| `feat/android-06-release-hardening-20261027` | `ea4a4773adda449cd740465cfc0974d5f6b1e68a` |
| `feat/android-desktop-polish-parity-20261027` | `520690a14c37812880e1c2858e3e4eaec7ed5b8e` |
| `feat/android-one-command-local-apk-20261027` | `0400072712a5e73a2f08b532e899ebc47f647380` |
| `feat/clockwise-continuation` | `8ee81e6780aa6194ce512ed54deade10f203bc16` |
| `feat/cloud-desktop-restore-ui-oct27` | `30ebae9b522c88c1c711d25ff439c6c600afb005` |
| `feat/cloud-native-oauth-20261027` | `00f6998cd7db4555a92c026c3d940b3f19bf1590` |
| `feat/cloud-remote-discovery-20261027` | `11aa604c07350deab203053d22813e9dd3b072b4` |
| `feat/cloud-sync-offline-first-20261027` | `64f8fad8ef27a4eb3be9fec32c3784e75ed9faf6` |
| `feat/context-menu-refresh-20261023` | `6fabf519230b66e6e5b5c28cc0c5a466c498b464` |
| `feat/fluid-layout-universal-drag-20261025` | `4d06c806855de49342f3a784b13f2c9908fbc2cf` |
| `feat/gentle-motion-and-backgrounds-20261026` | `3c6ffe823cc37190e4c0d622a9549f593f797b52` |
| `feat/glauka-branch-geometries-browser-chrome-20261030` | `dd2381c0c40d79d62aa51134c0a4e6211a538616` |
| `feat/glauka-curated-svg-catalog-20261028` | `3ffc35914b6bec1b0706ef4f6f53e14763bebc02` |

## 14 rami con commit esclusivi (conservare per revisione)

| Branch | Commit avanti rispetto a main | SHA verificato |
| --- | ---: | --- |
| `audit/glauka-full-java-go-native-hardening` | 18 | `a110ddbc6f4b9756b67f0c1dd40f1ae4b3016ab8` |
| `audit/glauka-full-release-native-and-tests-20261028` | 17 | `e5d105426d243c508d6d3d34f8879fe78c3cfcef` |
| `audit/glauka-line-by-line-theme-hardening` | 11 | `f0c00c0dac673fc4465371baa3872724a8b0eb24` |
| `audit/main-ocr-review-20261024` | 1 | `218f71be0a09f98ac74a0394d683c49704ee4ba1` |
| `audit/native-go-java-complete-20261028` | 8 | `572e5ce484e133d50323f9ce4d306fba03c8846e` |
| `audit/ocr-candidate-validation-20261024` | 23 | `ca2f774e83080f9dd7f231d65b5411a9f7b87bb3` |
| `feat/ai-change-review-selective-20261022` | 32 | `ffeb661be752669d8c275fd7a652ac626a5211e2` |
| `feat/android-074-responsive-core-port-20261023` | 47 | `f00198a24647339ebe5d640c9677eb7e118a2bb0` |
| `feat/cloud-dock-layout-preview-20261030` | 12 | `a8c060f33aad6c52d8daa491e4e7bf12dd013956` |
| `feat/cloud-layout-ui-polish-20261030` | 12 | `f0051953e7c85c220ae6ebecf60352383ee70bc9` |
| `feat/coherent-workspace-20261024` | 4 | `bba5157dabd95c99020a590375209fae0e1e7dbb` |
| `feat/concept-network-interactive` | 17 | `3593ea221d01ba9ba9ce42ee7d715a29e726c5f9` |
| `feat/desktop-synchronized-split-view` | 9 | `e41e4fb9885267a816c867f28e9881fcaab70078` |
| `feat/document-import-preview-20261023` | 8 | `b3315b0c02f1683a006c143849c6ad8eac246500` |

## Criteri per un intervento futuro

1. Ripetere il confronto con il main aggiornato prima di cambiare i riferimenti.
2. Preservare `main`, backup, safety, release, download e riferimenti usati da PR aperte (head o base).
3. Per gli eventuali rami senza commit esclusivi, esaminare comunque i riferimenti esterni.
4. Usare lo script di manutenzione solo con un file di approvazione separato: `--approved-file` richiede il nome del branch e lo SHA esatto. Questa tabella **non** è quel file.
5. Non eliminare rami divergenti o riscrivere la cronologia Git; non avviare GitHub Actions.

Vedere [inventario completo della pulizia](2026-10-31-repository-cleanup-inventory.md) e [regole Git](../GIT_WORKFLOW.md).
