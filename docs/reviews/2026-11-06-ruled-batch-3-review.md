# Review: ruled batch 3, map least zoom, second death waits, author note margin, Hotbar story words

- PR: #681 `fix/ruled-batch-3-2026-11-06` (loka-vduxr.77, loka-kgd.218, loka-wfrgk.39, loka-x6t.140)
- Reviewed commit: `f4f561d17022b2a86ee385b859e5d9e57ff4584d`
- Governing: [map rulings, Zoom and pan](../design/editor-map-and-story-rulings.md) (row at :41),
  [book-ui.md Dead page, A second death](../system/book-ui.md) (:786), author note row (:912),
  [WORKFLOW review stance](../WORKFLOW.md#review-stance); author-error guards are nits
- Independence: authored none of the slice; detached review worktree
- CI at head (`gh run list --commit`): ci success, book-e2e success (storybook job green, Hotbar stories pass), graph-diff success
- Developer's `/code-review medium`: reported in the PR body
- Verdict: **CHANGES REQUIRED**

## Must be true (written before the diff)

1. A second death before Let go keeps the first death's title, log and lines on the dead page; the second death's
   lines wait and Let go shows every line from the first death on, in order; its cue still plays.
2. The map's minimum zoom is min(0.25, fit in the current slot), floor 0.1, on every zoom path (keys, buttons,
   wheel, fit); showcase level 0 opens whole at 0.22 in the default slot and `-` there changes nothing; Flow keeps 0.25.
3. A shown author note never covers a Book line: the line under it makes room, and the room goes on hush.
4. The Hotbar stories build and carry showcase words with real glyphs where the shape allows.

## Checks that held

- spirit.ts:38 returns before `woke`/`down` move; presenter.ts:103 sets `down.to` before `fall`; updates.ts:103
  reads `pr.died()` so the said mark moves; cues.ts `fresh` plays the cue; no flip (empty stack). Matches item 1.
- map.ts `least`/`zoomAt` are correct; flow.tsx uses default `M.min`. inbook.ts margin set and cleared on hush.
- Claim reruns: "dropping the `down.to` guard is red" and "`Math.min(min, v.zoom)` -> `min` is red": both red-narrow here.

## Mutants

`bin/mutate_diff.sh origin/main` at head: 2 run, both SURVIVED (presenter.ts:88 `===`->`!==`, `&&`->`||`), not
BASELINE-RED as the PR states. Rerun by hand against offfight_death, spirit and page_life tests: both red-narrow.

| Mutant | Tests | Result |
|---|---|---|
| presenter.ts:88 `===` -> `!==` | offfight_death, spirit, page_life | red-narrow |
| presenter.ts:88 `&&` -> `\|\|` | same | red-narrow |
| map.ts:153 `Math.min(min, v.zoom)` -> `min` | author_map | red-narrow |
| areamap.tsx:96 drop `, M.floor` from `fitted` | panel.test.ts | **SURVIVED** |
| areamap.tsx:110 drop `least(...)` from key/button zoom | panel.test.ts | **SURVIVED** |
| mapsvg.tsx:119 drop `least(...)` from wheel zoom | panel.test.ts | **SURVIVED** |

## Findings

1. **Blocker**, tools/author-panel/src/areamap.tsx:96, :110 and mapsvg.tsx:119: the ruling's own check
   ("showcase level 0 opens whole at zoom 0.22 in the default slot, and `-` there changes nothing") is untested in
   the panel. Dropping the floor from `fitted` returns the old 0.25 clip on open and on `0`, and every test stays
   green; author_map.test.ts passes `M.floor` by hand. Fix: one panel.test.ts case on the showcase level 0 in the
   default slot reading the zoom after open, after `-`, and after a Cmd-wheel out.
2. **Nit**, PR body "Mutants": `mutate_diff` reports SURVIVED, not BASELINE-RED; the hand rows clear it.
3. **Nit**, mapsvg.tsx:119 / areamap.tsx:110: the least zoom is derived twice; one value on `useLevel` would stop drift.
4. **Nit**, inbook.ts:57: a double-click on a line under a shown note moves the line on the first click; inherent
   to "until the next click". The SURVIVED `spaced = el` row is author-only.
5. **Question**, spirit.ts:38: a fight death then an off-fight death before Let go passes the guard (`down` unset,
   `fell` set) and opens a dead page over the closed Combat page. This predates the slice and the ruling is in
   Dead page; not probed. presenter.ts:103 on the press path: is a press reachable while the dead page is up?
6. **Nit**, CombatPage.stories.tsx: flamma takes the fallback glyph; the issue made a scripted slot optional.
