# Review: Editor E3a, the always-on map (PR #641, loka-vduxr.52)

- PR: [#641](https://github.com/lorecrafting/lokacore/pull/641), branch `editor/e3a-map`
- Reviewed commit: `4f88a081baf0443e557d5f3d05e13290272ba476`
- Governing: [editor map and story rulings, E3a table](../design/editor-map-and-story-rulings.md), [editor chrome rulings](../design/editor-chrome-rulings.md), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit 4f88a081b...`): ci success, book-e2e success, graph-diff success.
- `/code-review`: not reported; the PR body is E4a's description (finding 3).
- PM rulings accepted, not raised: rooms are labelled by key; one level shows at a time.

## Must be true (written before the diff)

1. A map click makes the same selection the hierarchy and Book show; a double-click moves the Book; a selection on another level switches to that level.
2. Zoom stays within 0.25 to 3; a pan keeps part of the level in view; `0` fits the level.
3. Level stepping works by buttons and PageUp/PageDown and is announced.
4. Keyboard: one tab stop, arrows move to the nearest room, Enter selects, Escape leaves; each room has a full accessible name.
5. Light and dark use tokens only; the header fits at column width 220 without wrapping or clipping.
6. Author-only: nothing reaches a player build; the Book bridge's origin guards are unchanged.

## Checks that held

- Browser walk (Chrome, toolbox_showcase): the level opens on here's; a click selects with no step; a double-click moved the Book to `boar_run`; Level up/down and PageDown step, and the live region reads "level 0, 36 rooms"; zoom stops at 3, zoom out reaches discs, `0` fits, Ctrl-wheel zooms; a hierarchy pick of `holding_croft` switched to level 1 and inked the ring; Tab enters on the selected room, arrows move, Enter selects, Escape focuses the segment.
- World switch with the picker: `pick_force_sampler` (no layout) lists 3 rooms under "Unplaced (3)"; showcase zoomed in, then `hidden_sampler`, refits with all rooms in view.
- Light and dark screenshots both use tokens.
- Player build: `isolation.test.ts` passes; no package.json change. Origin guards (`book.ts:69`, `mobile/app/author/panel.tsx:219`) unchanged; `visited` rides inside `shown`.

## Mutants

- `bin/mutate_diff.sh origin/main`: 205 mutants, 86 run: 85 red-narrow, 1 survived (map.ts:169, inside a comment, false positive), 119 NO-TESTS (all React files: areamap/mapsvg/mapdraw). No handback table to compare (finding 3).
- Hand mutants on map.ts against `author_map.test.ts`: `nearest` `<=`, `levelOf` returns `z`, `show` `sx > 0` all killed. Three `keep` mutants survived: x lower bound `2 * c - b.x1`, y upper bound `box.h - 2 * c`, and x lower bound `-c - b.x1` (the whole level pans off the left edge).

## Findings

1. **Blocker**: `tools/author-panel/src/areamap.tsx:174-197`. The ruling's test reads "At column width 220 the header's controls do not wrap or clip". At 220 on showcase level -3 with a room selected, the header's scrollWidth is 226 and Go here (206-226) is clipped by 6 px. Level 0 just fits (ends at 219), so any level number of two characters overflows.
2. **Should-fix**: `kernel/ts/test/author_map.test.ts:128`. The `keep` assertion covers only the upper x bound and the lower y bound. Three bound mutants survive, one of which lets a pan lose the whole level. Assert the other two bounds too, e.g. `keep({zoom:1,x:-1000,y:1000}, b, {w:256,h:128})` gives `{x:-64, y:64}`.
3. **Should-fix**: the PR body is E4a's description (#642). It has no `/code-review` result, no mutant table and no E3a claims to rerun. Replace it.
4. **Nit**: `tools/author-panel/src/mapdraw.tsx:211`. At zoom 1 or more the pill repeats the in-box label of the selected or hovered room.
5. **Nit**: `tools/author-panel/src/mapdraw.tsx:155`. The overview disc is `fill-card`, not the ruling's strong fill, so it is faint on the light card.
6. **Nit**: `tools/author-panel/src/mapsvg.tsx:139`. pan() removes its listeners on `pointerup` only. A `pointercancel` (touch or a lost capture) leaves the move listener attached, and the next hover pans the map.
7. **Nit**: `tools/author-panel/src/App.tsx` (`useStory`). A 5xx or network failure replaces the map with one line, the same as a 4xx. The spec only asks for that on a 4xx.

## Open items 1-7 and the 4xx dispute

| Item | Ruling |
|---|---|
| 1. Hulls recomputed every frame | Beads nit (cost not measured; cheap at showcase size) |
| 2. Area altitude belongs to the compiler | Beads nit |
| 3. The 0.25 minimum fit clips showcase level 0 at 280×184 | Beads nit for the designer. It is a spec conflict between the 0.25 limit and the slot size, and the clipped rooms are reachable by panning. |
| 4. Area labels overlap rooms below zoom 1; pills and hulls clip at the slot edge | Beads nit |
| 5. Unplaced lists only rooms with no layout row | Conforms |
| 6. `visited` is empty without a layout | Conforms |
| 7. Header at 220 | Blocker (finding 1) |
| 4xx replaces the map | Conforms ("one line and no map"); the 5xx case is nit 7 |

## Verdict

CHANGES REQUIRED: finding 1 (blocker) and findings 2 and 3 (should-fix).
