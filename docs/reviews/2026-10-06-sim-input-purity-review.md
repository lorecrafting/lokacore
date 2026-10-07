# Simulator input purity independent review

- Branch: `fix/sim-input-purity`.
- Exact source reviewed: `62b2bc7d5dd3ac44724353f82fa9dea7b64ac31c`.
- Reviewer: fresh independent Codex agent; authored none of the source change.
- Verdict: **APPROVE**. Findings: none.

## Governing requirements

The [immutable runtime World and pure kernel](../system/architecture.md#typescript-kernel),
[decision loop](../system/protocol.md#the-decision-loop), and
[simulator gate](../CHECKS.md) require projection/execution to preserve their input and
checks to catch realistic violations. [Test discipline](../../AGENTS.md#writing-tests-every-change-every-agent)
requires a distinct behavioral regression, literal expected answers and a demonstrated red control.
The [review workflow](../WORKFLOW.md#review-stance) requires proportionate independent review.

## Review and proof

The two-file diff snapshots the complete World before GameView and step, then checks it
before invariant/adoption comparisons can read mutated input. Current World data uses
JSON-compatible records, arrays and scalars. No concrete false positive found; production
paths are unaffected. The new test plants a one-time clock mutation that the old simulator
missed and asserts the literal `input_mutated` result.

Independent checks: the focused new test passed (1/1, exit 0); a step-side clock mutation
also produced `input_mutated` at step 0; removing the guard in an in-memory copy caused the
new assertion to fail with actual `undefined` (expected red, control runner exit 0).
No source files were edited for those checks. Developer-reported evidence: focused simulation
20/20 and TypeScript typecheck passed; 500-seed JSON snapshot benchmark 7.8 seconds versus
6.5 seconds baseline (approximately 20% overhead); canonical hashing took 23.4 seconds.
These local timings do not establish hosted CI performance.

JSON comparison detects changed serializable values; writes restored before comparison
and changes to non-enumerable/prototype data remain outside its coverage. No current World
behavior requires expanding this patch for those cases.

Ponytail Review: Lean already. Ship. No open findings or source recheck required.
Normal exact-head publication checks and hosted CI, including 10,000 fresh simulation
sequences within the existing 10-minute job timeout, remain PM-owned delivery gates.
