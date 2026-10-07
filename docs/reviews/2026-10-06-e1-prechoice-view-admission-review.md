# E1 pre-choice view/admission independent review

## Initial review — CHANGES REQUIRED

Reviewed source `7ec1837a2b9d47a731f34a42d6b3d8d8cf5563f8` against published main `a111ac418d1895a4a56a132c39360b2502d97126`. Reviewer authored no source. Scope: shared refusal guard, view projection, command identity, trusted elapsed, focused regression and the retained selected-v042 seed-360 failure. Governing clauses: [protocol GameView](../system/protocol.md), [D11 mechanics](../system/mechanics.md#d11-character-choice-selected-contract), and AGENTS specification/test discipline.

**E1-PRECHOICE-R1 — blocker:** `docs/system/protocol.md:317` explicitly says a Move with no matching composed action projects `unsupported_capability`. Before character choice, `commands/actions.ts:131` exposes only Choose ancestry; this fix now projects `invalid_state` instead, consistent with `runtime/world.ts:124` player admission. Amend the GameView clause to state pre-choice gate precedence in the same repair PR. The PM agreed to this clarification. No other correctness findings.

The guard preserves chosen-character and legacy behavior. It exempts Choose ancestry and elapsed; trusted `stepElapsed` retains its separate schema/derived-ID/identity checks. Normal player `step` still refuses elapsed. Runtime envelope checks were not changed. This review does not reopen existing pre-choice identity precedence.

Validation at the exact source:

- `mise exec -- node --test --test-reporter=dot kernel/ts/test/character_choice.test.ts`: exit 0, seven tests pass, including due-job completion without automatic ancestry choice.
- Same suite with a Node load hook removing only the newly inserted shared guard in memory: exit 1, one failure; the new literal exit assertion sees `unsupported_capability` instead of `invalid_state`. No on-disk source mutation.
- Explicit loaded v042 simulation, generator 17, seed 360: exit 0, 55 steps, digest `e8fe5a1d9bd7df962945ab9ab264e7971a3a6bc33f2e31b0a9e7a8a630c500ae`.

Ponytail Review: Lean already. Reuses existing selection lookup and refusal path; no new abstraction or dependency. Correctness pass found only R1. The earlier 10,000-sequence attempt remains failed and immutable; this focused seed pass is not final E1 certification. No broad local gate, ExUnit, native session or owner save was used.

## Scoped re-review — APPROVE

Reviewed exact amended source `0893b598bf8d27b00d2e4aa78c544b2b7f21f749`. **E1-PRECHOICE-R1 closed:** Step and GameView now explicitly give the D11 pre-choice `invalid_state` gate precedence over ActionSet matching. Trusted elapsed retains its separate admitted route.

The three `needsAncestry` call sites preserve their original actor arguments and truth conditions: engine uses `world.character`, composed uses its actor, and refusal uses `world.character`. Boolean normalization does not change branch behavior. The helper reuses an existing predicate and satisfies the function-size limit; no extra configuration or abstraction is needed. Runtime identity and elapsed paths remain unchanged.

Exact-head validation: `npm run typecheck` in `kernel/ts` exits 0; `elixir bin/check_docs.exs` reports 776 docs, zero broken links/unreachable files; the focused character-choice suite passes 7/7. Removing only the amended shared guard with the read-only Node load hook again fails the exit-reason assertion (6 pass, 1 fail). Selected-v042 seed 360 passes 55 steps with unchanged digest `e8fe5a1d9bd7df962945ab9ab264e7971a3a6bc33f2e31b0a9e7a8a630c500ae`.

No open findings. Ponytail Review: Lean already. Reviewer authored no source. The original final-head simulation failure remains retained; 10,000-sequence candidate proof remains pending.
