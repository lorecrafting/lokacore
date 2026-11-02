# Second review: coalesced clock-only receipts, PR #578 (loka-vduxr.37)

- PR [#578](https://github.com/lorecrafting/lokacore/pull/578) `engine/coalesce-elapsed` at `a18f7d1aa6cb7a954bc43c05e11239c8e19c3936`.
- Scope: save contract after a receipt replace, old and new saves across builds, write cost, trace density. Written without reading `review-578`.
- Governing: [save.md Receipts, Commit, Coalesced ticks](../system/save.md), [architecture.md](../system/architecture.md), [protocol.md](../system/protocol.md).
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.
- `/code-review` is reported in the PR body. `bin/mutate_diff.sh` not run (brief); six targeted mutants below.

## Must be true (written before the diff)

1. Only a clock-only driver tick is merged; a tick that changes state, RNG or anything else keeps its own receipt.
2. No reader in the product needs contiguous revisions or a receipt for every past tick.
3. A save written by the old build opens and continues with no Start over and no `kernel_api` bump; an old build can still open a new save.
4. A trace with fewer rows still replays and still answers Why.
5. The contract docs say what the code does.
6. A crash mid-merge loses nothing beyond the tick.

## Checks that held

- Readers: every revision user is monotone, none contiguous (`commerce-save.ts:113`, `expedition-receipt.ts:34-35`, `riddle-save.ts:66`, `narration.ts:77`). `commit(` has one caller, `save.ts`.
- Cross-build, run on run, ferry and showcase saves: base writes, head reopens, continues, cold reopen ok. Base opens a head-written save and plays; head continues it. Base `receiptHistory` refuses gaps, but its only non-test site is its own definition (`git grep` at 8df752267).
- `git diff 8df752267 HEAD --stat -- kernel/ts/src protocol docs/spec` is empty; no `kernel_api` change needed.
- Replay, showcase: head only, head plus reopen, base then head all print `replay: N commands identical`.
- Why on a gapped showcase trace (revisions 39, 40, 80, 81, 86): every ordinal answers. For dialogue, revision enters state only through `opened_revision`, read back from the same world: reasoned, no choice run.
- No density reliance: the author panel and `explain` replay rows; `flows.ts` and `fight.ts` build their own commands.
- PR claims rerun: `bin/idle_save_size.ts` at 14,400 ticks gives 705,536 bytes, 101 receipts, 102 trace rows, eventful 51 and the same sha as the PR table. The SIGKILL cite `coalesce.test.ts:371` holds.
- Mutants against `coalesce.test.ts` (baseline 16 pass), all red: drop `s.idle = undefined`; drop `until !== from`; drop the RNG check; drop `driver &&`; leave ops unrewritten; `run.ts` `at > r.revision` to `<`.

## Findings

**should-fix: the PR's cost line is wrong** (PR body line 23, "Still one fsync'd COMMIT per 250 ms"; `mobile/authority/local-story/delivery.ts:176`, `trace.ts:36`). The listed run does not count commits. SQLite's file change counter moved 600 in 300 ticks at head: the receipt and the trace row are two write transactions. Base falls to one per tick once the trace caps (200 moves in the last 200 ticks), because the capped trace COMMIT writes nothing. The head trace never reaches the cap, so past about 21 minutes of foreground idle (5,000 ticks) head writes 8 transactions a second, for as long as idle lasts, against 4 on main. Failure: Option 2 is judged unneeded on half the real write rate.

Cost answer: acceptable to merge. It is foreground only (`App.tsx:195,201`) and size stays bounded. Correct the body and file a Beads issue for write frequency, with a device measurement. Fsyncs per transaction are not claimed: the device journal mode is unverified, and the test host uses `delete`.

**nit: Commit and Receipts still read as append-only** (`docs/system/save.md:114-116`, `:87-101`). Commit says "then always the receipt" with no mention of the DELETE at `commit.ts:50-51`; Receipts does not say an absorbed tick's id stops being known. The Coalesced ticks paragraph (`:281-290`) is true but sits far away. Failure: a later author adds a lookup by driver tick id, trusting the replay rule, and it misses for every merged tick.

## Not checked

- No phone or device run; rates are from the test host.
- Ferry `elapsedBundle` trace prints "replay differs" under the head tool, also for a base-written trace, so it is not attributed to this PR. The base-tool control was not run.
- `bin/away_timing.ts:49` `turns` counts receipts and printed 1 for a one-hour run; no doc cites it, so not raised.

## Verdict

APPROVE WITH NOTES.
