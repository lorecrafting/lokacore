# M1-B1 durable elapsed driver independent review

PR #154. Source reviewed: `a0dfaba044f5cbe004743233fa8e93388e5b6258`, against main `5fb97d451a42f6f2ca631959c41b00d36d7145b4`. Fresh independent reviewer; authored none of the implementation or planning. Review conducted in a detached throwaway checkout. Ponytail and Ponytail Review applied.

## Requirements derived before reading the diff

Derived from the B1 brief, PM durable-elapsed adoption and active save, architecture, Book and trusted replay sections:

- Exact safe integer accounting retains fractional remainder and target debt; negative wall deltas credit nothing but persist the lower anchor. Active time uses floored absolute monotonic samples, distinct from latency.
- Managed elapsed needs real clocks and a valid run-bound v2 checkpoint. Same-pin v1 upgrade gives no earlier credit; legacy play stays v1. Explicit v2 advance preserves a target at least head.
- Fixed captured horizons settle chronological due boundaries with at most 16 commits per turn; failures retain candidate/debt. Checkpoint, changed rows, receipt and head commit together before adoption. Metadata-only writes never produce gameplay receipts or bypass a gameplay fence.
- Unknown transactions are closed before exact prior/candidate and durable-run reconciliation; malformed same-run evidence is terminal recovery, actual read/rollback failures stay pending, and replacement invalidates old work before receipt lookup.
- Receipt replay and initial freshness precede sampling. Only privately preflighted input gets the own-prerequisite-revision exemption; one retained identity has a finite horizon, conflicts with other intent, resolves settled semantics, and releases on terminal completion/replay.
- Typed state and one-shot retained completion carry stable identity and settled prior projection. Immediate results emit no completion. B2 native/UI wiring remains outside this slice.
- Actual supported local elapsed traces preflight the whole fresh single-header segment, bind record and payload runs to its header, and replay trusted elapsed separately from ordinary player dispatch. Legacy replay identity and trace limits remain intact.
- Mechanical helper moves preserve legacy store/player/trace behavior and changed-row/structural-sharing hot paths. Evidence claims distinguish historical mutants from final bytes, and prose-only schema changes add no new validation obligation.

## Review result

**CHANGES REQUIRED. One open blocker, M1B1-01.**

### M1B1-01 — blocker — mutable shared-session retry strands the private reservation

Source location: `mobile/authority/local-story/session.ts:119` at the reviewed SHA; terminal clearing at `:110`, completion context at `:178`. The session shallow-copies the caller's intent, retaining its `target_ids` and `input` by reference. The authority correctly snapshots its private reservation (`invocation.ts:52`), but later pulses re-identify the mutable session retry rather than the original retained invocation.

Concrete controlled failure on actual node:sqlite:

1. Open the existing elapsed ferry host at clock 64800, wall 10000, monotonic 0. Supply LOOK with empty target_ids/input and the current view token.
2. Advance both host samples by 15984000ms and invoke: `catching_up`, confirmed clock 712800, 16 receipts, captured target 864000.
3. Append UUID `dddddddd-0000-4000-8000-000000000001` to the caller's original target_ids after return. Pulse the Game.
4. The pulse completes with `conflict` and reports `ready`, drops the session retry, and leaves clock 712800. A fresh valid LOOK also returns `conflict`; the authority's original reservation remains held. The command never reaches its captured horizon or produces its original terminal result.

This violates the private original-intent reservation and stable completion contract. Snapshot only the bounded retained intent using the existing normalization/copy boundary; preserve ordinary invalid-input admission and the original completion context. Do not copy World or introduce a generic serializer. Extend the existing shared-session finite-horizon case with caller target/input mutation: require the original saved completion at literal 864000 and a subsequent valid command to succeed. This catches a distinct gap missed by the low-level authority-only private-reservation case. Independent assertion `completion.reply.kind === 'saved'` fails on the actual reviewed code with actual `conflict` (exit 1).

## Source and behavior assessment

Reviewed the complete runtime changes by file/hunk and outlined the affected sources before reading their ranges. AST JSON searches used the installed parser's TSX mapping for these TypeScript files. Traced invocation, trusted delivery, driver, checkpoint load/write, transaction/reconcile, reset and shared completion callers, plus actual CLI replay and its legacy player dispatch.

- Checked base1000 accounting at accepted safe integer bounds: all terms are nonnegative; any accepted sum bounds each integer product below the safe range. Fractions/debt survive reopen, and negative wall changes persist without credit. The driver uses cartridge rate and floored absolute monotonic samples.
- Fixed horizons choose earliest pending jobs, preserve equal-time kernel ordering, yield after 16 segments and retain candidate evidence on storage failure. Already-due and deterministic faults do not skip work. No resource/calendar/proposal-loop, sampler, native or renderer changes occur.
- Gameplay checkpoint writes share the head/changed-row/receipt transaction. Metadata calls settle gameplay fences first. Exact prior/candidate reconciliation occurs after transaction closure; gameplay checks durable run before receipt lookup. Closed malformed evidence is typed terminal recovery, and a valid replacement cannot be overwritten by the old continuation.
- v1 same-pin upgrade samples its opening anchor without retroactive credit; required-clock refusal precedes writes. v2 load validates singleton identity, safe head/checkpoint numbers, run and target; explicit trusted v2 advance maintains target while preserving wall/fraction.
- Receipts precede new sampling and stale admission, private authority input exempts only its own elapsed revisions, and matching successful receipt releases the reservation. Immediate replies do not emit completion. The shared-session mutable-retention defect above remains open.
- Actual trace replay performs full-segment schema/run preflight before drawing/executing, then trusted elapsed versus ordinary player dispatch. The ordinary measured=false path still rejects elapsed; legacy replay behavior remains covered. Supported fresh committed single-header limits are explicit.
- Transaction extraction preserves the prior implementation; invocation decision/latency and CLI evaluation splits retain legacy behavior. Hot paths persist changed rows and share World structure. Only bounded invocation data is serialized for the private authority reservation.

Ponytail Review result: **Lean already.** The helper splits have concrete local responsibilities and existing file caps; no dependency, generic scheduler, event bus, speculative option, full-world clone or new hashing path was added. No independent over-engineering finding. Correctness finding M1B1-01 is separate.

## Checks and independent red controls

All commands ran with the pinned toolchain in the isolated reviewer checkout. No native/device build, owner save, or full check_all/pre-push run was needed for this proportional review; PM reports normal final pre-push exit 0 and personally verified all six exact-source CI jobs successful at 12:56:57 UTC. Those are PM verification, not claimed as independently rerun here.

- Focused baseline: `mise exec -- node --test mobile/authority/local-story/elapsed-driver.test.ts mobile/authority/local-story/faults.test.ts mobile/authority/local-story/observe.test.ts`: exit 0, **47/47 passed**.
- Independent mutant 1: replace earliest-job minimum with target directly. Existing `a fixed 36hour horizon commits all four daily boundaries in order` fails (exit 1); it observes the chronological boundary behavior on controlled input.
- Independent mutant 2: omit the checkpoint write from the gameplay transaction. Existing `failed and lost-ack positive elapsed commits reconcile head receipt and checkpoint together` fails (exit 1), including actual SQLite evidence rather than mock assertions.
- Both source files restored byte-for-byte in finally blocks. Post-restoration run of all local-story tests plus `kernel/ts/test/{play,play_gate,play_items,play_recipes,transcripts}.test.ts`: exit 0, **192 tests, 191 passed, one existing opt-in copied-phone-save test skipped**. This includes the two restored controls, real rollback-journal SQLite FULL/deferred-FK failed COMMIT/lost acknowledgement/read failure, before/after-COMMIT SIGKILL, and actual trace CLI success and mismatch preflight.
- The separate actual shared-session mutation scenario above fails its literal saved-completion assertion without changing implementation. Existing green suites do not cover that shared caller-mutation path.

## Evidence verification and limits

Independently verified all **55 inventoried artifact hashes**, exact inventory agreement and all 55 retained verification OK lines. Recomputed the **21 current-source manifest hashes** against the reviewed source: all match. Inspected the **23 author controls**: each has old exit 0/new exit 1 and corresponding old-green/new-failing retained logs. Two controls document actual implementation gaps rather than synthetic final-source mutations. Historical mutation substrings need not match the final formatted source; the author explicitly distinguishes those runs from the final byte manifest. This review does not claim to rerun all author controls on identical final bytes.

Independently tallied schema sweep: **244 removals, 161 detected, 83 inherited survivors (56 type, 27 required), zero recorded errors**. The schema/generated diff changes ReplayIds prose only, leaving validation constraints and frozen fixtures intact. The report honestly limits its oracle and inherited coverage; expanding validation is unnecessary B1 scope.

Author evidence uses real deferred-FK COMMIT failure separately from a successfully committed but lost response, plus actual process death. No simulated success is described as a failed COMMIT. Retained logs contain no absolute home paths. B2 lifecycle/UI/sampler integration, native compatibility and complete M1-B acceptance remain outside this review and are not claimed.

## Separate Sol source review

Requested model `gpt-6-sol`, read-only CLI; runtime model identity unverified. Exit 0. Reviewed the same source `a0dfaba044f5cbe004743233fa8e93388e5b6258`. Raw transcript stays private. Answer SHA-256 `a34037ac2c01c631626750f288a3a368406be2e4cc07adbcf31c92b6f9e9a813`; transcript SHA-256 `c6e96663d4ae10ee7d2db3f2c1ee8d936db5443f2f7a46a785e2a71bb8bd1d34`. Exact answer follows; this does not replace the primary verdict above.

```text
VERDICT: CHANGES REQUIRED
Reviewed source a0dfaba against base 5fb97d4. Read-only review; I ran no checks.

B1-01 — should-fix — mobile/authority/local-story/session.ts:119
After action A returns catching_up, a press for different action B reuses A’s retained attempt. If that retry finishes, B’s call receives A’s saved result. While catch-up is retained, compare the new intent with the retained intent and return conflict for a different one; keep A available for completion.

B1-02 — should-fix — kernel/ts/play/replay.ts:8
A trace containing a valid header and elapsed record, followed by a malformed final line without a newline, drops that line during preflight. Replay executes the elapsed command before the final byte comparison fails. Reject a missing terminal newline before dispatch, or parse and validate the final line.

B1-03 — should-fix — mobile/authority/local-story/elapsed-store.ts:29
A v2 elapsed table with a missing column makes the SELECT throw instead of classifying the checkpoint as save_corrupt. Opening then offers no typed Start over; during reconciliation it can remain pending. Validate the table shape as checkpoint evidence while keeping operational read failures distinct.

Ponytail Review: no removable machinery identified. The retained 55-artifact/23-control record is author evidence; earlier controls used bytes preceding final fixes. Its observation sweep reports 244 controls, 161 detected and 83 inherited survivors, without claiming full generator or type coverage.
```

## PM round-one fix scope

The complete open list is primary M1B1-01 plus separate Sol B1-01, B1-02 and B1-03. The same developer receives them together. Review verdicts remain unchanged until scoped independent rechecks.

Under the indexed autonomous mechanics delegation, PM selects an explicit shared-session clarification for B1-01: while an invocation is retained for clock catch-up, a different identified intent returns conflict without releasing the original attempt/reservation or issuing its result as the new action. A matching retry retains the original identity and completion context. Pending unknown-save retries keep the existing documented original-attempt behavior. The implementation amends the active shared Game/save contract and existing B1 adoption accordingly. This is a PM clarification, not an invented owner preference or an independent finding disposition.

Only bounded validated invocation data is snapshotted; ordinary invalid-input admission remains intact. Trusted trace framing is rejected before dispatch. Checkpoint shape validation stays specific to the elapsed table; genuine operational read/rollback failures retain their existing semantics. No general serializer, save validator or native/UI scope is added.
