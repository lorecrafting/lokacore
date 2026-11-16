# Review: editor gaps, Story beats, room detail, New outline, set delete, add-menu gates and seeds

- PR: #685 `fix/editor-gaps-2026-11-06` (loka-wfrgk.66, .76, .84, .85, .86, .87)
- Reviewed commit: `9be18eb3a000455efa51d98848ba0505f9a48c55`
- Governing: [gui-editor-design §5 write path, §5.5 refusals in place, §6](../rnd/gui-editor-design-2026-11-04.md),
  [WORKFLOW review stance](../WORKFLOW.md#review-stance), [small should-fix](../WORKFLOW.md#small-should-fix);
  author-error guards are nits; agents write no player-facing word (seeds are `~`)
- Independence: authored none of the slice; detached review worktree at the head
- CI at head (`gh run list --commit 9be18eb3a…`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body (10 + 10 findings, dispositions listed)
- Verdict: **APPROVE WITH NOTES** (one one-line [small should-fix](../WORKFLOW.md#small-should-fix): fixed in the
  re-check or filed in Beads before merge; everything else holds)

## Must be true (written before the diff)

1. A delete that takes a set sha-checks every member at write time; any mismatch is a 409 naming the set and
   nothing is deleted; undo puts every member back, each conditionally.
2. Root files are never deleted; outline is one per world, with a compiler citation.
3. A template is taken only when nothing outside the set names it; a return leg comes with its leg.
4. One card write at a time, each from the file the last one reloaded; a refused or failed write is shown in place.
5. The add menu never offers what the compiler refuses: every gate cites the compiler and is tested both ways.
6. Seeds are `~`; a beat's n is an integer ≥ 1, unique across the outline, inserted in number order.

## Checks that held

- find.ts `taken`/`others` (1, 3): rest members sha-checked against `also`, 409 `{set}` otherwise; a missing
  member hashes to null and is refused; the fixpoint takes a template named only by a later-taken template;
  `left` names outside referrers with `at` (file:line) so editor_crud's `/\.\w+:[1-9]\d*/` pin holds. write.ts
  `undo` is per file with the `after` check, so a set undo is conditional per member.
- EXEMPT (2): `outline delete` cites source_schema.ex:39 (`"outline" => "source.outline"` in @roots) and
  source_files.ex:15 (rejects `outline.json`); both verified. NAMED rows must be refused with a file:line.
- Capabilities (5): editor_crud `before()` locks food, readable, light on the pristine cartridge and asserts
  `items.readable` and `rooms.dark` were sent; allowed.test.ts tests every gate both ways with compiler cites.
- Seeds (6): every SEEDS prose is `~`; mapedit addBeat refuses n<1, non-integer and repeats, inserts in order.
- Claim reruns: write.test.ts:272 and :642 red with the `also` check off (2 fail); :642 red with the `areas/`
  strip removed (1 fail). Cites `mapedit.ts:204/:213`, `room_card.ts:10`, `find.ts:153`, `write.ts:123`,
  `card.ts:346/:376`, `App.tsx:294`, editor_crud `:139/:161/:219` all land on the named code.

## Mutants

`bin/mutate_diff.sh origin/main` at head (MUTATE_MINUTES=25): 116 mutants, 44 run, all BASELINE-RED
(find.ts, write.ts, App.tsx, Room.tsx, templates.tsx, storylist.tsx: the narrow finder pulls editor_crud, which
needs `mix loka.new`), 70 TIMEBOX; same shape as the PR table. Hand mutants against the importing tests, baseline
green (73 pass):

| Mutant | Tests | Result |
|---|---|---|
| find.ts `by.every(has)` -> `by.some(has)` | write | red-narrow (set test) |
| find.ts `others` sha check off | write | red-narrow (2 fail) |
| find.ts `own` without the `areas/` strip | write | red-narrow (templates test) |
| write.ts `...others(...)` entries dropped | write | red-narrow (3 fail) |
| room_card.ts alias filled for every key | room_card | red-narrow |
| mapedit.ts addBeat `b.n > n` -> `b.n < n` | author_mapedit | red-narrow |

## Findings

1. **Should-fix** (one line, small), tools/author-panel/src/edit/Generic.tsx:100: `.catch(console.error)`.
   A write that fails outside the 4xx path (live.ts:290 answers a thrown error as 500 text, `ask()` rejects on
   `r.json()`; or the dev server is down) runs no `setRefused`: the form keeps the edit, `refused` is empty, the
   author reads it as saved and a page reload loses it. §5.5 shows refusals in place. Fix:
   `.catch((e) => setRefused(String(e)))`. Pre-PR it was an unhandled rejection with the same silence; this slice
   owns the line now.
2. **Nit**, Generic.tsx:95 (pre-PR): the outside effect reloads on the editor's own SSE when it lands before the
   response's reload, with `sent=[]`; an array-row delete re-applied on the shrunk array is refused
   (edit_model "not an index"), and `rebase` returns the file alone, dropping an edit typed meanwhile. Narrow; file
   it.
3. **Nit**, Generic.tsx:130: `change` reading the render's `saved` builds no wrong write: `applied(saved,
   unlistedIn(saved, doc))` ≈ `doc` for either `saved`, and `send` diffs against `file.current`. Closed.
4. **Nit**, Generic.tsx:112 surviving mutant: equivalent within the E2E's reach (needs the SSE race). Accepted.
5. **Nit**, find.ts:153 / write.ts `put` `rmSync`: a member removed outside between the 409 and the confirm hashes
   to null, the resend's null matches, and `rmSync` throws ENOENT (500 text, generic alert). Author-error.

Ruled with the PM mid-review: loka-wfrgk.90 (Edit in Book, `21` + Tab saves `2` then `21`; Undo returns to `2`)
comes from the pre-PR `onBlur={() => setTimeout(card.commit)}` at Generic.tsx:210 firing as focus enters the
field; the queue turns the pre-PR lost keystrokes into two journal entries with the right bytes. Follows, P2.
loka-wfrgk.87.1 (a cutscene's quest file left behind) and .84.1, .86.1 are filed follow-ups.

## Re-check: fix round at `4ea7a8080`

- CI at head: ci success, book-e2e success, graph-diff success. Diff: Generic.tsx (3 lines), panel.test.ts (10 lines).
- Finding 1 (should-fix): Generic.tsx:101 `.catch((e) => setRefused(String(e)))`. The queue still settles after
  the catch, so the next write runs; `refused` clears on the next 200 as for a 409. Fixed.
- Test: panel.test.ts:221-224 routes `/__author/change` to 500 `boom` (not JSON), sets `800`, waits for
  `"boom" is not valid JSON` and asserts the field keeps `800`; after unroute the last Undo still stands (the
  failed write wrote nothing). Red control accepted by reading: the old `.catch(console.error)` never calls
  `setRefused`, so the `getByText` wait times out. Expected text is Chrome's `JSON.parse` message, the E2E's only
  browser.
- Nothing else changed; nits 2-5 and loka-wfrgk.90 follow as filed.
- Verdict: **APPROVE**.
