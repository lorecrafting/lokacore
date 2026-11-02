# Second review: fast cold open, PR #574 (loka-vduxr.34)

- PR [#574](https://github.com/lorecrafting/lokacore/pull/574) `engine/fast-open` at `50bc895e1e4d5d43946e5f352b958b6be90ffe8b`; main `778b4a32e`.
- Scope: what ordinary use can now persist wrongly, side-effect consumers, docs, format. The forged save that opens is an owner-accepted price and no finding. Written without reading the other reviewer's record.
- Governing: [save.md, What reopen proves](../system/save.md#what-reopen-proves), [decision](../decisions/owner-decision-fast-cold-open-2026-11-01.md), [reopen principle](../lessons/storage.md).
- CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.
- `/code-review medium` is reported in the PR body. `bin/mutate_diff.sh` not run (brief); five targeted mutants below.

## Must be true (written before the diff)

1. No production path replays, and nothing depends on the replay's side effects.
2. Every remaining refusal reaches typed `save_corrupt` with Start over, or an honest fault.
3. Lawful saves from every path still open (revision and clock bind).
4. `save.md` truthfully states what is lost, including what is lost without forgery.
5. The decision record is paraphrased and marked; owner-rules wording is untouched.
6. Save format and `kernel_api` are unchanged by the PR.
7. Tests keep replay determinism through `coldReopen`, and they fail on mutants.

## Findings

### Blocker: nothing pins the state comparison

`mobile/authority/local-story/receipt-history.ts:43`, `receipt_history.test.ts`. Mutant M5 removes `!same(world.state, saved.state)`: all 30 `coldReopen`-using files (137 tests) and `__tests__/elapsed-host.test.ts` stay green. The PR removed the open-path tests that exercised it; the new red control only edits a receipt's `narration`. This comparison is now the only pre-ship catcher of a writer or kernel bug whose rows disagree with the receipts. Failure: a change that loses it lets such a bug ship with CI green.

Fix, verified by probe: a second case that deletes a `resources` row, then expects `coldReopen` to throw `/malformed JSON/`. Refused at this head, not refused under M5.

### Should-fix: disclosure covers hand edits only

`docs/system/save.md:45-46`; decision record item 4 (`owner-decision-fast-cold-open-2026-11-01.md:16-18`). Both read as if only a hand edit is lost. Probe with one `state_row` leaf page taken from the previous commit, every byte written by the game (what a file copied or restored without its journal could hold; no specific phone-backup behaviour was tested): this head opens and saves the next action as accepted on the wrong state; main refuses with `save_corrupt` and Start over. A kernel or writer bug that writes wrong rows likewise now persists, since the player's reopen was its last detector. Row probe on the water fixture: main refuses 66/66 row edits, this head 58/66.

Fix: say so in `save.md`, and narrow item 4. The owner's paraphrased acceptance names hand tampering only, so the PM should confirm this wider price with the owner before merge. The issue title's "state hash check" also contradicts decision item 2.

### Should-fix: a refusal without Start over

`mobile/authority/local-story/deer-save.ts:27`. An older accepted receipt with `delta.ops = [null]` throws a TypeError on `op.op`; `authority.ts:108` rethrows it and `session.ts:245` gives `startOver=false`, so the player is stuck on that save. Main: `save_corrupt`, `startOver=true`. Probe run on both. It takes an edited receipt to reach; the owner's price is that such a save opens, not that it strands the player. `delta` removed still refuses typed. Other loaders were not swept for this shape.

Fix: `op?.op` or `invalid()` on a non-object, plus one test.

### Nits

- `docs/lessons/storage.md:24` still says cold-reopen validation replays the stored receipts.
- `docs/system/save.md:47` and decision item 1 say "dev tooling"; `git grep receiptHistory -- bin lib tools mobile/app` is empty, and the only caller is the test helper.
- PR body cites the wrong-shape return as `receipt-history.ts:64`; it is `:62`.

### Open item

`loka-b60` asks for the opposite (replay on every reopen). It is deferred, with a comment that it closes or is restated with this slice; the PR does neither. PM at merge.

## Checked, no finding

- List 1: `git grep` finds `receiptHistory` called only from `__tests__/elapsed-host.test.ts:99`; it works on a local world; `historyChecked` is gone; `repeatExchanges` matches the old gate's return.
- List 2, apart from the above: page sweep (ferry fixture, 158 pages) and row probe. Every refusal offered Start over. Stale `receipt_1` index leaf throws UNIQUE at the next command on both versions, so it predates the PR.
- List 3: mutants killed. M1 skip head against MAX revision (only "food-only cold-open refuses unbound receipts" fails); M2 skip `boundCommand` (4 tests); M3 clock +1e12 (`head_rollback`); M4 writer drops containers (3 tests).
- List 5: paraphrase marked; `docs/system/owner-rules.md` not in the diff.
- List 6: no `kernel/`, protocol or fixture-pin change in the diff; `kernel_api` is `1.146` on main and head (`kernel/ts/src/runtime/world.ts:110`), so 1.144 to 1.146 is main moving.
- PR claim rerun: non-test local-story does not name `run_job`. Backed.

## Not checked

Real device backup and restore; full mutation run; downgrade on a real device (pin refusal read in `authority.ts:101`, not run).

**Verdict: CHANGES REQUIRED.**

## Re-check of `66490e74b` (scoped to the findings above)

CI at this head (`gh run list --commit`): graph-diff, book-e2e success; ci failure, one test (`a ranked row reads its rank in place of the level`, not in this fix). The branch has since moved to `0ed83f5d5`, which was not reviewed.

Dispositions:

- State comparison blocker: fixed. Removing `!same(world.state, saved.state)` fails `coldReopen refuses saved rows its replay does not produce`.
- Mutants, all red on `receipt_history.test.ts`: remove the head check at `receipt-history.ts:54`; drop `TypeError` from `unreadable`; rethrow in `chronicle.ts`; old classification at `session.ts:76`.
- Disclosure: fixed in `save.md`, the decision record and `lessons/storage.md`. They state the bug and stale-page loss. The record says the owner was told, and does not claim acceptance, which is accurate. Open: "no objection so far" is not an owner answer; the PM records the answer.
- Stranded player: fixed, but the fix is too broad (below).
- The nits on `storage.md` and "dev tooling" are fixed.

### Should-fix: a code bug on a lawful save now offers to wipe it

`mobile/authority/local-story/store.ts:185`, used at `store.ts:132` and `session.ts:76`. Probe: `(undefined as any).bug` planted in `load` on a lawful save. This head reports `save_corrupt`, `startOver=true`, message `save_corrupt`, so the cause is lost. With `TypeError` removed from `unreadable`: untyped fault, `startOver=false`, the real message, and the save kept until a fixed update.

Failure: a release with a loader TypeError on a shape CI did not play tells every affected player the save is damaged and offers the one irreversible button. The stranding this replaces takes an edited receipt; this one takes only our own bug. A wrong "corrupt" is the worse error. `session.ts:68-70` already refuses on any `gameView` throw, but that predates this PR and is no reason to widen.

Fix: take `TypeError` out of `unreadable`. Refuse the shapes at the readers: `deer-save.ts:27` calls `invalid()` on a non-object op or wraps only its row walk, and the newest receipt's `narration` read refuses when `newestReceipt`'s `validate` fails (`receipt-history.ts:62`). Update the `save.md` sentence. `chronicle.ts:44` destroys nothing, so its catch may stay, though a bug there silently drops Journal entries.

### Patrol and light rows: no concern

- Patrol run through `localSession` on a file: lawful rows open at each stage. `cursor=99` refuses at each. `cursor=5` refuses while the validated stage requires it and opens after a move, then plays with no throw or hang. A missing patrol row opens too. This is the disclosed price and meets the reopen principle, since the kernel neither throws nor hangs. The refused stages are row validation, not a promise.
- Light with no fuel row: open, view and `look` run; `ignite` reached `not_owned`, as it does with the rows present. A held torch was not run; `mechanics/light/shared.ts:46` returns `precondition_failed` on a missing row, by reading, so that torch cannot be lit again. Same price.

Not checked at this re-check: `0ed83f5d5`, other loaders' wrong shapes, a held torch with no fuel row.

**Verdict: CHANGES REQUIRED.**

## Final check of `60f485efd` (`TypeError` narrowing only)

CI at this head (`gh run list --commit`): graph-diff, ci, book-e2e success.

- The should-fix is resolved. `TypeError` is out of `unreadable` (`store.ts:186`). Shapes refuse at `deer-save.ts:26`, `skills-save.ts:53` and `receipt-history.ts:67`.
- Planted `(undefined as any).bug` in `load` on a lawful save: no game, `startOver=false`, the real message, receipt, state and head rows byte-identical.
- Mutants, all red: `TypeError` back in `unreadable`; each `readableOps` check removed; `:67` back to `return` (including `smoke.test.ts`).
- `smoke.test.ts:237` ruling holds. `commit.ts:35` validates `DecisionResult` before the only `INSERT INTO receipt`, inside one transaction, and nothing updates a receipt, so neither ordinary play nor a crash writes that shape. A contract change bumps `kernel_api`, and the pin refuses that save first. That bump is a rule, not a check I found enforced: a tightened schema without a bump would offer Start over on a lawful save. Probe: `save corrupt`, rows byte-identical after the settle and after a further press.

Nit: `docs/system/save.md:46` says a `TypeError` is never read as a bad save, but `session.ts:68-70` still refuses on any `gameView` throw, with Start over. By reading; it predates this PR. A bug in the first-screen build can still offer the wipe. Reword the sentence, or decide that path separately.

Open: the owner's answer on the wider loss is the PM's to record.

**Verdict: APPROVE WITH NOTES.**
