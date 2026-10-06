# Foreign-world simulator envelope independent review

Verdict: **APPROVE**. No findings or open items.

Reviewed source: `381e1f61adb2776e169e5930d97f7c7acbe73a9c`.
Reviewed evidence: `9731df92133f1e6fd6106e48731ccb182f40f4a1`.
Published baseline: `815f66f9039ca22f80d44112a1ff966eadb8381e`.
Branch: `fix/sim-foreign-world-envelope`; PR not yet opened.
Reviewer: fresh independent Codex agent; authored none of the reviewed work.

## Requirements

The governing [Step contract](../system/protocol.md#the-decision-loop) refuses
another world with `not_found` before action admission. The oracle must use the
observed pre-command context, accept a foreign envelope only for a
`rejected/not_found` result, and retain detection of a current-world offered
service wrongly refused `not_found`. Accepted foreign commands, other rejection
codes and faults must fail. Production admission, frozen conformance fixtures,
release pins and saves must remain unchanged.

## Source and correctness

`kernel/ts/test/sim.ts:247` supplies `before.context` to the observation;
`kernel/ts/src/view/invariants_view.ts:41` classifies a differing envelope before
action comparison. The result code exists only for rejected decisions, so a
fault carrying `not_found` cannot pass. No service, action or world ID is
special-cased. With a matching context the previous predicate runs unchanged;
callers omitting context retain their previous behavior through its default.
The only runtime-source change is this diagnostic invariant, with no production
admission or persistence change. The protocol clarification agrees with existing
`runtime/world.ts` identity ordering and changes no schema or frozen fixture.

## Independent verification

- Four selected simulator tests pass, including the new literal behavior case,
  the existing constructor/door alias cases and the door red control.
- Three actual oracle mutations independently fail the focused new test:
  restore the old oracle; accept every `not_found`; accept every foreign result.
  Each mutation is removed; the restored test passes and the source diff is clean.
- Seventy-five controlled observations across three differing contexts and five
  payload types accept only rejected `not_found`; accepted, wrong-code and fault
  decisions fail, including a fault whose code is `not_found`.
- The published v030 capture independently passes seeds 1–200: 6,761 commands,
  no failures, unchanged fixture hash
  `dbff57ba20305dffa4a0679ab58d480574fbc3fd93fddeb3bf08d48d78e057b9`.
  Substituting the baseline oracle independently reproduces seed 71, zero-based
  command 11, `lantern_meal`, `gameview_agrees_with_admission/not_found`.
- The real Maud service reproduction passes: foreign command rejected
  `not_found`, identical world object, oracle agrees; the same current-world
  offered service wrongly refused fails the oracle, while lawful Step accepts.
- TypeScript source/test/play typechecks and changed TypeScript/evidence-script
  size checks pass independently.
- All ten retained [evidence](../evidence/2026-10-06-sim-foreign-world-envelope/README.md)
  SHA256SUMS entries independently verify; the directory has `-whitespace`.
  Inspected baseline/fixed logs and all three retained red-control logs agree
  with the independent controls. The retained full gate log covers Elixir,
  contracts, docs, typechecks, kernel tests, local simulator workload, size,
  formatting and planted controls; the developer records exit 0. This review
  does not claim a second full-gate run or exact-head hosted CI.

Ponytail Review: **Lean already. Ship.** No dependency, helper or configuration
added; no unnecessary abstraction or broad refusal exception. The focused
behavior test uses hand-written expected results and catches distinct envelope
classification mistakes. No mobile/native/browser session or owner save was used.

The developer/PM still owns publication and the workflow's exact-head CI gate.
