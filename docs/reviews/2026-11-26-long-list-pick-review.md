# Review: the Builder long-list pick (PR #814, loka-hcnlh.76)

- PR #814, branch `builder/long-list-pick`. Reviewed at `cc31192bdd7decd270f43b85067aa0ae0d93a94b`.
- Governing: [book-ui.md, World block, Long-list pick](../system/book-ui.md) (lines 1241-1272); looks: [BOOK-UI-COMPONENTS.md, Builder 6.1a](../BOOK-UI-COMPONENTS.md) (lines 393-401); panel list `tools/author-panel/src/right.tsx:37`.
- Why a record: PM brief.
- CI at the head (`gh run list --commit cc31192bd…`): graph-diff, ci, book-e2e all success.
- `/code-review medium`: reported in the PR body (run on `6a19928ce`; `world.tsx` and `sheet.tsx` changed after it, 7 lines).
- Verdict: **CHANGES REQUIRED**.

## Must be true (from the spec, before the diff)

1. Keys are `reachable` over the last good compile's nodes for this file: any room, no other area's item, person or transport. With no keys the field is free text and refuses nothing.
2. Six keys or fewer: all are picks. More: no picks until a keystroke. Then, in order: the refusal `no <kind> <text>` (`npc` for a person) when the text is non-empty and no key equals it; matches ordered exact, then prefix, then contains, case ignored, list order within each group, at most six; then `+N more`.
3. The refusal sits at the field for any count, never at the sheet's top, and nothing is sent.
4. Leaving the field writes the text only when it equals a key. A match press after typing writes only that key: the typed text is not sent first and no refusal for it shows.
5. On a phone, focus raises the sheet to full height and scrolls the field to the top of the body. The refusal is read politely on leave, never per keystroke.

## Checks run (detached worktree at the head)

- `bin/mutate_diff.sh origin/main`: 24 mutants, 24 red-narrow. Matches the handback table.
- Hand mutants against `author/world.test.ts`:
  - `reachable(...)` → `known.nodes`: red.
  - Drop `at.file`: red.
  - `aria-live` put on the per-keystroke line: red.
  - Blur writes any text: red.
  - Drop `told.delete(key)` at `world.tsx:193`: **green** (Finding 2).
  - Drop `scrollIntoView` at `:189`: **green** (Finding 3).
- Real click order: a scratch Storybook play (`vitest/browser` `userEvent`, headless Chrome, not committed) with a `TextInput` and an `act` cloned as in `world.tsx:157-161`. Typing `room_1` and clicking the match logged `blur pressing=false`, `in`, `out`, `press`.
  - Source: RN-web `PressResponder.js:74,193-197` delays press-in 50 ms. `:302-315` fires `onPress` from `click`.
- Same-keys test (`world.test.ts`, the corpse test): not tautological. The expected `['i_a','i_top']` is derived by hand from the area rule. It goes red when `world.tsx` drops `reachable`, the file or `bundled`. It cannot catch the panel drifting: both sides call the same `reachable(graph.nodes, story, rel)`, and `rel` has the same `areas/<a>/<dir>/<file>` shape.
- `sheet.tsx`: `raise.full` is called only from `world.tsx:188`, so no other sheet changes behaviour.
- Screenshot (390 px wide, 500 px tall), checked against 6.1a:
  - The refusal is on its own line, `small` `danger`, above the matches.
  - The matches are acts that wrap.
  - The held key is a selected act.
  - `+2 more` is dim.
- Claims rerun:
  - `form.tsx:264` drop: red, as listed.
  - The disputed "pressOut and press fire synchronously, so `write` clears the typing before any later blur" is not backed. In a real browser the blur comes first.

## Findings

1. **Blocker**, `mobile/app/author/build/world.tsx:159,198`; the test is at `world.test.ts:361-364`.
   - The `pressing` guard never holds in a browser: blur fires on mousedown, before `onPressIn` (which RN-web delays 50 ms).
   - Scenario: type `room_1`, then click `room_12`. Two `/change` posts go out (`room_1`, then `room_12`), and Undo needs two steps.
   - With `zz` typed, the refusal is told, then cleared by the press.
   - The spec forbids both (Must 4). The test calls `onPressIn` before `onBlur` by hand, so it pins an order the browser does not produce.
   - Fix: guard on the blur's `relatedTarget`, or on mousedown. Drive the test with a real click.
   - Touch path: not checked.
2. **Should-fix**, `world.tsx:193`.
   - Dropping `told.delete(key)` keeps the test suite green.
   - Scenario: leave the field on `zz`, come back and type `zzz`. The polite line now changes on every keystroke, which breaks "never per keystroke".
   - Fix: add one assertion after a refused leave.
3. **Nit** (also a question), `world.tsx:189`.
   - `scrollIntoView` is untested: the test passes `target: null`.
   - In the screenshot the field sits mid-sheet, not at the top of the body. Is the body too short to scroll it there?
   - There is no shot of the 384 px docked sheet.
4. **Nit**, `world.tsx:200`. An emptied field's blur restores the held key. The spec says other text "stays in the field". This deviation is not listed in the PR's Deviations or in `book-ui.md`.
5. **Nit**, author-side, the developer's open items:
   - A cancelled press (`world.tsx:159`).
   - `typing` and `told` survive a sheet close or Undo (`:128-129`).
   - `raise.full` keeps pointing at an unmounted Frame (`sheet.tsx:165`).
   - A second press on native. Likely the same root cause as Finding 1.
   - A second leave on the same text is not read again (`told` is unchanged).
   - `sheet.tsx:166`: the `[ids, titles]` rewrite is churn.

Wording: `no <kind> <text>` and `+N more` are placeholders, the owner's to replace (flagged, not rewritten).
