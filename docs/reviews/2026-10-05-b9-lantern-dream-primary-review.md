# B9 Lantern Rest and dream — independent primary source review

Exact frozen source: `8b9e5b52fffdffd34569cb0f6aa837090a7478df`.
Final evidence-only head: `05b49b37e167a31e812dbef6b55b34d4aa83a0f5`.
Local branch `slice/b9-lantern-dream`; publication null. Fresh reviewer authored none
of this source. Detached review worktree; no developer checkout edits.

**Verdict: CHANGES REQUIRED.** One finding, B9-P1, below. Current bundled player
path passes the reviewed checks; the compiler boundary still violates its contract.

## Required truths

Derived before examining the source diff from the adopted
[brief](../briefs/chapter-one/b9-inn-dream-brief-2026-10-05.md),
[mechanics](../system/mechanics.md#s10-lantern-rest-and-dream-b9-selected-contract),
[declarations](../system/cartridge.md#b9-lantern-dream-declarations),
[protocol](../system/protocol.md#b9-rest-occurrence-and-dream-composition),
[save](../system/save.md#b9-dream-recovery) and
[Book](../system/book-ui.md#b9-bed-and-resumable-dream-details):

- Only a new accepted paid Rest at the actual bed room credits S10 and starts beat1;
  rental, Sleep, old unpaid Rest and replay cannot charge or credit again.
- The anchored checkpoint/branch survives Close, travel, ordinary dialogue/modal,
  elapsed and same-body death/return; it changes no custody, time or ordinary choice.
- Exact shown beats and captured choice identity govern admission; final acknowledgement
  alone commits once-only memory/S10 resolution, without a completion report.
- Confirmed Book nesting/history uses the real bed; pending/cold/dormant presentation
  cannot narrate an unconfirmed dream or hijack World. Both source boundaries reject
  duplicate triggers and invalid consequence ownership; pins stay provisional.

## Finding

**B9-P1 — blocker — `lib/loka/content/scenes.ex:297`: compiler permits two dreams
for one exact Rest trigger.** `duplicates/1` groups the whole `on` map. Author a
second scene at the same `inn_rooms`/`bed`, with separate false player credit/memory
facts and a separate matching S10-shaped quest. All declarations otherwise remain
valid. Elixir compilation exits 0 because the two `on.rest` maps differ; loading
that exact emitted artifact refuses `DUPLICATE_DEFINITION` at
`.cartridge.scenes["ashmere_missing_child@0.0.26:scene/dream_again"].on`.
The compiler therefore reports success for an unloadable artifact, contrary to
[unique-trigger validation in both languages](../system/cartridge.md#b9-lantern-dream-declarations).
Normalize presentation Rest trigger identity to the same room/detail identity used
by `kernel/ts/src/content/cartridge_scenes.ts:32` and add the missing controlled
compiler regression/red control. Keep existing modal duplicate semantics.

## Independent verification

- Focused kernel/loader/position/modal/dialogue, real SQLite dream/service/scene and
  actual Book dream/live-action checks: **64 passed**, exit0. Forced Elixir
  dream/service/scene/current chapter checks: **12 passed**, exit0.
- Independent mutations removed the typed Rest producer and separately removed the
  exact Continue beat guard. Dream tests exited1 for both; the latter accepted stale
  beat2 at final5. Originals restored; all six kernel dream tests pass again.
- Controlled duplicate source above: compiler exit0; emitted artifact loader refuses
  `DUPLICATE_DEFINITION`. This is an observed discrepancy, not a source-text test.
- Final evidence update changes only four evidence files; all **35** retained
  SHA256SUMS entries verify. Inspected frozen-source full gate records exit0 and
  349 Elixir tests. Developer evidence retains schema/import controls and failed
  assertions; no independent full gate rerun was needed for this record.
- Independently reran candidate pin check: complete compiler bytes and all111 initial
  IDs match v026/API1.24 hash `1f4ab337de228080fd3f95fca6493a7525b7bc0b1f5c4212e4eee6d750fde0bc`.
  Combined predecessor/successor integration pins remain provisional.

Ponytail Review: Lean already. No new dependency, portable op, saved table, generic
interpreter, snapshot or second history verifier; no complexity finding. Review
source changes and independent red controls restored cleanly. No browser/native
layout, device lifecycle, owner-save or publication proof is claimed. Separate
save/protocol opinion remains required by the workflow.
