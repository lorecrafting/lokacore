# M2-A position recovery review

PR: [#156](https://github.com/lorecrafting/lokacore/pull/156). Reviewed implementation:
`051bd6d3fe03ab8555b1089df60b79ef025a69aa`. Fresh independent primary reviewer;
authored none of the implementation. Primary verdict: **CHANGES REQUIRED**.

## Findings

**M2A-01 — blocker, `kernel/ts/test/compose.test.ts:286` and
`test/loka/core/compose_test.exs:434`: independent stored-rate validation survives deletion.**
Astra supplied a concrete surviving mutant; primary independently reproduced its TypeScript
half. Removing authored stored-rate membership in `runtime/invariants_resource.ts:19`
leaves all nine composition tests green. With clock64803, every10, rates2/2/4/4, stored
`{value:0,at:64800,rate:3,remainder:0}`, an adjustment from0/to0/next_rate2 and forged
success `{value:0,at:64803,rate:2,remainder:9}`, the original checker rejects and the
mutant accepts. The existing malformed-success control supplies remainder0; that separate
metadata mismatch masks the missing membership check. Astra reports the same surviving
Elixir mutant. Add the independent literal forged-success witness to both runners; show
both existing membership guards' removal fails the new assertion, and restore exactly.
Production validation is correct at this head; the claimed independent guard assurance is
not complete until this regression control fails when that guard is removed.

## Requirements derived before the diff

Read [the brief](../briefs/m2-a-position-recovery.md), its adopted literal/rate-boundary
companions, developer handoff and governing active clauses before reading implementation.

- [Resource and position](../system/mechanics.md#resource1-kerneltssrcmechanicsresourcets):
  old-rate exact settlement, fraction retention below full, cap-credit discard, literal zero
  rates, pure queries, required player birth rows including clock zero, and resource metadata
  adjustments before the position assignment in one writer group.
- [Composition/final adoption](../system/protocol.md#composition): committed base clock,
  authored next-rate membership, same-writer row overlays, independent metadata replay,
  and a final player rate/position guard before acceptance retaining the prior World on fault.
- [Compiler/loader](../system/cartridge.md#compiler): complete bounded position rates,
  positive safe interval and exact residual bound, position/elapsed/API1.2 dependencies;
  frozen legacy numeric vectors and behavior remain intact.
- [Save loading](../system/save.md#the-save-file-loka-save-v1): refuse missing, malformed or
  position-inconsistent opted rows; reconciled adoption uses the same load boundary without
  bypassing closed-transaction/unknown-COMMIT fences or rewriting progress.
- [PM adoption](../decisions/pm-decision-m2-a-position-recovery-2026-10-04.md): actual
  sampler consumes MV1 and the 18/36 recovery table with MV-specific bands, preserved HP/MA
  and Bram departure; simulator correction changes only drained-row metadata preservation.
  Native preview remains a separate batched carry.

## Evidence and assessment

Read all changed implementation and test hunks, portable arithmetic and independent replay
twins, direct resource/position/proposal/save consumers, schema/generated changes, consumer
authoring and independent sampler oracle. Scoped TypeScript structural outlines/searches
preceded large source reads. The fixture supplement matches the independent literal brief,
including the uncapped safe-clock boundary answer value12/remainder9. Existing frozen
composition answers and older cartridge known answers were not changed.

Reviewer commands (project-pinned tools):

- `mise exec -- node --test kernel/ts/test/compose.test.ts kernel/ts/test/position.test.ts mobile/authority/local-story/resource-recovery.test.ts`: EXIT0, 24 passed;
  same restored command EXIT0, 24 passed.
- `mise exec -- mix deps.get`: EXIT0; `mise exec -- mix test test/loka/core/compose_test.exs test/loka/content_rest_test.exs test/loka/cartridge_cross_kernel_test.exs`:
  EXIT0, 18 passed. Both twins independently assert the literal supplement; the compiled
  actual sampler is accepted by API1.2 and refused by API1.1.
- In-memory TypeScript schema sweep removed each new required entry/bound separately:
  all17 mutants changed the literal validation result and were killed; EXIT0.
- Final agreement-call removal, then
  `mise exec -- node --test --test-name-pattern='public admitted proposal' kernel/ts/test/position.test.ts`:
  RED EXIT1, accepted wrong-rate proposal versus the literal precondition fault.
- `next_rate ?? before.rate` changed to truthy fallback, then
  `mise exec -- node --test --test-name-pattern='opted recovery literal' kernel/ts/test/compose.test.ts`:
  RED EXIT1, rate2 versus literal0. Both source files restored exactly before the green rerun.

Real rollback-journal SQLite cases exercise reopen/receipt replay, corrupt load/reconcile,
genuine SQLITE_FULL and failed deferred-FK COMMIT. These and the actual elapsed sampler
consumer passed; they establish headless behavior, without claiming native acceptance.
PM separately verified all six CI checks on the reviewed implementation head; the reviewer
did not duplicate full prepush or touch owner Simulator/save state.

Ponytail/Ponytail Review: lean already; no speculative framework, dependency, host timer or
whole-state copy. The small resource modules preserve source-size limits and independent
arithmetic. Position coupling is explicitly required by the active specification; consumer
numbers stay in cartridge source. No production correctness or complexity finding remains;
M2A-01 requires a narrow test-control fix before approval.

Separate Sol review remains required; this primary verdict does not stand in for either
required independent review. Astra implementation review follows verbatim.

## Separate Astra implementation review

```text
CHANGES REQUIRED
PR156 — reviewed SHA051bd6d3fe03ab8555b1089df60b79ef025a69aa

A1 | blocker | kernel/ts/test/compose.test.ts:286; test/loka/core/compose_test.exs:434
The malformed-success controls always fabricate rate2/remainder0, masking missing stored-rate validation. Removing authored-rate membership from either independent replay implementation leaves its composition suite green (TS9/9; Elixir11/11).
Concrete witness: every10, authored rates2/2/4/4, clock64803, old row{value:0,at:64800,rate:3,remainder:0}, adjustment from0/to0/next_rate2, claimed row{value:0,at:64803,rate:2,remainder:9}. Both original checkers reject; both mutants accept. Add this independently calculated success-shaped observation to both runners and demonstrate membership-removal red. Production validation is currently correct; this blocks under WORKFLOW’s surviving-mutation rule.

Validation actually run in isolated detached worktree:
- mise exec -- node --test kernel/ts/test/compose.test.ts kernel/ts/test/position.test.ts mobile/authority/local-story/resource-recovery.test.ts: EXIT0,24 passed, including restored run.
- mise exec -- mix test --force test/loka/core/compose_test.exs test/loka/content_rest_test.exs test/loka/cartridge_cross_kernel_test.exs: EXIT0,18 passed after restoration.
- Disabled final proposal guard: EXIT1, one position test failed. Cleared stored fractions: EXIT1, four tests failed.
- Stored-rate membership removal: existing focused suites EXIT0; independent literal witness EXIT1 in both languages (mutant incorrectly accepts), original witnesses EXIT0.
- Compiler-resolved callers inspected with mix xref. Exact diff restored and clean.

No additional production correctness or Ponytail findings. Arithmetic, final-only agreement, load/reconcile, receipt atomicity and legacy paths reviewed. Native proof remains deferred. No full-check, push or owner-save operations.
```
