# E1 recipe outcome effect binding independent review

**APPROVE** bounded source `fed19087a32009f88e7e7bfcc8e6f3162b4876ff` and evidence `b2d45c1e7982bca9b1d7f089c6a1e941f5731cbb`, branch `proof/e1-recipe-outcomes`. No findings. The reviewer authored none of this source or evidence and worked only in a separate checkout. **E1 remains pending**; this is not a final certificate or full authored-path review.

Requirements derive from AGENTS.md, the [E1 exact-candidate policy](../system/architecture.md#e1-exact-candidate-proof-policy), [brief](../briefs/chapter-one/chapter-one-e1-r9-certification-brief-2026-10-05.md), frozen v042 recipe declarations and storage/evidence lessons. Selected outcome credit requires all exact effect witnesses; sibling outcomes, unsupported operations and missing evidence remain pending.

## Independent verification

- `mise exec -- node --test kernel/ts/test/e1_cases.test.ts`: exit 0, ten cases. Restored source passes the same ten-case check.
- Independent red control changed the emitted-event key matcher so the epilogue effect could not match. The other nine current cases pass with the new case temporarily omitted (exit 0); restoring the new case makes the suite fail only that case (exit 1). All review mutations were restored byte-for-byte. This specifically catches the lost recipe event/outcome witness, beyond the existing study/fact tests.
- All six retained evidence hashes verify; selected files also match their entries in the complete-output capture manifest. Independently replayed retained `rescued-prior` (90 steps) and `night-marsh` (15 steps) through `replayCase` with their recorded candidate/source/check/policy identities. Each replay object exactly equals its report receipt.
- Controlled negative matcher probes over real replayed before/after states: remove events, corrupt a bell fact event's old value, leave state unchanged, or corrupt the epilogue event's cartridge version. The missing/mismatched step and enclosing outcome remain uncredited; an independently valid second bell step may still receive its own path. Rejected decisions return no witnesses. Altering an epilogue event inside retained decision bytes makes semantic replay refuse the receipt.
- The clean evidence head recomputes check digest `f7493c9f9b6a7ac57c402f2267e1d1e3dbc714bf6d3aae4be3dc7c90d6a39667`, matching recorded source `fed19087`; policy digest also matches. Only docs/evidence follow the source. Report receipt witnesses deduplicate to the exact reported union. Its 18 cases are author evidence, not an independently rerun eighteen-case recorder.
- `mise exec -- elixir bin/check_docs.exs`: 833 docs, zero broken links and zero unreachable. `git diff --check`: exit 0. Privacy scan found no private home/scratch/worktree paths or device/signing identifiers in retained files. The complete-output manifest records capture of absent databases/logs; it does not make them independently available.

## Correctness and scope

The binder first requires an accepted `perform` for an admitted recipe. It derives only the selected success/failure branch from the decision and returns definition/policy evidence alone when that branch is unknown or absent. Fact assignments require a genuine before/after value transition plus the exact declared fact reference and matching old/new event values. Custom events require the declared event key, kind and cartridge identity. The recipe sequence path is tied to its authored index; the enclosing outcome is credited only if every step matched. Unsupported step operations remain unmatched.

The matcher consumes validated committed decisions: the shared host independently redecides and compares the complete decision/state bytes, and replay repeats that validation before admitting any claimed witness. Thus event actor/scope/cause and other receipt fields are also bound by the existing whole-decision check; this matcher does not create a new event-validation boundary. Canonical admitted v042 references preserve the field ordering used by the fact-reference comparison.

The frozen candidate uses the two supported sequence operations, with no repeated assignment chain requiring intermediate-value interpretation. Empty success is not credited. The declared empty Wisp failure sequence requires a failed-check event to credit its outcome; the retained run does not execute that failure and correctly keeps `/recipes/ashmere_missing_child@0.0.42:recipe/seek_wisp/outcomes/failure` pending. No legal failed-Wisp path is claimed or invented by this review. More general sequences/check variants would require their own proof.

The new architecture clause precedes the code and matches this bounded rule. The updated existing study test now includes its independently selected success-outcome path; the new real SQLite case checks both bell assignments and the epilogue emitted event. Retained report remains `pending` with null verdict and 255 authored paths open; the additional selected-outcome witnesses do not imply unrelated paths passed.

Ponytail Review: Lean already. Ship the bounded binder. It reuses accepted receipts, state reads, existing replay and pending-gap calculation. No dependency, second interpreter or new runtime abstraction was introduced. Correctness review found no in-scope failure.

## Limits

Independent checks cover the selected fact/event success paths and fail-closed controls above. The unexecuted empty failure outcome, remaining authored paths, final candidate/check/source pins, independent gate review and 10,000-sequence proof remain pending. Author typecheck success is retained evidence; no independent typecheck was claimed here. Recorder files were untouched and no publication was performed.
