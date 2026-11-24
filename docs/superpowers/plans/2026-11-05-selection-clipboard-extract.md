# Selection/Clipboard Extract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract selection/clipboard methods from desktop and Android `app.js` into `app-selection-clipboard.js` with byte-identical composed editors.

**Architecture:** Mirror `app-tabs.js`: class-body fragment + `/* @neuromap-app-selection-clipboard */` marker spliced by `prepare.editor_sources()`.

**Tech Stack:** Glauka editor JS (concatenated scope), Python `prepare.py`, Node structure tests.

## Global Constraints

- No behavior changes; composed JS must stay IDENTICAL to `18071e0f`
- Do not edit staged `architect.js`; edit sources only
- Keep Free/Developer and offline constraints unchanged
- No GitHub Actions; no merge to `main` without owner approval

---

### Task 1: Extract fragments

- [ ] Create `apps/desktop-shared/editor/app-selection-clipboard.js` with exact methods `visibleSelectionOrder`…`duplicateSelection`
- [ ] Create Android twin with exact Android text
- [ ] Replace those methods in both `app.js` with `/* @neuromap-app-selection-clipboard */\n`
- [ ] Wire `prepare.py` `replace_once` for the marker
- [ ] Extend `test_prepare.py` / syntax-check helpers like `app-tabs`
- [ ] Update FEATURE_MAP + CODE_NAVIGATION
- [ ] Run `compare_editor_bundles.py --base 18071e0f --head HEAD` and `npm run test:structure`
