# Review: clock-only ticks extend one receipt, PR #578 (loka-vduxr.37)

- PR [#578](https://github.com/lorecrafting/lokacore/pull/578) `engine/coalesce-elapsed` at `a18f7d1aa6cb7a954bc43c05e11239c8e19c3936`.
- Governing: [save.md, M1-A trusted elapsed receipts and Coalesced ticks](../system/save.md), [WORKFLOW Review stance](../WORKFLOW.md).
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.
- `/code-review` is reported in the PR body. `bin/mutate_diff.sh` not run (brief); nine targeted mutants below.

## Must be true (written before the diff)

1. The merged row is what one tick over the whole span decides, byte for byte, RNG and replay included.
2. A span never merges across a player command, a real event, a fault or a reservation.
3. M1-A: a matching receipt replays before current-clock admission; trusted receipts are never absorbed.
4. A kill leaves all or nothing; the head equals the newest receipt.
5. Readers tolerate revision gaps.
6. No contract, protocol or schema change.

## Findings

### Blocker 1: a player's fault does not close the span

`mobile/authority/local-story/invocation.ts:149` and `delivery.ts:95` return without `save()`, the only place that clears `s.idle` (`save.ts:54`). Run through `openStory`: tick, tick, a player `move` that faults `budget_exceeded`, tick, tick. Receipts: one row `[64800,64850]` at revision 4. Trace: header, ordinal 3 `unavailable move`, ordinal 4 `committed elapsed 64800..64850`.

`save.md:284` says anything else in between inserts as before, and the brief says never across a fault. WORKFLOW's severity list makes a spec violation a blocker. The harm is bounded: a fault changes nothing, so the world is identical and the row is still what one tick over the span decides. What breaks is the trace order: the fault was decided at a mid-span clock but sits before a span that starts earlier, and rowid 2 becomes an interior hole in the cap's span count. My probe needed `openStory`, since `openGame` refuses a cartridge that faults at open, so a production trigger needs a fault that first appears after open.

Fix: `s.idle = undefined` in both fault branches (these are the only two `'unavailable'` trace writes), plus that sequence as a test expecting two clock rows.

### Blocker 2: the `receipt-history.ts:41` survivor is not held twice

The line is changed in this diff. The PR says the `<=` to `<` mutant survives because a forged tied revision still throws from `:50`. Run on forged clock rows `[(a,b) rev 2, (b,c) rev 2]`: the real code throws at `:41`; with `<` there is no throw, and `coalesce.test.ts` stays green. Line 41 is their only guard, and a forged tie passes `receiptHistory` once it regresses. Impact is limited to debugging and test replay.

Fix: add the forged tie to the test at `coalesce.test.ts:302`; correct the PR text.

### Question: an absorbed tick's id does not replay

Lost-ack probe, after three ticks (`[64800,64837]`, revision 3). Retrying the extended span replays. Retrying the original `(a,b)` span does not replay: it is NEW, is rejected `invalid_state`, and stores a refused receipt at revision 3; the next tick inserts `[64837,64850]`. The world is safe. No production caller repeats a driver span (`elapsed.ts:142` takes `from` from the current clock, and there is no external ack), and trusted `story.elapsed` receipts are never absorbed. Should save.md say that an absorbed tick's id stops replaying? No change requested.

### Nits

- PR body mutant table cites `intent_digest: merged ? hash(command) : tickDigest`, no longer in the code (the row is disclosed as red on a full run).

## Open items ruled

- `delivery.ts:95`: Blocker 1.
- `kernel/ts/play/run.ts:72`: acceptable; an audit tool, tested by `coalesce.test.ts:343`.
- `trace.ts:162` at the cap: acceptable; the absorbed entry stays and the prefix stays replayable.
- `trace.ts:165`: acceptable; the scan runs on catch-up only and is filtered by run.

## Checks that held

- (1) Probe on `toolbox_showcase`: move, then 600 s as one pulse, 1000 ms x 600 (landing on every multiple of 50), 250 ms x 2400, and 1000 ms x 600 with a reopen at 300. Eventful rows and world tables are identical, each save reopens cold, 137 ms x 4380 ran as well and reopened. Reading: due jobs carry ops, `boundary` stops at non-clock jobs, folds and the calendar carry ops.
- (2) Player commands, rejected decisions, trusted elapsed and events all pass through `save()`, which clears `s.idle`. Faults are the exception (Blocker 1).
- (3) `delivery.ts:43-55` replays first; trusted calls pass no driver flag, so they neither merge nor set `s.idle`.
- (4) `coalesce.test.ts` SIGKILL x 4 passes (baseline 16/16). `commit.ts:50-52` deletes and inserts in one transaction.
- (5) Narration filters clock rows; the Chronicle uses `op.to`; `expedition-receipt.ts:24-39` tolerates gaps; `recap.ts` reads no revision or receipt. `readable.test.ts:176-188` samples later and expects `count + 1`: same behaviour, not weakened.
- (6) `git diff origin/main...HEAD --stat -- kernel/ts/src protocol docs/spec` is empty.

## Mutants (`coalesce.test.ts`)

Red: no `s.idle` clear in save; no receipt delete in commit; `ops` without merged `from`; no `until`/`from` check; no RNG check; trace replacement skipped; `onlyClock` taking more ops. The run filter at `trace.ts:166` survives `coalesce.test.ts` but goes red in the wider trace suites (6 failing: new-game and start-over). Survived: `<=` to `<` at `receipt-history.ts:41` (Blocker 2).

## PR claims rerun

- `replay.ts:34` refuses a trace with a non-committed entry: backed.
- "still throws, from receipt-history.ts:50": not backed (Blocker 2).
- 14,400 ticks: 705,536 B and 101 receipts reproduced by `bin/idle_save_size.ts`: 51 eventful rows, 50 clock rows each closed by one.

## Not checked

Merged-id UNIQUE collision with an earlier refused trusted id: my probe did not trigger it, and it needs a trusted caller production does not have. Away cap: read, not probed with a capped gap.

Verdict: CHANGES REQUIRED
