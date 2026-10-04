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

## Primary scoped round-one recheck

Published source: `b1795facd8b2e32fdcf076332c80ad769633412b`. Requirements derived from the original findings and explicit active Save/Book/B1 amendments before reading fix code:

- Retain a bounded private snapshot of validated targets and nested input without changing malformed/cyclic admission. Completion keeps the original intent and settled before-projection; a later new invocation succeeds.
- During catching_up, a different identified intent conflicts and preserves the original attempt/status. Matching retries preserve identity. Unknown-save pending continues its existing original-attempt behavior.
- Reject unterminated or malformed complete trace input before any trusted or ordinary execution, preserving complete legacy replay.
- Missing elapsed columns are corrupt checkpoint evidence after transaction closure; operational read/rollback failures stay pending. Terminal recovery checks the original bounded raw header witness or loaded managed known run before replacement, including v1 upgrade before its checkpoint. A refused opening never invents or updates its witness. Valid replacement is stale; changed malformed identity is corrupt without writes; unsupported newer format stays refused.
- Recheck only changed code and direct callers, preserve explicit v1 authority behavior, and independently verify additive proof inventories and historical/current-byte distinctions.

**Scoped verdict: CHANGES REQUIRED. Original M1B1-01 and B1-01/B1-02/B1-03 closed; new direct-caller blocker M1B1-R1-01 remains open.**

### Dispositions at b1795fa

- **M1B1-01 closed:** `invocation.ts:21` and `:42` copy only the validated ActionInvocation using the existing bounded canonical seam. The managed session and authority share it; no World copy occurs. The amended finite-horizon case mutates caller targets and nested input, completes the original saved intent at literal 864000, checks the original empty completion payload, and successfully invokes again. Invalid/cyclic input retains existing invalid admission before copy/sampling.
- **B1-01 closed:** `invocation.ts:31-42` compares action/actor/ordered targets/input while catching_up, excluding freshness admission metadata. Different valid intent conflicts without calling the original attempt or releasing it. Matching retry keeps its id; the unchanged unknown-save path retries the original regardless of the new press. Existing receipt-before-sampling/completion coverage remains green.
- **B1-02 closed:** `play/replay.ts:8` requires a terminal newline before parsing, drawing or dispatch. Actual elapsed-trace malformed tail exits before a state draw; complete actual local and legacy CLI traces still replay identically. The one-line play test expectation correction matches preflight timing; it adds no production behavior after the reviewed fix commit.
- **B1-03 closed:** `elapsed-store.ts:31-39` inspects the specific checkpoint columns before its projection. Missing-column evidence becomes typed corruption at opening and closed metadata/gameplay reconciliation. Real operational read failures remain pending. The metadata reconciler checks run before reading checkpoint shape, preserving replacement classification.
- **Direct recovery guards partly correct:** `authority.ts:180-209` compares closed-transaction original raw refused header or loaded managed known run before destructive recovery, distinguishes missing/malformed/replaced witnesses, permits its own loaded v1→v2 transition and honors actual denied ROLLBACK. It preserves explicit v1 authority and higher-format refusal on the focused callers. However, the unreadable-header path below has no loaded meta or captured witness and now fails internally.

### M1B1-R1-01 — blocker — elapsed corrupt-file recovery dereferences unloaded metadata

Source location: `mobile/authority/local-story/authority.ts:190` at `b1795facd8b2e32fdcf076332c80ad769633412b`; direct caller `session.ts:273`. `identityOf` can raise a genuine SQLite corruption error before `openStory` captures recoveryHeader or loads meta. The typed corrupt opening still offers Start over, but replaceable's elapsed-host fallback accesses `s.meta.format`/run_id although meta is absent.

Independent actual-node:sqlite reproduction: create a controlled 4096-byte file of `x` bytes, open it through `localSession` with the existing elapsed fixture and actual controlled clocks, then call Start over. Opening yields `save_corrupt` with `startOver: true`. Start over leaves no Game, never invokes removal, and replaces the recovery message with `Cannot read properties of undefined (reading 'format')`. This bypasses the established proven-corrupt-file recovery path; the 110 green scoped tests cover the legacy corrupt-file case but not this newly affected elapsed caller.

Handle absent loaded metadata without inventing a header/run witness. Preserve explicit confirmed file recovery when actual SQLite corruption is proven, genuine operational header-read uncertainty as pending, and refusal to overwrite a newly valid replacement. Add only the minimal real-corrupt-file elapsed-session regression, extending the existing recovery contract; no broad validator or new format policy is requested.

### Scoped checks and independent controls

Reviewed the fix diff and its direct authority/store/session/replay callers with source outlines and AST JSON call searches. No core rewrite required a broader review. Applied Ponytail Review and correctness pass: the concrete session helper reuses existing validation/canonical encoding for bounded input and respects file caps; targeted PRAGMA/header guards use the existing transaction boundary. **No over-engineering finding.** M1B1-R1-01 is a correctness failure.

- `mise exec -- node --test` over local-story `elapsed-driver`, `session`, `faults`, `observe`, `start_over`, `recovery`, `saves`, `elapsed` plus kernel `play`/`transcripts`: exit 0, **110/110 passed**. Covers amended reservation/input tests, complete legacy and real elapsed CLI replay, actual checkpoint column damage and real SQLite FULL/deferred-FK/lost-ack/process-kill cases, replacement witnesses, legacy explicit authority and unsupported newer format.
- Independent mutant 1 removed the managed-session bounded copy. Existing finite-horizon/caller-mutation case failed (exit 1).
- Independent mutant 2 bypassed recovery witness checking. Existing valid/malformed/absent header replacement case failed (exit 1).
- Both source files restored byte-for-byte in finally blocks. Restored targeted finite-horizon, recovery witness, actual denied-ROLLBACK, real elapsed CLI and complete legacy replay cases: exit 0, **5/5 passed**.
- PM personally verified all six exact-source CI jobs successful at 14:03:16 UTC, last sim at 14:02:56 UTC, and normal author pre-push/push exit 0. These are PM verification; no full pre-push/check_all/native/owner-save operation was rerun by this reviewer.

### Scoped evidence verification

All **55 original**, **28 round-one** and **4 correction** artifact hashes and exact inventories verify; all retained verification OK counts agree. Original artifacts and both original inventory files remain byte-identical against a0dfaba. All **23 final current-source manifest** entries match b1795fa after restoration. The eight round-one controls each retain old exit 0/new exit 1 with corresponding old-green/new-failing logs and source-restored hashes matching current source. Inspected the distinction between actual denied-ROLLBACK closure, proven schema damage, genuinely failed COMMIT and successful COMMIT with lost response.

The earlier 73-test run remains historical and is not labeled final-byte proof. Current 53-test author proof and the later legacy-play correction have explicit scopes; the original 21-entry manifest also stays historical. No retained absolute home paths were found. Native/B2 integration and complete M1-B acceptance remain outside scope. Historical verdicts above are preserved; only this section states round-one dispositions.

## Scoped round-one supplemental format check

Source remains `b1795facd8b2e32fdcf076332c80ad769633412b`. PM requested one additional direct-caller scenario in the newly changed recovery guard; no broad review or completed checks were repeated. The active save opening table refuses higher loka-save-vN formats without writes or a new-game offer. The loaded managed-run clarification permits the session's own v1→v2 transition, not arbitrary format changes.

**Supplemental verdict: CHANGES REQUIRED. Open blockers M1B1-R1-01 and M1B1-R1-02; the four original findings remain closed.**

### M1B1-R1-02 — blocker — same-run newer format is overwritten by loaded elapsed recovery

Source location: `mobile/authority/local-story/authority.ts:200` at the same reviewed SHA. With recoveryHeader undefined after a successful opening, the condition accepts any current format as long as the run matches. It does not limit this exception to a supported unchanged format or the legitimate own v1→v2 upgrade.

Independent actual-node:sqlite scenario: open the controlled elapsed host, whose durable header is `loka-save-v2`, run `aaaaaaaa-0000-4000-8000-000000000002`. Update only its format to `loka-save-v3`, preserving that run, then call the already-open Game's newGame. It returns `replaced` and persists `loka-save-v1`, run `aaaaaaaa-0000-4000-8000-000000000004`. The old session therefore destroys a newer app's unsupported save despite the active save table's no-new-game rule. This is not permitted by the narrow own-upgrade clarification.

Restrict the loaded-run exception to supported transitions, refusing the same-run unsupported header without any writes. Extend existing recovery/unsupported-format behavior coverage with this single loaded-elapsed case and literal unchanged header/progress assertions; retain the valid own v1→v2 upgrade and explicit legacy v1 behavior. No new generic format framework is needed.

Only this controlled SQLite scenario ran; no source mutation, suite, dependency install, build, native or owner-save operation occurred. The earlier scoped checks, independent red controls and artifact/hash verification remain as recorded. This corrects the earlier source assessment that newer-format refusal was preserved on all affected direct callers.

## Separate Sol round-one fix recheck

Requested model `gpt-6-sol`, read-only CLI; runtime model identity unverified. Exit 0. Exact fixed source `b1795facd8b2e32fdcf076332c80ad769633412b`. Raw transcript remains private. Answer SHA-256 `c6cce8838262255ba1f412bc5e5f41081611e844beb56356b55f7c73723c894c`; transcript SHA-256 `743eb48f72f52278ce46ff89e67503291dab1364564f1bde48bc303f557bc5fd`. Exact answer follows; the primary scoped verdict and original historical findings remain unchanged.

```text
VERDICT: CHANGES REQUIRED
Source: b1795facd8b2e32fdcf076332c80ad769633412b
Checks run here: no tests or builds. Read-only comparison found all 22 round-one and 23 final source-manifest hashes matching; retained red-control and test logs were inspected, not rerun.

M1B1-01 CLOSED — session.ts:104-122 retains a validated, bounded copy. The retained control covers caller mutation, saved completion at 864000, and a successful next input.
B1-01 CLOSED — invocation.ts:24-46 conflicts a different identified intent during catching_up while preserving the held attempt; the pending path keeps original-attempt retry behavior.
B1-02 CLOSED — replay.ts:7-8 rejects an unterminated trace before main.ts:300 draws or dispatches. The retained complete legacy replay case remains green.
B1-03 OPEN — elapsed-store.ts:29-43 classifies missing columns as typed corruption, and authority.ts:180-210 guards recovery after closure. One required classification remains wrong.

New finding, should-fix — authority.ts:204 and elapsed-store.ts:91-96: after a refused opening, change the save header to a different valid run ID but a malformed format, leaving its pin intact. The recovery guard refuses replacement, but changedRun returns stale_view because it checks run ID and pin, not format. The active PM decision requires save_corrupt for a changed malformed header witness, with no write. The retained recovery test covers a malformed original format and a changed invalid run ID, but not this changed-format case.

Ponytail Review: Lean already; no removable machinery identified.
```

## PM round-two fix scope

The complete remaining list is primary M1B1-R1-01 (corrupt-file opening without loaded metadata), primary M1B1-R1-02 (same-run newer save format overwritten), and separate Sol's B1-03 classification finding, tracked as Sol-R1-01 (a changed malformed-format witness with a valid differing run misclassified stale). The primary closed the original four at its tested scope; Sol's remaining classification is independently retained, not overridden. The same developer receives the complete list together.

PM applies the existing explicit corrupt-file recovery policy: known SQLite NOTADB/page corruption is distinct from an operational header-read uncertainty. Preserve the confirmed host recovery path for that proven corruption without inventing a metadata/run/header witness or dereferencing unloaded metadata. Genuine operational read or rollback failure remains non-destructive pending. A newly readable valid replacement must remain protected; the old authorization never silently adopts a new witness. Amend the active durable-elapsed paragraph and existing PM policy to make this distinction explicit alongside the existing corrupt-file clause. No automatic reset or general validator is authorized.

The loaded managed session's supported own v1-to-v2 transition is narrow. A newer unsupported format must remain refused without writes or a new game, including a same-run header; malformed-format drift is not a valid replacement merely because its run ID and parsed pin exist. Classify changed malformed witnesses as save_corrupt without writing, while retaining valid different-run stale protection and the supported upgrade path. Preserve explicit v1 authority behavior. All format/header checks stay within the existing recovery boundary, not a new save-validation framework.

Add only the actual uncovered regressions and distinct red controls needed for these three cases, after the old same-layer suite demonstrates the gap. Keep historical inventories unchanged and append honest current-source/final-check evidence. Normal pre-push is the final full check; exact pushed-head CI and concurrent primary/Sol scoped rechecks remain required before merge.
