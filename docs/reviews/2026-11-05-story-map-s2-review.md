# Review: Story map S2, the List view and Trace in the map slot (PR #646, loka-wfrgk.18.2)

- PR: [#646](https://github.com/lorecrafting/lokacore/pull/646), branch `editor/story-s2`
- Reviewed commit: `9c4300762c805d4482eb09b13963e790eeab0642`
- Governing: [map and story rulings, slot and S2](../design/editor-map-and-story-rulings.md), [story map design, S2 row, 4.2, 5d, section 12](../rnd/story-map-design-2026-11-05.md), [editor chrome rulings](../design/editor-chrome-rulings.md), [cartridge.md Content reports](../system/cartridge.md#content-reports), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit 9c4300762c80...`): ci success, book-e2e success, graph-diff success.
- Merge: `git merge-tree --write-tree origin/main <head>` is clean; the head has every origin/main commit.
- `/code-review medium`: reported in the PR body.

**Verdict: CHANGES REQUIRED** (two blockers, both small).

## Must be true (written before the diff)

1. One `role="tree"`: parts, beats (status swatch and word, missing refs in title and name), bound nodes (refusals, `~`, unreached), Seeds, Unplaced.
2. Trace lists every place a fact is set and every place it is read (design 4.2 counts `fact.stamp` as `sets`), each with its beat; `never set` / `never read` / `unused` agree with the report.
3. Trace opens from the row button, `f` and Cmd-K `trace <key>`; at most half the slot; a row click selects and reveals; tracing sets no selection; Esc or `×` closes.
4. Selection is one value across map, hierarchy, Book, inspector and list.
5. Keys per the S2 Keyboard row; Cmd-K `beat`, `story:`, `trace` entries focus their row.
6. No write route, chrome tokens only, author mode only, no player-facing words from agents.

## Findings

- **Blocker B1** `kernel/ts/play/reach.ts:30-33`: `isWrite` omits `fact.stamp`. The edge from `reaction/sow` (`steps[3]`, `fact.stamp`) to `fact/sown_at` carries no `set`. Toolbox showcase: Trace `sown_at` shows `never set`, `read at plot`, `read at sow` (shot `s2-review-dark-3-trace-sown_at.png`); `orphan_facts.read_only` lists `sown_at` too. Fix: count `fact.stamp` in `isWrite`, list it in cartridge.md Content reports, add a stamped-fact case to `story.test.ts` or `content_graph.test.ts`. Elixir already counts it (`lib/loka/content/position.ex:48`, `lib/loka/content/lint.ex:11`), so the TypeScript report disagrees with the compiler; after the fix `sown_at` leaves `orphan_facts.read_only`.
- **Blocker B2** `tools/author-panel/src/storylist.ts:240`: the topic clause is untested. Hand mutant `fromRef(e.from)?.kind === 'topic'` -> `false` stays green against `author_story.test.ts`. Failure: a topic's fact loses its codex read, and Trace says that only the topic sets it. Fix: add a topic edge to the planted Trace test.
- Nit N1 (Beads) `storylist.ts:240` vs `reach.ts:35`: the read rule is written twice. Once B1 lands, have `reach.ts` emit the read flag next to `set` and drop the local copy.
- Nit N2 (Beads) `storylist.ts:122`: a duplicate beat `n` gives duplicate row ids, so React drops rows. This is an author error, and the owner is the sole author.
- Nit N3 (Beads) `storylist.tsx:228,217`: localStorage is written on every scroll event, and `L.rows` is rebuilt on every render. No failure seen at 371 rows.
- Nit N4 (Beads) `storylist.tsx`: no unit harness. 43 view mutants survive (handback agrees). The walk below covered click, keys, Trace, sync and reload.
- Question Q1: the PR body says the Knowledge and Pacing rows (with their rulings tests) are "deferred by decision". The reviewer found no record in HANDOFF, Beads or the rulings. PM to cite the decision; without one, the missing rows block as unmet S2 scope.
- Question Q2 `reach.ts:28`: service `.benefit.account` (deposit and withdraw write the savings fact) is not in `SITES`. That list is outside design 4.2, so this is not part of this slice. PM to decide.

## Checks that held

- Real Chrome (`channel: 'chrome'`, `?dev=1`, toolbox_showcase, light and dark):
  - Story segment: 371 rows, `Unplaced (370)` open, `dim` note.
  - Keys: Right, Down and Up work; Enter selects, and hierarchy and inspector follow. Hierarchy click on `chop` reveals and selects its list row.
  - Cmd-K: `trace sown_at` opens Trace with selection unchanged; `story: sown_at` focuses the row; `f` traces.
  - Trace: clicking the `sow` row selects it in the list, scrolls to it, and the inspector follows. Esc closes Trace, and a second Esc focuses the Story radio. `×` closes. Cmd-F passes through.
  - Trace `wheel_1` (23 edges): the section is 120px in a 240px slot (half) and scrolls (scrollHeight 452).
  - Not walked: sync from a Book selection to the list (no Book at the head was running).
  - Reload keeps the segment.
  - The one 404 is light only and was not traced to this slice.
  - Shots: `s2-review-{light,dark}-{1-list,2-selected,3-trace-sown_at,4-palette-story}.png`, `s2-review-light-5-trace-click.png`, `s2-review-light-6-trace-wheel_1.png`.
- No `fetch` or POST is added; Alt-click reuses `/open`. No hex is added; `hatch` uses tokens. Nothing under `mobile/app` changes.
- PR claims rerun: `story.ts:232` `!==`->`===` is red on "a beat lists its bound nodes once each"; the Trace dedupe mutant (drop `x.set === e.set`) is red on "Trace follows a fact". Both back the body.

## Mutants

`bin/mutate_diff.sh origin/main`:

| Mutants | Run | red-narrow | SURVIVED | NO-TESTS | TIMEBOX |
| --- | --- | --- | --- | --- | --- |
| 124 | 122 | 79 | 43 | 2 | none |

- Every SURVIVED row is in `storylist.tsx`.
- Both NO-TESTS rows are in `App.tsx:182-183`.
- This matches the handback, which names the view and the palette route as untested.

Hand mutants (`bin/mutate.sh`, `author_story.test.ts`):

| Mutant | Result |
| --- | --- |
| Dedupe without `set` | red |
| Beat id from `part` | red |
| Topic clause -> `false` | SURVIVED (B2) |
