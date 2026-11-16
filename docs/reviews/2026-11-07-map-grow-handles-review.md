# Review: map + handles grow the selected room (loka-wfrgk.104)

- PR: #700 `editor/map-grow-handles`
- Reviewed commit: `c52106699f3fbf69e02be5faf1358b2600009f15`
- Governing: brief in `br show loka-wfrgk.104`; [editor map rulings](../design/editor-map-and-story-rulings.md) (Keyboard row :43),
  [editor chrome rulings](../design/editor-chrome-rulings.md); server grow `tools/author-panel/src/mapedit.ts:146-151`,
  `lib/loka/content/starters/templates.ex:272-294`; [AGENTS.md Writing tests](../../AGENTS.md), [WORKFLOW review stance](../WORKFLOW.md#review-stance)
- Independence: authored none of the slice; detached review worktree
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body
- Lane note: an editor slice (no save, protocol or kernel contract); this record is on `review-700` at the PM's request
- Verdict: **CHANGES REQUIRED**

## Must be true (written before the diff)

1. A + shows on a side only if the room has no exit there and no placed room holds the target cell,
   on any level (up and down are z±1).
2. Activating one runs the existing grow with a free key: exits both ways, a layout row at the target
   cell, the new room selected.
3. Each + is keyboard-reachable with an accessible name; the map's own keys (Enter selects, Shift-Enter
   plays) do not also fire.
4. Drag, Shift-drag and select are unchanged; a press on a + does not start a pan.

## Mutation

`bin/mutate_diff.sh origin/main` at the head: red-narrow 8, SURVIVED 1, BASELINE-RED 10 (the tsx rows, as
in the handback). Hand mutants, `tools/author-panel/test/map.test.ts` run alone (baseline 10/10 green)
and `kernel/ts/test/author_map.test.ts`:

| Mutant | Result |
|---|---|
| `map.ts:236` `down: [0, 0, -1]` -> `[1, 0, -1]` (the sweep's row) | SURVIVED both files |
| `mapsvg.tsx:121` `map.grows(r, d.p.story.map)` -> `map.grows(r, d.l.level)` | SURVIVED both files |
| `mapsvg.tsx:134` pointerdown `stopPropagation` dropped | red (the e2e), as claimed |
| `map.ts:235` `up` as `[0, 0, -1]` | red (the kernel test), as claimed |

## Findings

1. **Blocker** `tools/author-panel/src/map.ts:236` (test `kernel/ts/test/author_map.test.ts:223`): no
   test holds a cell below any room, so a wrong `down` step survives. The handback lists this row as red
   via "not ok 46 - a template dropped on a room…", a test unrelated to `grows` (a flake, not a kill).
   Failure: down's step drifts to `[1, 0, -1]`; a room with a room under it shows a down + and the server
   places the new room at the next x, not below. Fix: a room at z-1 under a tested room.
2. **Blocker** `tools/author-panel/src/mapsvg.tsx:121`: the held cells come from every level
   (`d.p.story.map`), but nothing tests it. Failure: a refactor to the drawn level's rooms (`d.l.level`)
   shows an up or down + over a room on the next level and the suite stays green. Fix: one e2e
   assertion of a missing up or down + over a held cell with no exit.
3. **Should-fix** (PR body): the governing link is book-ui.md "Minimap, Map and presentation controls",
   the player Book. The editor rulings say "Nothing of this enters the Book". The "Proposed Book UI
   text" would put editor handles into the player spec. Fix: cite the editor map rulings and address
   the text to those rulings.
4. **Nit** `tools/author-panel/src/mapsvg.tsx:126` double activation (the brief cites :135): `edit` queues gestures
   (`mapwire.ts:48`) and `grow` re-reads the source file (`mapedit.ts:149`), so a second activation of the
   same + is refused ("… already has an exit east"). It makes no second room. `freeKey` has already
   minted its key, so the next grow skips one number. The PR's "or lands at the next x" does not apply
   to a repeat on the same side.
5. **Nit** (question for the designer) `tools/author-panel/src/mapsvg.tsx:131`: up to six `tabIndex=0`
   stops are added after the map's one roving stop. The rulings keep the slot to "at most four tab
   stops" (rulings :110, Flow row, the map's rule). Not blocking: the brief asks only that the handles
   be reachable.

Checked with no finding: exits both ways and the layout rows for east, up and down (e2e literals,
server `@step` at `templates.ex:276`). The map's Enter and Shift-Enter do not fire on a +. Drag and
pan are untouched outside the +. Chrome tokens only (`fill-background`, `stroke-input`, `stroke-ring`,
`stroke-foreground`). The kernel test's expected lists are hand-checked literals.
