# Independent review: Astra Gate R5 baseline record

- PR #55, reviewed head `120175864d4b4478809a51f31b9f2aeebb38e003`.
- Verdict: **APPROVE WITH NOTES** for the documentation record. This is not a Gate R5 pass.

## Requirements derived before reading the diff

Document 14 §R5/Gate R5 calls for deterministic world rules, no containment cycles, bounded results, and golden vectors through the applicable kernels and hosts. Document 04 §5.1–5.5 requires declared delta preconditions, aggregate invariants, whole-proposal faults, and causal diagnostics that identify an exhausted budget. Document 00 §4.1 lists `knock` and map discovery/`where` at R5. A baseline review must distinguish demonstrated defects from gate work, scope questions, and later R6/R6P evidence.

## Checks and notes

- G1 matches `protocol/invariants.json`'s full `delta_preconditions_hold` statement and the narrower implementations in `kernel/ts/src/invariants.ts:102` and `lib/loka/core/invariants.ex:50`. A controlled pending choice at revision 3 with `choice.resolve` expecting revision 4 and an incorrectly successful empty result returned `true` from the TypeScript check. The record correctly does not claim `compose` accepted it.
- G2 follows from a fresh ancestry walk for each row in both kernels (`kernel/ts/src/invariants.ts:78`, `lib/loka/core/invariants.ex:39`); the separate capacity check must survive the linear rewrite. The recorded timings are illustrative, not a performance threshold.
- G3 is reproducible: 65 `job.schedule` ops produce `{"fault":{"kind":"fault","code":"budget_exceeded"}}` against the `created_jobs: 64` profile limit. The record correctly leaves the frozen result shape alone and asks for the violated budget in diagnostics.
- G4 is supported by the R5 simulation review's mutation result: removing the own-key guard left tests green. A controlled `constructor` view action passed the current guard. The baseline asks for a red control, without upgrading the earlier review's nit to a claim of current wrong behavior.
- `protocol/capability_registry.json` includes `open`, `close`, `lock`, and `unlock`, but no `knock` or `where`; document 00 §4.1 tags both and map discovery R5. The scope question is appropriately left for the gate record.

No findings in this documentation PR. I did not rerun the prior full suite or independently reproduce its timing measurements; those are explicitly historical observations in the baseline record. Docs-only review: no mutation test required.
