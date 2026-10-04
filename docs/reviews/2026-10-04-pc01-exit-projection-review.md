# PC01 exit projection review — 2026-10-04

- PR: [#160](https://github.com/lorecrafting/lokacore/pull/160)
- Reviewed head: `120549f120e5a7273ce1a3f63df4e6730158f957`
- Reviewer: fresh independent agent; authored none of the implementation.
- Verdict: **CHANGES REQUIRED**.

## Requirements derived before reading the diff

Sources: [ActionSet and admission](../system/protocol.md#actionset-and-admission),
[the decision loop](../system/protocol.md#the-decision-loop), and
[GameView](../system/protocol.md#gameview), plus the PR's stated scope.

1. Exit availability must agree with the actor's composed ActionSet and its movement
   admission policies, including room contributions that remove or override Move.
2. An admission refusal must precede passage, position, and movement-resource refusal;
   ordinary open/closed/locked, position, and fare behavior must remain correct.
3. Projection and direct movement must share admission semantics, including command
   aliases, without recomposing the world for each exit or adding content-specific logic.
4. The regression must use a valid loaded cartridge and literal expected behavior for
   exit availability, place actions, invocation resolution, and direct command refusal.
   A realistic removal of the new admission guard must make the test fail.

## Findings

### EXIT-1 — blocker — policy refusal can regress without any test failing

Location at the reviewed head: `kernel/ts/test/exit_admission.test.ts:9`;
production branch: `kernel/ts/src/view/view.ts:169`.

The new regression covers a removed Move but never an offered Move whose policy fails.
A realistic mutation that preserves `unsupported_capability` but drops `invalid_state`
from the new exit admission guard passes all **405 committed kernel tests** (exit 0).
This violates the repository's mutation-check requirement and the new GameView policy clause.

Controlled failure scenario: load the existing ferry fixture using `ferry_probe.world`,
adding the following cartridge action (the helper rehashes it and the real loader accepts it):

```ts
c.actions['ashmere_ferry@0.0.1:action/move'] = {
  key: 'move', label: 'actions.coil_rope', accessibility: 'actions.coil_rope',
  target: { kind: 'none' }, input: ['direction'], command: 'move', priority: 0,
  policy: { policy_version: 1, root: { op: 'time_window', from: 1, to: 2 } },
};
```

At the ferry's initial clock, that policy is false. The literal required result is
north exit `{ available: false, reason: { code: 'invalid_state' } }` and direct north
Move `invalid_state`. Under the mutant, the exit becomes available while direct Move
still rejects `invalid_state`. A reviewer-only witness asserting those literal answers
fails (exit 1), proving the mutant changes real behavior rather than being equivalent.

Mutation applied only to the new projection expression:

```ts
(refusal(world, { type: 'move', actor_id, direction }, { n: 0 }, undefined, set)
  === 'unsupported_capability' ? 'unsupported_capability' : undefined) ??
```

Required fix: add a minimal behavioral regression for a valid, policy-denied movement
ActionSet. Demonstrate this mutant fails it and the restored implementation passes.
A second overlapping fixture or production helper is unnecessary.

## Validation and scope

- PM independently confirmed all six CI jobs succeeded on the exact reviewed head;
  the reviewer did not rerun the full Elixir/mobile/native lanes.
- `mise exec -- npm ci` in `kernel/ts`: exit 0.
- `mise exec -- node --test test/exit_admission.test.ts`: exit 0, 1/1 passed.
- `mise exec -- node --test 'test/**/*.test.ts'`: exit 0, 405/405 passed.
- Restoring the old modal-only gate: the new regression fails (exit 1), advertising
  north available `true` instead of `false` / `unsupported_capability`.
- Policy-bypass mutant: full committed kernel suite exit 0, 405/405 passed;
  controlled policy witness exit 1, available `true` instead of `false` / `invalid_state`.
- Restored source: 10 reviewer-only controlled ferry cases pass (exit 0): denied policy;
  Move removed with an allowed alias; denied Move plus allowed alias; removed Move before
  a closed barrier; denied Move before a closed barrier; ordinary closed barrier;
  seated movement; denied policy while seated; exhausted fare; denied policy before fare.
- AST caller search checked `refusal` in `runtime/world.ts` and `view/action_lists.ts`,
  plus the sole `exits` caller in `view/view.ts`. Existing keyed callers retain their
  semantics. Exit projection supplies the actor's resolved set once across all exits;
  no repeated per-exit composition or whole-state copying is introduced.
- Composes-with statement holds: room contributions, movement, passage, position and
  resources meet through the existing ActionSet/command vocabulary; no ferry-specific
  production branch is introduced. Frozen fixtures and protocol contracts are unchanged.
- Correctness self-review: no production correctness finding at this head; EXIT-1 is
  the required regression protection for a new documented branch.
- Ponytail Review: **Lean already. Ship.** Reuses the existing refusal function with an
  optional composed set; no dependency, one-use abstraction or redundant helper to cut.
- All temporary source mutations and reviewer-only witness files were removed before
  committing this record. Only the review record and index are committed.

## Fix recheck

### Round 1 — EXIT-1 closed — APPROVE

- Source fix head: `c5f0b8e2e1eba88a9bd60fb518dea606c4a67948`.
- Scope: EXIT-1 disposition only, its changed test and the unchanged admission/projection
  callers. No settled part of the original review was reopened.
- The only source-fix diff adds the policy-denied Move regression at
  `kernel/ts/test/exit_admission.test.ts:42`. It uses the existing loaded, independently
  rehashed ferry fixture with a `time_window` from 1 to 2 that is false at its initial clock.
  Expected unavailable exit / `invalid_state` and direct refusal are independent literals.
  The test catches a distinct regression from removal of Move without overlapping fixtures.
- `mise exec -- node --test test/exit_admission.test.ts`: exit 0, 2/2 passed.
- Reapplied the exact policy-bypass mutant documented in EXIT-1: exit 1, the new regression
  fails on available `true` instead of `false` / `invalid_state`; the subtraction test passes.
- Restored the exact source, then ran
  `mise exec -- node --test test/exit_admission.test.ts test/barriers.test.ts test/position.test.ts test/scene.test.ts test/invocation.test.ts test/world.test.ts`:
  exit 0, 42/42 passed. Production source and governing protocol are byte-identical to
  the original reviewed head. AST caller checks confirm unchanged keyed refusal callers
  and the same exit guard preceding passage, position and fare; aliases remain governed
  by the existing matching-action admission.
- Ponytail Review: **Lean already. Ship.** The minimal test reuses the fixture helper;
  no production machinery added. No open findings.
- Exact-source-head CI independently observed via `gh pr checks 160` and verified with
  `gh pr view 160 --json headRefOid`: changes, bundle, lint, Elixir, simulator and TypeScript
  all SUCCESS at `c5f0b8e2e1eba88a9bd60fb518dea606c4a67948`. Merge remains the PM's step,
  after every started job on the eventual review-record head finishes green.
- Source mutation removed before committing this addendum; record and index only.
