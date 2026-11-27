# Review: a form write left during another gesture (PR #824, loka-x1frg)

- PR #824, branch `fix/form-write-during-undo`. Reviewed at `12ac8ac53131bd325b39262c0bffb5878abdb1b2`.
- Governing: [book-ui.md "Author mode (dev only)"](../system/book-ui.md) (each edit is one gesture with one Undo; a write sent from an old read is refused, never overwritten). Bead: P1 data loss.
- Why a record: the brief asks for one, because `run()`'s shared semantics are behind every builder gesture.
- CI at the head (`gh run list --commit 12ac8ac5…`): ci, book-e2e and graph-diff succeeded.
- `/code-review medium`: reported in the PR body.
- Verdict: **CHANGES REQUIRED**.

## Must be true (written before the diff)

1. No typed field loses its text without saying so when a busy `run()` refuses it. Either it is written, or it is kept and the refusal is said.
2. A retry sent under the hash the Undo replaced is refused (409), never overwritten.
3. No gesture sends twice. A button pressed twice still says nothing.
4. Every `run()` caller either ignores the new boolean or reads it correctly.

## Checks run

- Every roomedit `run()` caller (rg): only `Build.tsx:189` and the formwrite `set`/`send` paths read the boolean. The others discard it, or return it to callers that discard it, so their behaviour is unchanged.
- Stale hash: `generic.test.ts:372-381` shows the first retry refused (no send) and the retry after the reread written. Requirement 2 holds.
- `bin/mutate_diff.sh origin/main` (fresh worktree): 9 mutants, 4 run. red-narrow form.tsx:212, form.tsx:279, formwrite.ts:64. SURVIVED choices.tsx:63. BASELINE-RED roomedit.tsx ×5. This matches the handback's table, with line numbers moved +1 by the merge.
- Hand mutants. Each turned its test red:
  - `run()` reverted to the old `if (busy || !api) return;`: 5 of the 5 new tests failed.
  - `if (busy) return true`: generic.test.ts:356 failed.
  - `ran.then(() => true)`: failed with "the typed words were forgotten". This matches the PR's claim.
  - choices.tsx:63 `||`→`&&`: dialogue.test.ts:258 failed. This matches the PR's claim.

## Findings

1. **Blocker:** `trigger.tsx:102-108`, the quest outcome field, still has the bug. Its `write` deletes the draft, and then `put` calls `send` with no `BUSY` and no restore. Planted test (scene.test.ts harness: a held `run`, type `failed`, blur, release, blur again): nothing is said (`refused()` is `''`) and nothing is written (`[]`). The input keeps showing `failed`. The same P1 loss remains in a builder typed field.
2. **Should-fix:** a late refusal overwrites newer typed text: `form.tsx:279`, `:212`, `choices.tsx:63` and `world.tsx:147`. Planted test, using dialogue.test.ts's existing `held` plus a refuse-once flag (2 lines, so no new harness is needed):
   - Steps: Add `no` (held, then 409). Type `maybe`. Release. Add again.
   - Result: it sends `choices.no` while the input shows `maybe`. This is wrong content written without a word.
   - Fix: `ok || drafts.has(key) || drafts.set(...)`.
3. **Should-fix:** `schedule.tsx:33`. The hour field's `run` gets no busy note. A blur during an Undo keeps the draft, but nothing is said, so the input shows an hour that was never written.
4. **Nit:** `world.tsx:147`. A pick press refused mid-gesture says `BUSY` and becomes typed text, which contradicts "a double-tap still says nothing".
5. **Nit:** `form.tsx:287`. `typed()` uses `defaultValue={shown}`, unlike `story.tsx:99`. After a remount, a kept draft is invisible, and a later focus and blur writes it.
6. **Nit:**
   - `roomedit.tsx:105`: the gesture's own refusal overwrites `BUSY`. The draft is still kept, so nothing is lost.
   - `generic.test.ts:359`: the held run is not released in a `finally`, so one failure cascades into later tests.

Agreed as is: `formwrite.ts:64`, keeping the draft on a gate or server refusal (requirement 2 depends on it). `Build.tsx:185` is pre-existing and not changed here. The BUSY copy is a placeholder until the owner writes it.

## Re-check at `1aa66a5231f10daa548722c3dd7f27392761cd61` (fix commits 2b8d76eee, b30e59f13, 1aa66a523)

CI (`gh run list --commit 1aa66a52…`): ci and book-e2e succeeded. The four touched test files pass: 842 pass, 0 fail.

Dispositions:

1. Blocker, fixed. `trigger.tsx:108` now sends with `BUSY` and `keep(k, o)`. Red: dropping the `keep` fails `scene.test.ts:377`.
2. Should-fix, fixed. The shared `keep()` (`formwrite.ts:44`) does not overwrite a newer draft. It is used at `form.tsx:213`, `:280`, `choices.tsx:64` and `trigger.tsx:109`; `world.tsx:149` does the same check with `typing.has`.
   - Red: `keep` without `drafts.has` fails `dialogue.test.ts:282`.
   - Red: `world.tsx` without `typing.has(key)` fails `world.test.ts:487`.
3. Should-fix, fixed. The hour's `run` gets `BUSY` (`schedule.tsx:39`). Red: removing it fails `generic.test.ts:576`.
4. Nit, fixed. A press passes `busy=''` (`world.tsx:166`), so it is neither said nor kept. Red: removing `!busy` fails `world.test.ts`.
5. Nit 5 (a kept draft not shown after a remount, at `form.tsx:288`, `schedule.tsx:45` and `trigger.tsx:116`): ruled **should-fix, not a blocker**.
   - Failure: type X, blur during an Undo (BUSY), close and reopen the sheet. The field shows the disk value Y. Focus and blur without typing writes X over Y with no word.
   - Why not a blocker: the author was told "Not written", the text is their own, and one Undo restores Y. It needs a reopen plus an empty focus and blur. The hour field already behaved this way on refusal before this PR.
   - Fix: one line per site in the house pattern, `defaultValue={drafts.get(key) ?? shown}`, as `story.tsx:99`, `thing.tsx:137` and `roomedit.tsx:222` already do. Best done in this PR; a follow-up bead is acceptable if the PM merges first.
6. Nits: `generic.test.ts` held runs are now released in `finally` and after-hooks. `roomedit.tsx:105` is left as is, which is acceptable.

Re-check verdict: **APPROVE WITH NOTES** (nit 5 open as a should-fix).
