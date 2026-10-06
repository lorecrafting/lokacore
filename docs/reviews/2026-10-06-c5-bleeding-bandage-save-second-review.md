# C5 bleeding and bandage — provisional save/protocol second opinion

**CHANGES REQUIRED.** Independent reviewer authored none of C5 source.

- Exact provisional source: `2784e40b39d60d06b6a19353558144ce051408f7`.
- Base: published C5 plan `f014aa26`; final D6/D7 successor integration and release pins remain separate.
- Governing [brief](../briefs/chapter-one/chapter-one-c5-bleeding-bandage-brief-2026-10-05.md), [protocol](../system/protocol.md#c5-bleed-and-bandage-composition), [save](../system/save.md#c5-bleed-and-bandage-recovery), [storage lessons](../lessons/storage.md), and [contract lessons](../lessons/contracts.md).

## Findings

| ID | Severity | Location | Evidence and required action |
| --- | --- | --- | --- |
| C5-S1 | blocker | `protocol/delta.schema.json` `BleedRow` | The active variant requires only `active` and `generation`. On this exact source, `validate('BleedRow', {active:true,generation:1})` and `validate('DeltaOp', a `bleed.transition` carrying that value) both return no errors. The selected protocol clause requires the generic delta validators to reject malformed rows. Make active fields required and inactive fields forbidden in the schema subset supported by both kernels; plant a missing-field fixture and run the required bound/required mutation sweep. Composition's later shape rejection does not fulfill the validator contract. |
| C5-S2 | publication gate | `mobile/authority/local-story/c5_bleed.test.ts` | The two C5 SQLite tests prove ordinary managed catch-up/reopen and a normal cure/replay. They do not exercise a genuinely failed COMMIT, unknown COMMIT with both committed and absent outcomes, or fenced input/elapsed at an active bleed, tick, fatal return or cure. The selected save clause and brief require these changed-row transaction checks. Reuse the existing fault harness and assert complete old or new HP/bleed/job/item/encounter/head/receipt truth. |

The generic saved-history replay is valuable and must be retained. I changed a saved inactive C5 row to malformed active JSON (`active:true,generation:1`) in a disposable SQLite test, then cold reopened it. `receiptHistory` rejected the mismatch with typed `save_corrupt`; the test failed at its intentional `open` assertion. I restored the temporary test and diagnostic changes; no source change remains in this review branch. Thus missing a dedicated C5 loader function is **not** a finding.

## Checks and limits

- Baseline C5 real SQLite tests: 2/2 pass.
- Malformed stored row control: cold reopen returns `save_corrupt`; this is a positive recovery check, not a red test for the new schema guard.
- Direct TypeScript contract probe: both malformed active row and containing DeltaOp returned `[]`, proving C5-S1. The Elixir validator shares the schema, but an independent Elixir runtime check could not run here because this isolated worktree lacks the pinned Mix dependencies; final differential gate remains required.
- Reviewed exact bandage custody, job cancel/complete, managed elapsed tick succession, same-due pairing, receipt replay and TS/Elixir compose paths. No separate source defect found in those paths at this provisional head. This is not final predecessor or exact-head publication approval.

Ponytail Review: lean already. The schema can express the two closed variants with the existing discriminated `oneOf` subset; use the current transaction fault harness rather than adding a C5-specific save engine. No dependency or general status framework is warranted.

## Scoped fix recheck — APPROVE

Corrected source `97b5b94e4f02d81ea329b640c9a94fdbdf37fbad`. **C5-S1 and C5-S2 are closed for this provisional source.** The historical findings above remain the initial result.

- **S1:** `BleedRow` is now two closed `active`-discriminated object variants. The active one requires effect, producer, end, next tick and owned job; the inactive one permits only generation and `active:false`. Direct probes of both generic validators returned the same five `missing_property` paths for `{active:true,generation:1}` and for a containing `bleed.transition`; both rejected an inactive row with `job_id` as `unknown_property`. Focused TS 2/2 and Elixir 2/2 tests pass. The corrected source adds per-field missing-property controls in both kernels.
- **S2:** The real SQLite test now exercises both an active tick and an exact held-item cure under three COMMIT outcomes each: deferred foreign-key failure, uncertain absent COMMIT, and committed COMMIT with lost acknowledgement. It checks pending fences for another input and elapsed, old or new head/state rows/receipts, HP, bleed activity, current job, item custody, cold reopen and same-command replay. All six cases pass; the two C5 SQLite tests pass together. The ordinary managed catch-up and cured replay controls remain green.

The two validators, receipt replay and changed-row transaction remain the existing owners; no C5 save engine or general status layer was added. I inspected only the corrected schema, validator dispatch, fault fixture, save narration change and their direct callers. The required complete changed-schema sweep, broader full gate, final D7 predecessor integration/pins and hosted exact-head checks remain publication gates outside this scoped approval. No source was edited by this reviewer.
