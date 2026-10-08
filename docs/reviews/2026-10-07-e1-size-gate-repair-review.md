# E1 witness extraction and size-gate repair review

**APPROVE** exact source `e63195003b00e75cfabeacde96acef71bc2b3747` against `3c5d61dbc0375c745f0b1642f0a7da59d408840d`, on `slice/chapter-one-e1-r9-certification`. No findings. The reviewer authored none of the source and used a separate checkout. **E1 remains pending.** This approves the extraction/size repair, not final certification or a full repository gate.

Requirements derive from AGENTS.md, the [E1 proof policy](../system/architecture.md#e1-exact-candidate-proof-policy), [size rules](../CHECKS.md), the prior [combined checkpoint](https://github.com/lorecrafting/lokacore/blob/4c1bb174b603e16f425b21a7752c576939bcf1db/docs/evidence/2026-10-07-e1-integrated-checkpoint/README.md) and evidence lessons: preserve witness behavior and test coverage, include the new source module in the check identity, and satisfy the existing size limit without adding an allowance or weakening its guard.

## Independent verification

- Direct comparison with the base proves that the complete `witnessedObligations` function and policy helper are unchanged byte-for-byte in `e1_obligations.ts`. The complete bodies and break headers of all four moved tests are unchanged byte-for-byte. The remaining eight tests are unchanged, except removal of their now-unused Maud import.
- `mise exec -- node --test kernel/ts/test/e1_cases.test.ts kernel/ts/test/e1_obligations.test.ts kernel/ts/test/e1_epilogue_talks.test.ts kernel/ts/test/e1_night_marsh.test.ts`: exit 0, fourteen cases. These include both old and new test files, retained ferry negative identity oracle, Maud effect/objective checks, recipe/dialogue/modal/dream tests, all five ending routes and legal Night replay.
- Installed the existing pinned kernel compiler dependencies with `mise exec -- npm ci --ignore-scripts` only in the review checkout; no dependency/lock/source file changed. `mise exec -- npm run typecheck` in the kernel package: exit 0.
- Actual changed-file `bin/check_ts_size.mjs` invocation: exit 0. `mise exec -- bin/ts_size_red_controls.sh --core-only`: exit 0. Independent controlled file containing the old test bytes fails the actual checker (exit 1: 647 lines, limit 500); the temporary file was removed. No `size: allow` was added.
- Resulting file lengths: host 325, remaining cases 435, extracted binder 228, extracted tests 233. All meet their current test-file limits. The full kernel test glob already includes the new `.test.ts`; the private E1 check also uses that glob, so the moved cases remain in those consumers.
- Runtime identity check confirms the host re-export is the exact function exported by the extracted module. Current `source()` reports source `e6319500`, check hash `e9cafb1a1ba7de78e055187bd8777df09f688ae087de03021270c8a9bb5041f1`, and unchanged policy hash. The explicit digest list contains `e1_obligations.ts` alongside the host and other reviewed recipes.
- `mise exec -- elixir bin/check_docs.exs`: 843 docs, zero broken links and zero unreachable. `git diff --check`: exit 0. Review checkout is clean apart from the requested record/index, and the recorder checkout was untouched.

## Correctness and simplicity

The host imports and re-exports the extracted function, preserving the existing current callers without a forwarding wrapper. The extracted module depends on existing source types, game view and fact reader; it has no dependency on the host. There is no new cycle, second implementation, mutable state or changed witness branch. Tests retain the same literal expected paths, controlled world/SQLite inputs and red-control assertions; no new coverage-only test was introduced.

Ponytail Review: Lean already. Ship the extraction. The two cohesive files satisfy the size rule using existing imports and module exports. No new dependency, configuration, abstraction or size exception was introduced. The repeated test fixture declarations are the minimum required for an independent test file; a new shared fixture layer would add machinery for this bounded split.

## Limits

Source/check identity necessarily changes when the binder moves. Earlier eighteen-case receipts remain attributed to their original source; unchanged semantics do not relabel them as new-source certification receipts. The 241-path inventory belongs to the prior provisional checkpoint until recaptured on a later exact head. Full repository checks, final candidate/check/source pins, final independent risk review, 10,000-sequence certification proof and E2/E3 human receipts remain separate. No publication was performed and no E1 pass is claimed.
