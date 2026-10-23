# Review: refusal cause not_standing (loka-x6t.17, PR #447, kernel_api 1.111)

- Branch `toolbox/batch-polish-engine-1` (draft batch polish-engine-1, row 1), exact commit `8a62a1c89a2dc0cee6f7808be388aed5a5b27932`.
- Governing: [protocol.md](../system/protocol.md) (GameError, UnavailableReason), [mechanics.md](../system/mechanics.md) movement@1 and position@1, [book-ui.md](../system/book-ui.md) refused line, [Review stance](../WORKFLOW.md#review-stance), [Writing tests](../../AGENTS.md#writing-tests-every-change-every-agent); owner Q13 option A (loka-x6t.17 notes).
- Reviewer: anthropic/claude-opus-5-5, independent, authored none of the work.
- Verdict: **APPROVE WITH NOTES** at `9649ced9d` (fix round below); was **CHANGES REQUIRED** at `8a62a1c89` (hosted CI red: B1, B2).

## Must be true (written before reading the diff)

1. One closed RefusalCause enum, shared by GameError and UnavailableReason; the ErrorCode list is unchanged.
2. The generated contracts and `kernel_api` 1.111 are updated; both kernels' validators accept and reject the same `cause`.
3. Invalid fixtures fail when the enum is removed.
4. The rejected step and the unavailable exit carry the same cause.
5. The Book prefers the cause word over the code word.
6. Old saves, receipts and fixtures without `cause` still validate; no new save field.

## Checks run

- **1-3.** Held. `elixir bin/contracts.exs --check` exits 0. Elixir contracts, system_graph, registries and portable_abi pass (135). `invalid.json` has two new `/cause not_in_enum` cases.
- **4.** Held for `move` (land and water edge). The exit reason comes from the same `movementPlan` (`view.ts:292`).
- **5.** Held. The full mobile `npm test` exits 0.
- **6.** Additive (S1). Old receipt text replays as stored (`invocation.ts:61`, never decided again); `cause` is optional.
- The kernel focused tests (position, water, sleep and others) and the typecheck exit 0. My local subsets did not include `loader_floors_test.exs` or `transcripts.test.ts`; hosted CI found B1 and B2.
- Hosted CI at 8a62a1c89: `ci` failed (elixir, kernel); `book-e2e` and `graph-diff` passed.
- **Mutants** (throwaway worktree, all reverted):
  - `sequence.ts:166` returns a bare `'invalid_state'`: red.
  - `view.ts:292` keeps the code only: red.
  - `words.ts:106` checks REASON before CAUSE: red (model, presenter and reasons tests).
- **PR claims rerun:**
  - The flee mutant (`flee.ts:30` changed to `typeof … !== 'string'`) fails at `sleep.test.ts:101` with actual `['east']`. Holds.
  - "No conformance file changed" is not enough: the frozen transcript must change (B2).
- `/code-review medium` is reported. It was not rerun after cbd394fef and 8a62a1c89. I read both in full: a refactor with no new issue.
- The size allow of 324 at `decision.ts` is justified (the GameError import plus the two-line `rejected`).

## Findings

- **B1 blocker.** `test/loka/loader_floors_test.exs:148` fails on hosted run 39894030818, with left `["1.111"]`. `protocol/error.schema.json:94` says "kernel_api at least 1.111", and no loader-floor fixture case has that floor. Fix: add the case, or drop the version phrase from the description.
- **B2 blocker.** `kernel/ts/test/transcripts.test.ts:52` fails: `cartridges/position_sampler/transcripts/position.jsonl` replays the sitting move with `"error":{"cause":"not_standing","code":"invalid_state"}`, and the later `stand` line also differs. A per-field replay diff shows exactly one change: line 5 `/data/decision/error/cause` goes from absent to `"not_standing"`. The `stand` difference in the CI output is a display artefact. Fix: regenerate the file (an expected behavior change) and name it in the PR body.
- **S1 should-fix (PR wording).** "Save impact: none" is not exact. A rejected move is committed with its full response (`invocation.ts:157`), so new receipts can hold `cause`. Reopen checks accepted rows only (`receipt-history.ts:28`), so a reopen is not affected. But GameError has `additionalProperties: false`, so a 1.110 build that replays the same command id gets `conflict` (`invocation.ts:61`). Say instead: additive; old saves are byte-identical; a downgrade is not supported.
- **N1 nit.** An engaged sitter gets a bare `invalid_state` at a land exit (`sequence.ts:165`, the engaged check comes before standing), but `not_standing` at a water edge (`water/shared.ts:33-34`). The same fight gives two different Book words.

## Ruled

- **Follow-up, not fix-now:**
  - `view.ts:290`: refusal() runs first. A sleeper in a fight gets a bare code, but the step goes through the same refusal chain, so the view and the step agree. Fixing it changes admission precedence, which is outside scope.
  - `invariants_view.ts:69` and `:196` compare the code only. The direct tests catch a dropped cause (mutant B is red).
  - `expedition/shared.ts:64`, `transport/shared.ts:57` and `crow/behavior.ts:29`: the brief scopes this slice to `move` only.
- **`cursed`** with no producer: acceptable on a draft batch head, because row 2 (loka-x6t.38) adds the producer. It must have a producer before the batch is ready, or be removed.

## Fix round: head `9649ced9d81e70c468535400e596d790f5d0ee02` (fixes 8034514bd, 9649ced9d)

- **B1 fixed.** `error.schema.json` RefusalCause no longer names a version. The contracts are regenerated: `contracts.exs --check` exits 0 and `loader_floors_test.exs` passes.
- **B2 fixed.** The `position.jsonl` diff is one line, the sitting move gaining `cause`. `transcripts.test.ts` passes, and the PR body names the file.
- **S1 fixed.** The PR body now says: additive; old saves are byte-identical; a downgrade is not supported.
- **N1 fixed.** `water/shared.ts:33-35` checks engaged or following before posture, the same order as `sequence.ts:165`. Mutants on the water test, both red and reverted:
  - drop the following clause;
  - posture first.
- The water test's standing-and-following case became a sitter that is following. Deleting the following clause still fails the test (the exact `{code}` assertion), so no coverage was lost.
- The `rule.ts` and `words.ts` changes in 9649ced9d are comments only.
- PM ruling accepted: a sleeper is told "You are not standing." (the owner's wording).
- Verdict: **APPROVE WITH NOTES** on 9649ced9d (notes: the follow-ups ruled above). Hosted CI is in the PR comment.
