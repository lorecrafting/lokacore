# Paired job completion invariant — independent second opinion

- PR: #269, `fix/job-complete-owned-run`.
- Exact source: `d12bf1e18a7488d2cbd7f0b812e687e0cc88d7d5`.
- Current-main comparison: `9669f6e44707728054ce4af3f3cbf568841264a7`.
- Fresh Codex Sol opinion; authored none of the source. Supplements the
  [primary review](2026-10-06-job-complete-owned-run-review.md).
- Verdict: **APPROVE**. No findings or open items.

## Contract and correctness

The [schedule contract](../system/mechanics.md#schedule1-behavior1-calendar1-mechanicsschedulerulets-kernelts-srcmechanicsschedulebehaviorts),
[registered invariant](../../protocol/invariants.json),
[C5 exact pairing](../system/protocol.md#c5-bleed-and-bandage-composition) and
[D9 deadline pairing](../system/protocol.md#d9-reaction-cue-and-study-admission-composition)
require each due job's own internal delivery, a non-root group, canonical delivery
order, narrow lawful shared groups, and ordinary refusal for unrelated conflicts.

`kernel/ts/src/runtime/invariants.ts:102` removes the invalid one-completion-per-group
inference while retaining the root-group and target-time guards. The unchanged
`kernel/ts/src/runtime/proposal.ts:249` builds each pending due job's own command;
line 276 shares only checked population/bleed partners. `proposal_bleed.ts:9` checks
current job, generation, body and equal-time bindings. No producer, foundation,
release pin, frozen fixture or save code changed relative to current main.

The observer does not establish every ownership fact from an arbitrary forged delta.
Composition still checks target/precondition conflicts, and
`mobile/authority/local-story/receipt-history.ts:37` compares the complete replayed
decision, including writer groups; line 41 also compares final revision and state.
The lawful-pair fix therefore does not relax saved-receipt integrity.

## Independent checks

All commands used the pinned toolchain through `mise exec --`:

- Node focused suite: `job_completion_invariant`, `bleed_composition`,
  `population_composition`, `c5_bleed`, `c5_bleed_death`, `c5_bleed_early_expiry`:
  **22/22**, exit 0. Literal fixtures include foreign-body and cross-writer slot refusal.
- Node `d9_suppression.test.ts`: **6/6**, exit 0, including exact suppression/population deadline settlement.
- Node `mobile/authority/local-story/deer_bleed_recovery.test.ts`: **4/4**, exit 0.
  Real disposable SQLite reopens the interleaved round/population/bleed receipt;
  forged bleed, population and mixed sight-cancellation groups return `save_corrupt`
  while preserving file bytes. Compilation used the installed dependency directory
  and an isolated build; no owner save was accessed.
- Disposable copies of the invariant module and new tests, with only imports relocated:
  restoring uniqueness, removing the positive-group guard, and removing the due-time
  guard each exit 1 with exactly their corresponding test failing. Unmodified copy:
  **3/3**, exit 0. Tracked source was never edited.

AST inspection found no earlier direct unit call for this invariant. The existing
root-group simulator control is a broader integration control; each new test
catches a distinct observer regression with literal expected results.

Ponytail Review: **Lean already. Ship.** Existing fixture reuse and deletion of the
quadratic uniqueness check are sufficient. No additional machinery is needed.

`git diff --check` and `mise exec -- elixir bin/check_docs.exs` pass (767 docs,
0 broken links, 0 unreachable). No full gate, browser/device or hosted CI run is
claimed by this opinion; publication remains the PM's exact-head gate.
