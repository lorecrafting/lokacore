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

## Re-check at bcd32c621 (fix commits ea7bc636c, bcd32c621 only)

Must hold: a fault closes a span; the forged tie test can fail; a kill loses only idle clock; the trace still reconstructs in commit order; author tools answer for the world the player is in ([save.md, Coalesced ticks](../system/save.md)).

Blockers from the first round:

- Blocker 1, fixed. Mutant on the `invocation.ts` clear is red. The `delivery.ts:95-100` clear survives: no fixture faults a driver tick. A fault keeps clock and state, so a later tick has the same `from`; a clean retry needs the same world to pass over a different span, and a longer span does at least as much work. No failing case constructed; defensive, mirrors the tested clear and save.md's "a fault". Not blocking.
- Blocker 2, fixed. `receipt-history.ts:41` `<=` to `<` turns the forged tie test red.

New findings:

- **Blocker 3.** `mobile/authority/local-story/session.ts:105`, reached from `mobile/app/author/panel.tsx:204`: the Why panel is false during an idle tail. Ferry `elapsedBundle` at rate 50, `coil_rope` gated `time_since` on an int fact (default 0), `at_least` 64860, 10 ticks. Head: live clock 64925 (gate open), 2 trace rows ending at 64812, Why `holds: false`. Base: 11 rows ending at 64925, `holds: true`. Through `game.trace()` with 12 `active` pulses, the production path: head 2 rows, `holds: false`; one `look` later 3 rows, `holds: true`; base `holds: true` both times. So the lag is the cause. An author waiting on a timed gate is told it is shut until the next command, against `kernel/ts/play/why.ts:21` ("what could be done next"). save.md's "replayable prefix" covers the file, not this answer. Hour-based `time_window` told the truth on the same fixture, because the crossing tick wrote a row. Fix: the author `trace()` catches up before it reads, with a test that is red without it.
- Nit. PR body line 45 says `coalesce.test.ts` 16 pass; 23 pass at head.

Questions answered:

- A kill loses only idle clock. SIGKILL matrix green; red on each of: no `s.behind` at `authority.ts:116`, no `s.behind` in `traceAfter`, no committed-first return, no `authority.ts:131` catch-up, prune disabled.
- The resume-tick fix is sound: `s.behind` at open orders the merged entry before the resume tick; the recap path catches up at `authority.ts:131`. Only `store.ts:221` and `commit.ts:51` delete receipts, so the prune hits absorbed ids only.
- Reconstruction: ferry trace with a refused move, reopened, reads elapsed 64800-64875, move, elapsed 64875-64887, in commit order.
- `bin/idle_save_size.ts`: 14,550 commits, 705,536 B, 101 receipts, eventful hash `7834de38` as in the first round.

"Replay differs" dispute: both sides are partly right. Idle-only ferry traces replay identically under both tools. With a refused move, head and base traces both differ under both tools, at that move: recorded commit `committed`, replay `unavailable / not_applicable`. Coverage and Why throw there too. It predates this PR and is not charged to it; for the PM to file.

Not checked: `sky` leaves and an hour crossing with no event, which read the same clock.

CI at bcd32c621: graph-diff, book-e2e, ci all completed success.

Verdict: CHANGES REQUIRED

## Re-check at 08b24b346 (Blocker 3 only)

Blocker 3, fixed. Same probe through `game.trace()`, 12 `active` pulses: 2 rows ending at 64950, `holds: true` during the idle tail. Twelve more pulses and a second read: still 2 rows, span 64800-65100, so a later tick still merges after a read. `bin/idle_save_size.ts`: 14,550 commits, 705,536 B, 101 receipts, eventful hash `7834de38`, unchanged; the catch-up runs only on read (`authority.ts`, `trace`). `author_trace.test.ts` passes.

The PR body nit was not rechecked. CI at 08b24b346: graph-diff, book-e2e, ci all completed success.

Verdict: APPROVE WITH NOTES
