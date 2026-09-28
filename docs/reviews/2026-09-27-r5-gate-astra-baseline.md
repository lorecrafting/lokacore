# Astra baseline review: Gate R5

- Reviewed `main` at `63f22db` on 2026-09-27. No Gate R5 PR existed yet.
- Scope: readiness of the current R5 implementation against document 14 §R5/Gate R5, document 04 §5.1–5.5, document 00 §4.1, and the Gate R5 carries in `docs/ROADMAP.md`. This is an advisory baseline for the later gate review, not a gate approval.
- Verdict: **NOT READY TO PASS**. The four known carries below remain open. No code was changed in this review.

## Evidence

`mise exec -- bin/check_all.sh` exited 0: 205 Elixir tests and 205 TypeScript tests passed. The simulator ran its two regression seeds and 10,000 fresh sequences (324,643 steps); contracts, lint/red controls, formatting, and docs checks passed. A green suite does not close the findings below.

## Findings

### G1 — Blocker: the independent delta precondition check accepts an invalid successful observation

`kernel/ts/src/invariants.ts:102` and `lib/loka/core/invariants.ex:50` check only each target's read-to-write value chain. They omit choice revision and offered-choice membership, legal lifecycle transitions, capacity/cycle, resource bounds, and time preconditions declared by document 04 §5.1–5.3. A controlled TypeScript observation with a pending choice opened at revision 3, `choice.resolve` expecting revision 4, and an incorrectly successful `result: {changes: []}` returned `true` from `check("delta_preconditions_hold", observation)`. This does not show that `compose` accepts the choice; it shows that the purported independent gate check would miss that regression. Add independently expected negative observations in both kernels without deriving expected results from `compose`.

### G2 — Gate carry: containment validation grows quadratically

`kernel/ts/src/invariants.ts:78` and `lib/loka/core/invariants.ex:39` walk each entity's ancestry afresh. A valid TypeScript chain took 68 ms at 2,000 rows and 264 ms at 4,000 rows in one local probe. The roadmap assigns a linear-time `containment_acyclic` check to Gate R5. Keep full-state validation, including capacity; share visited ancestry work rather than assuming the base is already valid.

### G3 — Gate carry: a budget fault does not name the exhausted limit

`kernel/ts/src/compose.ts:96` and `lib/loka/core/compose.ex:62` return only `budget_exceeded`. A 65-job schedule proposal exceeded the `created_jobs: 64` limit and returned `{"fault":{"kind":"fault","code":"budget_exceeded"}}`, with no budget name. Document 04 §5.4–5.5 requires source/causal diagnostics identifying the violated budget. Preserve the frozen DecisionResult shape; provide the detail through the appropriate diagnostic channel.

### G4 — Gate carry: the GameView own-key guard has no failing test

The `Object.hasOwn(SHOWN, type)` guard exists at `kernel/ts/src/invariants.ts:152`. The R5 simulation review records that removing it leaves all tests green (`docs/reviews/2026-09-26-r5-sim-review.md`, N3). A GameView action keyed `constructor` with an unknown command of that type is the concrete regression case. Add a red control that fails when this guard is removed.

## Scope question for the gate record

Document 00 §4.1 tags `knock` and map discovery/`where` as R5, but the current R5 subset and capability registry omit them, and the roadmap's early R7/R8 carry list does not name them. The later gate review should record whether they are deferred and where they land. This is a scope-accounting question, not authorization to add them to Gate R5.

Node golden fixtures, transcript replay, and the simulator passed. Hermes device evidence and offline save/recovery belong to R6P and R6, respectively; this review makes no claim about them.
