# Simulator world inputs independent review

Source: `fix/simulator-world-inputs` at `c299195cf615b16481f33a5bf72db9ab564ef6c9`, against published `747c252dc25b37046d482c4a51493d16d70e0378`. Fresh independent Codex reviewer; authored none of the implementation. Local source review; hosted checks and publication remain PM gates.

**Verdict: APPROVE. No in-scope findings.**

## Required behavior

[Architecture: two kernels](../system/architecture.md#two-kernels-one-semantic-contract) requires complete runtime composition inputs while preserving an independent adoption comparison. [B5 composition](../system/protocol.md#b5-harvest-and-exchange-composition) requires an exact terminal quest retirement to remove its row. Registered invariants, mismatch detection and frozen conformance fixtures must remain intact.

## Findings and proof

- `kernel/ts/test/sim.ts:27`, `:218`: reuse of `runtime/apply.ts:40` supplies the complete immutable projection, including known entities, corpse templates and population specs. It shares input construction, without calling runtime `apply`/`adopt` to generate expected outcomes. The simulator still composes the decision independently and compares its own adopted rows at `sim.ts:266`.
- `kernel/ts/test/sim.ts:275`: only a null quest change deletes a row, matching runtime `apply.ts:28` and the B5 contract. Fresh activation remains a separate row; ordinary changes and choice revision stamps keep their existing handling.
- `kernel/ts/test/sim_mechanics.test.ts:70`, `:119`: controlled v042 fatal receipt and explicit Wick repeat pass. Their adverse outcomes also detect a missing corpse creation in the receipt and a retained retired quest row, both as `adopt_mismatch`. The tests use literal clocks, expected failure IDs and row presence; no fixture/hash/pin changes or invariant exclusions.

Independent checks (each exit inspected):

| Check | Result |
|---|---|
| `mise exec -- node --test --test-reporter=spec test/sim_mechanics.test.ts` | 2/2 pass |
| Existing `test/sim.test.ts`, fixed source | 20/20 pass |
| Restore old incomplete simulator `base` projection, new cases | Fatal case fails `adopt_mismatch`; repeat passes |
| Same missing-input mutant, existing simulator suite | 20/20 pass: existing suite misses this break |
| Replace quest deletion with assignment of null, new cases | Repeat case fails `adopt_mismatch`; fatal passes |
| Same null-row mutant, existing simulator suite | 20/20 pass: existing suite misses this break |
| Restore exact source after mutations, new cases | 2/2 pass; disposable mutation worktree removed |

Only focused simulator suites ran; no full gate or browser claim. Ponytail Review: Lean already. Ship. Reusing the existing input projector removes duplication; the two new cases catch distinct demonstrated breaks.

## Separate retained carry

**SIM-CARRY-01 — should-fix, outside this adapter diff:** `kernel/ts/src/runtime/invariants_encounter.ts:145`–`:171`. A lawful v042 elapsed command from clock 67950 to 68100 is accepted and composes successfully, but `encountersHold` reconstructs its scheduled bleed job without `bleed_body_id` and `bleed_generation`. Its final-row comparison therefore fails and the simulator reports `delta_preconditions_hold`. Independently replaying the retained before/after/command/decision confirms the failure; removing those two fields from the composed job makes that encounter replay pass, isolating the omission. Preserve the invariant and repair the replay in the separately assigned encounter-invariant task. This review approves the world-input/retirement adapter only and does not certify the full current-chapter corpus. No Beads ID assigned at review time.
