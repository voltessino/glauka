# Conservative Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Complete roadmap steps P0→P1→P4→P3 as sequential byte-identical (or behavior-tested) extractions without changing app behavior.

**Architecture:** Lexical class-body / IIFE fragments spliced by `prepare.py` markers; verify with `compare_editor_bundles.py --include-ui-fragments` and structure/prepare tests after each slice.

**Tech Stack:** Glauka concatenated editor JS, Python staging/comparator, Node `test:structure`.

## Global Constraints

- No behavior changes for pure text splits; composed editors must stay IDENTICAL to the pre-extract commit
- Edit sources only; never staged `architect.js` as source of truth
- Keep Free/Developer and offline constraints unchanged
- No GitHub Actions; no secrets
- Do not run P1–P4 as one combined untested dump

---

### Task 0: P0 baseline gate

- [x] Record HEAD baseline SHA
- [x] Run `PYTHONPATH=scripts/release python3 -m unittest discover -s scripts/release -p 'test_interface_locales.py' -v`
- [x] Run `PYTHONPATH=scripts/release python3 -m unittest discover -s scripts/release -p 'test_prepare.py' -v` (or targeted)
- [x] Run `npm run test:structure` if Node deps available
- [x] Note limits (no full Playwright/native unless executed)

### Task 1: P1 — extract context/find

- [x] Create desktop/Android `app-context-find.js` with exact methods `showContextMenu`…`updateFindResults`
- [x] Replace those methods in both `app.js` with `/* @neuromap-app-context-find */\n`
- [x] Wire `prepare.py`, `compare_editor_bundles.py`, `test_prepare.py`
- [x] Update `docs/CODE_NAVIGATION.md` (+ FEATURE_MAP if needed)
- [x] `compare_editor_bundles.py --base <pre> --head HEAD --include-ui-fragments` → IDENTICAL
- [x] Re-run prepare + structure checks; commit

### Task 2: P1 — extract bindUI

- [x] Same pattern for `bindUI` → `app-bind-ui.js` (desktop + Android)
- [x] IDENTICAL comparator + prepare/structure; commit

### Task 3: P4 — shell Home slice

- [x] Identify contiguous Home/dialog block still in desktop `shell.js`
- [x] Extract with marker; keep Android parity docs
- [x] Tests applicable; commit

### Task 4: P3 — linked-views next fragment

- [x] Choose next contiguous responsibility after `linked-view-export.js`
- [x] Marker in `ui_source`; IDENTICAL UI fragment compare
- [x] Update navigation docs; commit

### Task 5: PR

- [x] Push branch; open/update PR describing sequence, proofs, and remaining risks
