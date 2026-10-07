# E1 service GameView envelope independent review

## Initial source — CHANGES REQUIRED

Reviewed `ccb30248eab9396fef672d6877dea2c149a46b8c` and governing spec commit `a8501f17700cb28ad14110fc757d7541c3d06eee`. Scope: service oracle identity, pre-choice/nil/foreign precedence, focused regression, size and selected-v042 seed 2079. Reviewer authored none of the source. Governing clauses: [protocol Step and GameView](../system/protocol.md), [D11 mechanics](../system/mechanics.md#d11-character-choice-selected-contract), AGENTS test discipline.

- **E1-ENVELOPE-R1 — blocker:** `kernel/ts/src/view/invariants_view.ts:30` has 41 lines against limit 40; actual changed-file size check exits 1. Closed at `be15cd81615425563496c5928ee96c6cbd7227d6`: local alias `context` and single-line dispatch preserve the observed-context default and comparisons; size check exits 0.
- **E1-ENVELOPE-R2 — should-fix:** `kernel/ts/test/service.test.ts:26` missed an over-permissive nil guard. Replacing its nil branch with `return true` let all seven service tests and the existing focused foreign-world test pass. Closed at `520a747d87ebe9f5126504d189eb55ec01f65daa`: the same controlled nil command now rejects counterfeit accepted and wrong-`not_found` decisions with literal `false` expectations. The permissive mutant fails the new assertion (6 pass, 1 fail).

## Final source — APPROVE

Exact reviewed head: `520a747d87ebe9f5126504d189eb55ec01f65daa`. No open findings. Source gives pre-choice `invalid_state` priority, then nil `permission_denied`, then foreign world/actor `not_found`, before exact offer comparison. Controlled real v042 probes confirmed pre-choice priority even with nil/foreign identity. Runtime and trusted elapsed paths are unchanged.

Independent checks: final service suite 7/7; existing focused foreign-world control passes; typecheck and changed-file size check exit 0. Docs at the unchanged protocol revision reported 778 documents, zero broken links/unreachable files. Actor-guard and nil-guard removal each fail the regression. Mutants used read-only Node load hooks; on-disk source remained unchanged.

Explicit loaded v042, generator 17, seed 2079 passes 61 steps at final head; digest `df0b953898d54bc87a4bdcb43f1046c1da2f7498cc7c075ab71dc12123927510`. Ponytail Review: Lean already; existing oracle/fixture reused without runtime machinery. Original screen failure stays immutable. Final 10,000-sequence E1 proof remains pending; no broad local gate, native session or owner save was used.
