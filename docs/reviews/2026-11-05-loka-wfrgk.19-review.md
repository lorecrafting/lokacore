# Review: an open conversation re-words an edited line; stale `~` map by line count (PR #625, loka-wfrgk.19)

- PR: [#625](https://github.com/lorecrafting/lokacore/pull/625), branch `editor/open-talk-refresh`
- Reviewed commit: `81275e57f15d55b34786a6989ad598453668f1bd`
- Governing: [authoring editor plan, promise 1](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md), [prose in the book rulings](../design/prose-in-the-book-rulings.md), [cartridge.md#author-preview](../system/cartridge.md#author-preview), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit 81275e57f...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body.

## Must be true (written before the diff)

1. Only the author preview (`?dev=1`, `LOKA_DEV_CARTRIDGE`) re-words; a player build keeps the words a line was spoken with; `mobile/app/book/` gains no author chrome beyond a hook-shaped opt-in.
2. An open conversation shows the current overlay words after Enter, Cmd-Z, an optimistic word and a refused compile.
3. The position, the choices, the line count and the scroll do not change when a line re-words.
4. `/line` never sends `/edit` to a line that is not the key's: a stale map is refused or falls to a match on the key, never to another key's line.
5. Tests use expected values the code under test does not compute; each red control is red.

## Checks that held

- Real Chrome at `?dev=1`, identity_sampler, the stranger: double-click the spoken line opens the field at `scenes/stranger_talk.scene:3`; Enter re-words the line in place (choice "Ask their name" stays, `scrollY` 0, file line 3 written); Cmd-Z restores the words and the file (tree clean). Shots: `scratchpad/shots/wfrgk19-review-{1-open,2-field,3-after-enter,4-after-undo}.png`.
- Player build: `conversation_reword.test.ts:63` and the `panel.tsx:39` gate (the same `devClock` conditional as the shipped `worded.note`; cartridge.md:894 refuses a production bundle with `LOKA_DEV_CARTRIDGE`). Adequate; no further test asked.
- Cites rerun: `lines.tsx:140`, `words.ts:193`, `panel.tsx:41`, `Npc.tsx:170`, `told.ts:30`, `told.ts:47` match the PR body.
- Reviewer-side false alarm: my first watcher run died at `told.ts:23` (`Object.values(undefined)`) because my own `bin/mutate_diff.sh` was mutating `told.ts` in the same worktree at that moment. The head's watcher starts clean ("Preview unchanged in 518 ms, Watching").

## Mutants

`bin/mutate_diff.sh origin/main`: 10 mutants, 9 run, 9 red-narrow, NO-TESTS 1 (`panel.tsx:39` negate `devClock`, named untested in the PR body). No TIMEBOX rows. Matches the handback.

Hand mutants via `bin/mutate.sh`, each RED against the importing test file: `told.ts:13` `NaN`→`-1` (told.test.ts); `told.ts:50` `fresh` returns `places` unfiltered (told.test.ts); `lines.tsx:140` `&&`→`||` (conversation_reword.test.ts); `Npc.tsx:170` drop `reword` (conversation_reword.test.ts).

## Findings

1. **Should-fix (data safety)**, `kernel/ts/play/prose.ts:88-91` via `told.ts:47`. Once a file's places are distrusted (now: any outside save that changes the file's line count; on main and here: a failed compile pushes `placeholders: {}` from the fresh tmp dir, author.ts:150), `/line` for a `~` key falls to `sourcesOf`, which matches `* ~` lines with no key at all. Scenario: an outside delete of a's `* ~` leaves b's `* ~` as the only `~` line; `/line?key=a&words=~` answers b's line 200 and the next Enter writes a's words on b's line. On main the fallback only ran when the mapped line lost its `~`; this slice widens it to every count change in the file. Fix here (small, a logic change so a fix round): in `located`, when `defined` is empty and the words are `~`, refuse 409 (the map is stale, wait for the compile) instead of the word search; `told.test.ts:150` (expects 200 to line 3 after an outside insert) then expects 409, `:167` keeps the 400. Or file in Beads and merge as APPROVE WITH NOTES; the PM chooses.
2. **Should-fix**, `kernel/ts/play/told.ts:47`. A same-count move passes: an outside cut of a's `* ~` at line 2 and paste after b's keeps the count; the map says a→2, which is now b's line; `located`'s `includes('~')` passes; an Enter inside the compile window (about 0.5 s, before the new map) writes a's words on b's line. Bounded by the window and `/undo` puts it back, so Beads filing is acceptable; the proper fix is a per-file hash that `told` also re-records on the Book's own `/edit` and `/undo` (a plain hash would distrust the file for the compile's 0.5 s after each fill and break the owner's `]`/Enter run).
3. Nit, `docs/design/prose-in-the-book-rulings.md:40`. The check says any author code under `mobile/app/book/` beyond `worded.note` is a finding; this slice adds `worded.made` (words.ts:193) and the `reword` prop (lines.tsx:92). Amend the sentence to name both, so the next slice's reviewer does not flag them.
4. Nit (disposed), `mobile/app/book/logs.ts:126`. A merged `(N times)` line's stored text differs from any `made` key, so it keeps its old words until the next merge; `|| stored` shows the spoken words when a re-compose gives `''`. Author-side; no action.

## Verdict

APPROVE WITH NOTES. Promise 1 holds in Chrome and in the tests; every mutant is red. Finding 1 is a wrong-line write the PM asked to settle here: fix in a fix round (recommended, about 5 lines plus one expectation) or file in Beads before merge. Finding 2: file in Beads.
