# NeuroMap 6.16.0 Developer — Phase 3: linked Kanban and timeline

## A single tree, multiple derived work views

The same stable node IDs back the mind map, organization chart, concept tree,
semantic workflow, Kanban board and timeline. Changing a view doesn't create
new nodes or infer relationships, states or dates.

- `root.viewMode` may now be `kanban` or `timeline`.
- The existing node fields are extended with **optional** values:
  - `taskStatus`: `todo`, `doing`, `done`, or absent
  - `startDate` / `dueDate`: strict `YYYY-MM-DD` real calendar dates, or absent
- `MindMapStateMachine.setNodeWorkMetadata` validates the edit and records
  one Undo snapshot. Invalid dates or end-before-start are rejected.
  Explicitly clearing a date or status removes the metadata.
- `MindMapStateMachine.cloneTree` persists the metadata through .neuromap,
  workspace restoration and Undo/Redo. The existing JSON v6 format stays
  backward compatible; optional fields are omitted in old documents.
- The timeline never uses the current date, sibling order, a guessed duration
  or an AI estimate to fill missing dates. Undated tasks remain in the
  document but do not appear on the time axis.
- Kanban places tasks without an explicit status in a fourth **Unassigned**
  column rather than treating them as To do.

## UI

The «Visualizza come» switch now offers Kanban and Timeline in addition to
the earlier three alternatives. A shared editor toolbar allows selecting a
node, its status and optionally two dates. Kanban displays four columns
(Unassigned / To do / In progress / Done). The timeline displays only nodes
with valid dates, drawing milestones for single dates and bars for intervals.
Each view can be exported as standalone SVG without changing the original map.

This version focuses on safe **in-place editing**. Dragging cards between
columns, dependencies along the timeline, multiple simultaneous views and
Gantt-style resource management remain separate future enhancements rather
than being implied by these first two read/write projections.

## Tests

- `packages/editor-ui/tests/work-core.test.js`: 6 unit cases
- `packages/editor-ui/tests/linked-views-dom.test.js`: 2 existing flow
  scenarios plus 2 offline simulated-DOM Kanban/timeline tests
- `tests/browser/linked-work.spec.js`: 2 full Playwright desktop scenarios
  covering actual UI metadata updates, project payload and Undo
- `scripts/release/test_prepare.py`: Windows/macOS bundles include the
  new work-core module; Android is not modified

Checks performed while developing: **19/19 unit tests**, **4/4 simulated DOM
tests**, **11/11 native JS state-method assertions** on metadata validity,
cloning and Undo/Redo. Full Playwright on the latest private checkout and
native Windows/macOS installation are not yet verified. GitHub Actions was
not used and remains manual-only.
