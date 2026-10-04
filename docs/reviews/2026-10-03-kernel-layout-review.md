# Review: TypeScript kernel layout — 2026-10-03

PR [#146](https://github.com/lorecrafting/lokacore/pull/146), commit reviewed `48405cd9fb5f743470125aaa65b23b374536dc51`, base `665b3ff6c0fbed1109a8aa13576bad710a623d11` (`c1-polish-dialogue-contents`).

**Verdict: APPROVE WITH NOTES**

Independent Codex primary reviewer; authored none of this change. Bounded owner-approved primary substitution supplied by PM while Claude is unavailable. Specific underlying model identity is unverified. The separately requested Astra review is outside this record.

## Must be true (derived before reading the diff)

1. Owner-authorized grouping into foundation, runtime, content, mechanics, commands and view is mechanical. Keep the public index and generated contracts at their existing root paths; add no mechanics or loading framework.
2. Preserve production kernel and authority bodies, pure Rule ABI, capability ownership, admission, invariants, structural sharing, host save boundaries, public exports, RNG/ID behavior, frozen contract/cartridge fixtures and simulator answers. Only import/export specifiers and genuine path-facing references/discovery change.
3. Retarget existing deterministic purity, rule-location/import/registration and admission guards, proving actual-path plants. Use the existing AST framework for foundation imports. Existing runtime/proposal/mechanics/world couplings remain authorized.
4. The sole checker behavior exception closes the existing-file carry: preflight occupied paths, exclusive creation outside cleanup ownership, preserved local bytes on refusal, and unchanged normal owned-plant checking/cleanup.

Governing sections: [architecture](../system/architecture.md#typescript-kernel), [owner decision](../decisions/owner-decision-kernel-layout-2026-10-03.md), [protocol](../system/protocol.md), [workflow](../WORKFLOW.md).

## Checks

- Personally reviewed the 159-file, 303-hunk inventory using individual nonmechanical hunks and independent structural/path proofs for mechanical edits. Independently derived the rename map from Git: 54 source files before/after, 52 moves.
- Independent TypeScript AST comparison covers all source modules and changed host/authority/test modules (122 files); only actual import/export module-specifier nodes are normalized. Production bodies and public export declarations match. All 900 import/export edges resolve to their independently mapped original targets. The sole test-body exception is the minimally retargeted stdlib `globSync('*/rule.ts')` discovery in `world.test.ts`.
- Protocol and cartridge Git trees are identical, including all 19 cartridge hash fixtures. Generated contracts, RNG and IdSource retain exact bytes. Feature JSON changes only mapped paths. All eight Elixir changes are exact path substitutions in comments/moduledocs.
- Personally ran `ast-grep test --skip-snapshot-tests`, actual `bin/lint_red_controls.sh` and `bin/kernel_red_controls.sh` plants, contracts/features generation checks, the isolated ExUnit occupied-file test, and 36 focused kernel ABI/world/known-answer tests: all pass.
- Disposable-worktree mutations: restore prior unsafe checker → occupied-file test fails (exit 2, existing bytes deleted / `:enoent`); remove movement registration → world/known-answer tests fail (exit 1); stale foundation rule glob → actual lint plant fails (exit 1, foundation violation unreported). Each restoration passes. Owned plant files and tracked mutations are restored; disposable checkout removed.
- Author reports normal full pre-push `bin/check_all.sh` PASS. PM reports all six exact-head CI jobs completed SUCCESS. These full-lane executions are reported evidence, not personal runs; avoided duplicating the concurrent heavy lane.
- Ponytail Review: Lean already. No additional dependency, wrapper, barrel, checker framework or speculative layering. No correctness blocker found.
- Redacted personal proofs/logs retained in private shared scratch under `kernel-layout-primary-controls`, with SHA256 manifest and verification.

## Findings

- **nit N-1** `docs/world-parameters.md:26`: W4's dialogue and quest verb-timing locators now point at `mechanics/dialogue/shared.ts` and `mechanics/quest/lifecycle.ts`. Scenario: a time-model implementer follows these references to find the `talk`, `choose`, `close_choice` and `accept_quest` decisions, but reaches query/lifecycle helpers instead of their `decide` bodies. Retarget those two entries to `mechanics/dialogue/rule.ts` and `mechanics/quest/rule.ts`. Runtime behavior is unaffected.

Open items: N-1 documentation disposition; separate Astra review remains with PM.


## Fix round 1: `75ee13133fd0a1bae9cccfe5918bdb4c84d8a052`

**Verdict: APPROVE**

- N-1 closed: `docs/world-parameters.md:26` now points to `mechanics/dialogue/rule.ts:63` and `mechanics/quest/rule.ts:10`. Personally confirmed the exact-head source paths and AST `decide` declarations at lines 63 and 10; the retained dialogue line references fall within the same rule's operation bodies. These references agree with the rule/helper distinction documented in `docs/system/mechanics.md`.
- Scoped diff is one Markdown row only. Production code, frozen fixtures and executable tests are unchanged; no additional tests or mutations are warranted for this documentation fix. Ponytail Review: Lean already.
- PM reports exact-fix-head CI: changes, lint and bundle completed SUCCESS; Elixir, simulator and TypeScript jobs intentionally SKIPPED under the docs-only policy. This is three successful jobs plus three expected skips, not six successful jobs. Original `48405cd` had all six successful jobs. Author reports normal `--no-ts` pre-push PASS, without bypass.
- Open findings: none. Separately requested scoped Sol review remains with PM.

## Separate GPT-6 Astra source review

```text
APPROVE — source verdict only; owner Gate UI pending.

PR: #146
Head: 48405cd9fb5f743470125aaa65b23b374536dc51
Base: 665b3ff6c0fbed1109a8aa13576bad710a623d11
Stacked base: c1-polish-dialogue-contents

Findings: none.

Personal evidence:
- Derived acceptance from AGENTS.md, WORKFLOW.md, architecture.md and the kernel-layout owner decision before reviewing the diff.
- Confirmed 54 kernel modules, 52 moves, stable public exports and generated-contract location.
- Independently compared all 159 TS/TSX files using normalized ASTs and resolved relative imports. Kernel and five authority bodies are unchanged; only the authorized registry-discovery test changes behavior.
- Existing proposal/quest/reaction/schedule and world-composition dependencies remain intact.
- All 14 AST lint suites and the clean scan passed. Seven in-memory guard mutations produced expected RED results; original bodies were GREEN. Registry-discovery test passed.
- Feature-map files equal their base versions after path substitution. Frozen contracts, protocol fixtures, cartridges and historical records are unchanged.
- Reviewed checker preflight, exclusive creation and cleanup ownership; checker remains 300 lines without new allowances. Final worktree clean.

Reported evidence, not personally rerun:
- PM confirmed all six exact-head CI jobs SUCCESS.
- Author reported normal full pre-push PASS.
- Inspected supplied safety logs: prior overwrite/delete behavior fails literal-byte preservation with :enoent; restored checker passes. Supplied logs also show normal owned plants passing.

Limits:
Read-only review; no builds, full checks, filesystem plants, native/UI or save actions. In-memory guard tests do not independently prove filesystem glob coverage. Primary reviewer’s results were not accessed; authored none of this work.

Ponytail/Ponytail Review: Lean already. No unnecessary framework, wrappers, barrels or abstractions introduced.
```
## Separate GPT-6.1 Sol scoped fix review

```text
APPROVE — PR146 FIX ROUND1

Head: 75ee13133fd0a1bae9cccfe5918bdb4c84d8a052
Base: 48405cd9fb5f743470125aaa65b23b374536dc51

Acceptance derived before diff: W4 must locate the actual verb rules, agree with direct documentation references, and remain a one-row Markdown correction.

N1 (nit) CLOSED — docs/world-parameters.md:26.
Dialogue now targets kernel/ts/src/mechanics/dialogue/rule.ts:63 (decide), :84 (talk’s choice.open body), and :117 (choose’s choice.resolve body). Quest now targets kernel/ts/src/mechanics/quest/rule.ts:10 (decide for accept_quest). Manual declaration/body inspection confirms these contexts. The replacement paths agree with docs/system/mechanics.md:182 and :207. The misleading helper locators are corrected.

New findings: none within scope.

Personally verified: exact checked-out head, one-row-only commit delta, actual rule contexts, direct documentation references, and supplied exact-head CI snapshot.
Snapshot: changes/lint/bundle SUCCESS; elixir/typescript/sim SKIPPED, consistent with documented docs-only policy.
Reported: PM verified the prior commit’s all-six SUCCESS; author reports normal hooks, including --no-ts, PASS. I did not rerun them.

Limitations: narrow read-only fix review; no reviewer results read, writes, mutations, tests, builds, GUI, lifecycle actions, or subagents. Native-build lane remains outside this review.

Ponytail/Ponytail Review: lean already; the locator correction adds no machinery or unnecessary complexity.
```
## PM publication

The primary and separate review answers above retain their exact reviewed heads and personal/reported evidence limits. N-1 is closed; no source findings remain. The [primary checksum manifest](../evidence/2026-10-03-kernel-layout-primary/SHA256SUMS) records the actual redacted retained proofs, independently verified during publication. Original source CI was six successful jobs; the one-row documentation fix correctly had three successful jobs and three expected documentation-only skips. Runtime behavior remains unchanged, and the following composed UI preview is a separate native checkpoint. This record does not pass owner Gate C1.

Publication privacy note: the retained AST helper source contained its local TypeScript loader path. The public capture redacts that path; the original executed helper remains private. [Redaction provenance](../evidence/2026-10-03-kernel-layout-primary/publication-redaction.json) records both actual hashes. Other execution claims retain their original evidence limits; this redaction is not a claim that the public helper was rerun.
