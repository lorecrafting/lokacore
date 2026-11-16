# Review: Editor E3b, map edits in the left column (PR #644, loka-wfrgk.7)

- PR: [#644](https://github.com/lorecrafting/lokacore/pull/644), branch `editor/e3b-map-edits`
- Reviewed commit: `ce86a87c370a16f92adfdd7881355874573f0070`
- Governing: [editor design G6/E3b §3, §5, §11](../rnd/gui-editor-design-2026-11-04.md), [map and story rulings "Left to E3b"](../design/editor-map-and-story-rulings.md), [chrome rulings](../design/editor-chrome-rulings.md), [owner plan](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit ce86a87c3...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body.

## Must be true (written before the diff)

1. Every edit is a sequence of the existing guarded routes (`/change`, `/new`, `/move`, `/undo`); no write escapes the cartridge; author-only.
2. Undo of every gesture leaves the files byte-identical.
3. A new room from here is `~`, linked both ways, placed beside its source.
4. Move to another area keeps the cartridge compiling; a barrier between two rooms of one area lives in that area.
5. Every refusal shows (owner promise 3); no modes; E3a's click-to-select, Alt-click and keyboard map still work.
6. Cards hold no logic; each edit is a plain function with node:test cases.

## Checks that held (real Chrome, copy of toolbox_showcase via the world picker)

- Drag 4 px moves the row; a taken cell is refused on the footer (`shepherd_hut is in that cell`, persists 3 s: `e3b-fable-3b-refusal-fast.png`).
- Shift-drag writes both faces; a second draw is refused.
- Palette: new room from here (`~`, both faces, placed east), one-way toggle, lock refused on a one-way exit (`e3b-fable-6-oneway-lock-refused.png`), lock written as `areas/tidewater/barriers/rv_lock.json` named on both faces, move to `fell_road` compiles. Five undos: byte-identical, no stray folder.
- API undo of the drag, link and chip edits: the copy matches `toolbox_showcase` except `cartridge.json`.
- Cites rerun: `cartridge.md:940-959` lists the four routes; the "refused second face leaves the first" claim is `author_mapedit.test.ts:99`, green.

## Mutants

`bin/mutate_diff.sh origin/main`: 87 mutants, 41 run, 39 red-narrow, 2 SURVIVED (`mapedit.ts:59-60`, `>` to `>=`, equivalent as the PR says), 46 NO-TESTS (UI wiring). Matches the handback. Hand mutants on `mapedit.ts`, all red against `author_mapedit.test.ts`: `path: [rows.length]` (append over replace), `const area = null` (barrier at the root), `undo(io, [])` (no put-back).

## Findings

1. **Blocker**, `tools/author-panel/src/mapsvg.tsx:156`. `drag()` captures the pointer on every room press; Chrome then dispatches the ending `click` to the capture target, so the room's `onClick` at `:93` never runs. A mouse click on a room no longer selects it (`e3b-fable-9-click-select.png`: the inspector stays "Select a definition…"; keyboard Enter selects), Alt-click open is dead, and every palette map command answers "Select a room on the map first". On `origin/main` `pan()` returned early for a room press. Fix: pick in `up()` when the move is under `DRAG`, or listen on `window` instead of capturing; add one check for click-selects (the one UI test this slice needs; the rest of open item 1 is Beads).
2. **Should-fix (Beads)**, `tools/author-panel/src/areamap.tsx:149` `drop()`. The Unplaced strip never shows in a compiling cartridge: `layout_stale` (`lib/loka/content/explain.ex:135`) is a compile error and `/story` builds rooms from the last good artifact, so a room whose row was removed by hand is not in the strip and cannot be placed by drag. Needs the story model to read rooms from source when the artifact is stale.
3. **Should-fix (Beads)**, `tools/author-panel/src/mapwire.ts:27-40`. `prompt()` for area, direction and name. Acceptable for this slice: E2 set the precedent (`App.tsx:275`), no ruling forbids it, the tool is author-only. Replacement: palette argument rows like the rulings' `trace <key>` and `beat <n>`, one row per free side of the selected room (`new room from sea_cave east`), so a direction cannot be mistyped. `alert()` stays for the unmounted-map fallback.
4. **Should-fix (Beads)**. Drag lock from the owner plan ("drag with a lock; locks live in the editor (browser storage)") is not in this slice and not in "Left to E3b": a 4 px slip on a room writes `layout.json`.
5. Nit, `areamap.tsx:126`. `tell('')` on every story refetch: a compile from the previous gesture landing after a refusal clears that refusal (seen at 1.5 s in the walk).
6. Nit, `areamap.tsx:140`. The footer refusal has no circle-alert icon (chrome rulings, refusal at the field).
7. Nit, `mapedit.ts:64`. A drop on the room's own cell writes an identical row and a journal entry with no change.
8. Nit, `areamap.tsx:125`. `shown.rooms` is assigned during render.

Open items ruled: (1) fix now for finding 1 only; (2), (3), (4), (5) author-side, Beads; (6) accepted, E4b; (7) hover card and drag preview, Beads.

## Verdict

CHANGES REQUIRED. Finding 1 blocks; the others are Beads items.
