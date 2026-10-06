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
  actual Book dream/live-action checks: **64 passed**, exit 0. Forced Elixir
  dream/service/scene/current chapter checks: **12 passed**, exit 0.
- Independent mutations removed the typed Rest producer and separately removed the
  exact Continue beat guard. Dream tests exited1 for both; the latter accepted stale
  beat2 at final5. Originals restored; all six kernel dream tests pass again.
- Controlled duplicate source above: compiler exit 0; emitted artifact loader refuses
  `DUPLICATE_DEFINITION`. This is an observed discrepancy, not a source-text test.
- Final evidence update changes only four evidence files; all **35** retained
  SHA256SUMS entries verify. Inspected frozen-source full gate records exit 0 and
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


## Developer disposition — B9-P1

Rest duplicate grouping now uses the tagged room/detail pair, matching the existing
TypeScript loader; existing modal identities are unchanged. The new compiler test
uses distinct credit/memory/quest refs, accepts different rooms/details and refuses
both same-anchor sites. Restoring whole-map comparison leaves the older focused
compiler suites green and this test red. Evidence is retained in the
[B9 behavior controls](../evidence/2026-10-05-b9-lantern-dream/behavior-controls.log)
and [failed assertions](../evidence/2026-10-05-b9-lantern-dream/behavior-failing-assertions.log).
Scoped independent recheck remains required; the original verdict above is preserved.


## Scoped B9-P1 fix recheck — APPROVE

Corrected source: `667347ac14c36e996e6c71048dae99e87db4a322`.
Final evidence-only head: `387c77a47e1b8019fd0cd2ac4d3bd517ec0f1d8a`.

B9-P1 is resolved. Compiler duplicate identity is now the tagged Rest room/detail
pair, matching the existing TypeScript loader; entitlement/credit/quest differences
cannot hide a duplicate. Distinct rooms and details remain accepted, and non-Rest
modal `on` maps retain their previous comparison. The change and direct callers add
no further scoped finding. Ponytail Review: Lean already.

Independent forced Elixir dream/scene/service run passes all nine tests. Restoring
the old whole-map comparison leaves eight older tests green with the new case
excluded; the new tagged regression exits2 at its duplicate-refusal assertion,
because the compiler incorrectly returns `{:ok, ...}`. Restoring the source yields
all nine green again. The original primary-review disposable duplicate source now
exits1 with `DUPLICATE_DEFINITION` at both `dream_again.on` and
`dream_of_the_fen.on`. No source edits remain.

The final update changes only eight evidence files; all 37 retained SHA256SUMS entries
verify. Inspected corrected-source full gate records exit 0 and 350 Elixir tests;
focused evidence records 106 TypeScript and 15 forced Elixir tests passing. Original
source failures/history remain preserved. Current v026/API1.24 pins remain
provisional for the actual published-predecessor integration. This scoped approval
closes B9-P1 and supersedes the original primary verdict for corrected source only;
no browser/native, owner-save or publication claim is added.

## Published-predecessor integration recheck — APPROVE

Final combined source: `7bc3f745658b6727ce252c639ea9116a637c833a`, including published
D5/D2 source `4bcb2eafd0a984c611b71c3e4dc1e0d26defd533` and PR225 docs
`dec92357`. Final evidence-only head: `a39d698c4399b352c19f150d3992b18d2db9ca7f`.

Reviewed both-parent changes at the shared Book/schema/content boundaries. D2's
exact item Read, open-container reach, receipt narration and pending remount/title
retry routes remain; B9 adds its separate dream Page/owner/context without replacing
those routes. Body receives the existing Back callback, so Dream Close returns to
the real bed. Both short-reference expansion clauses and the renderer import union
remain. B9 scene sequence/projection/Book dream modules and the P1 compiler identity
fix are unchanged from the approved source; the consumed dream API floor advances
to 1.25 while D2 item Read retains its 1.24 floor. No new finding.

Independent checks on behavioral integration head `066bfda4`: **32** focused kernel, loader, Priory,
actual Book and real-SQLite dream/Read tests pass; **13** forced compiler
dream/Priory/modal/current chapter tests pass. Contracts generation and both
renderer/rule import suites pass. The distinct-anchor and same-anchor compiler
regression remains green. Prior red controls remain applicable to the unchanged
B9 behavior; this read-only integration check adds no source mutation.

Complete compiler bytes and all **127** initial allocations match v028/API1.25
hash `424a4497cca18c9f00b333cc8489eb9e95ce52f5239d6a394e4fa25e3d1fb34e`.
An independent Python canonical/hash and decoded predecessor comparison confirms
only the B9 actions/facts/quest/scene/text additions and manifest requirement change;
there are no inherited payload changes or removals. Published v027 predecessor
literals and original B9 provisional fixtures are byte-unchanged.

The later source-size correction at `e3517e7e` only shortened a comment in
`checks.ex`; independently parsed before/after executable ASTs agree after metadata
removal. The final five-file renderer correction reuses the existing action label
closure for unavailable Notice notes and documents that [shared Book rule](../system/book-ui.md). PM visual
QA found raw `action.rest` at the acknowledged bed; the [actual Book regression](../../mobile/app/book/dream.test.ts) now requires
literal `Rest: not now`. No gameplay, save, schema or pin changes accompany it.
Independent final-source dream/notice/Priory/live-action Book checks pass **26**
tests, including both uncertain Read remount routes; app typecheck passes.

Verified final evidence-only update: all **69** retained files appear exactly once
in SHA256SUMS and verify; the manifest itself is the sole unlisted file. Inspected
exact-source full gate records exit 0 with **351** Elixir tests and all active
checks. Both actual Web routes pass on the final source, including captured dream
choice reload/Resume and human `Rest: not now` after acknowledgement and cold
reload. Viewed the final dream-choice and acknowledged-bed captures: the offered
branches, Close, real bed and human unavailable label agree with the recorded route.

The retained label red control fails the literal `Rest: not now` assertion on old
production, then restoration passes. Retained Web choice-phase Resume omission
keeps the older saved-movement route green and makes the new paid route fail at
Resume. The integrated 17 behavior, 73 schema and four import controls restore
cleanly; original setup, contention, size and pre-label outcomes remain preserved.

Ponytail Review: Lean already. This approval covers the combined local source and
retained integration proof, superseding the prior provisional-source scope;
publication remains pending. No owner-save or native lifecycle proof is added.

## Final hosted source-head Sol review

The PM ran a read-only independent `codex exec` review after all six hosted checks
passed on PR #226 at `34dfc630917297c194ef243641907be4a4ad6dbd`.
The output below is reproduced verbatim:
```text
APPROVE

Reviewed exact head 34dfc630917297c194ef243641907be4a4ad6dbd against base dec92357f6bdc6242e06ceb56f7c9da0abed8a84. No findings.

Correctness assessment: paid Rest starts one durable dream; Close/Resume preserves its checkpoint and branch; only final acknowledgment commits memory and S10 resolution. Receipt replay, uncertain-COMMIT fencing and cold recovery preserve once-only behavior. D2 Read remains independent, and unavailable Rest uses the human label “Rest: not now”.

Executable source matches the previously approved frozen source. Independently verified all 69 evidence hashes and the v028/API1.25 canonical payload/hash; inspected retained behavior controls and browser captures.

Ponytail assessment: lean composition using existing state, transaction, receipt and Book owners; no unnecessary machinery found.

Read-only review; no files edited or broad suites run. Hosted CI status accepted as reported.
```