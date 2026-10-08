# E1 dialogue choice fact effects independent review

**APPROVE** bounded source `d344aaaa1cb9d6f0c83c3b5e95432aac2ac59f8e` and evidence `ca651a4d1c6e31ffa32edaf9c4538fed8b90fcf2`, branch `proof/e1-dialogue-effects`. No findings. The reviewer authored none of the source or evidence and used a separate checkout. **E1 remains pending.** This approves the selected dialogue fact-effect binder, not full authored coverage or certification.

Requirements derive from AGENTS.md, the [E1 exact-candidate policy](../system/architecture.md#e1-exact-candidate-proof-policy), [brief](../briefs/chapter-one/chapter-one-e1-r9-certification-brief-2026-10-05.md), frozen v042 selected-choice sequences and storage/evidence lessons. Effects must belong to the exact selected pending dialogue choice, change the fact to its authored result, and have matching committed transition evidence; unrelated operations/choices remain pending.

## Independent verification

- `mise exec -- node --test kernel/ts/test/e1_cases.test.ts`: exit 0, eleven cases; the same restored suite passes after the mutation.
- Independent red control removed adjustment matching in the review checkout. With the new test temporarily omitted, all other ten current cases pass (exit 0). Restoring the new test fails only that case (exit 1): the Maud trust sequence-0 witness is missing, while the cellar assignment sequence-1 witness remains. All source/test mutations were restored byte-for-byte. This proves the new adjustment-effect regression is distinct from the existing recipe/fact/objective checks.
- All six retained hashes verify, and selected files also match their entries in the complete-output manifest. Independently replayed Maud (55 steps) and rescued-prior (90 steps) using recorded candidate/source/check/policy identity. Both replay objects exactly equal their report receipts. Maud's two literal expected paths are derived from its original selected `done` definition: trust +5 and cellar-cleared true.
- Controlled probes on replayed Maud before/after states: unselected choice ID, unchanged state, missing events, wrong event fact version, or wrong trust-event old value cannot gain the corresponding effect path. A valid independent cellar assignment keeps only its own path when trust evidence is wrong. Rejected decisions return no witnesses. Altering a retained decision event makes semantic replay refuse the receipt.
- Clean evidence source recomputes check digest `3d5d51c0c0fbfd700f7303d3fa5e7869e5f03c591fd4580c1ac149d2e6af3a20`, matching recorded source `d344aaaa`; policy digest also matches. Receipt witnesses deduplicate to the report's exact union. The report has eighteen author-run cases, `status: pending`, null failure/verdict and 243 authored gaps. Independent review did not rerun the eighteen-case recorder.
- `mise exec -- elixir bin/check_docs.exs`: 837 docs, zero broken links and zero unreachable. `git diff --check`: exit 0. No private home/scratch/worktree paths or device/signing identifiers appear in retained files. The full-output verification records author capture, without making absent databases/logs independently available.

## Correctness and simplicity

The accepted-decision guard is unchanged. For Choose, the binder uses the exact prior pending continuation, complete dialogue definition identity and selected `choice_id`. It reads only that definition's authored sequence. Assignments use the declared value; numeric adjustments use prior value plus authored amount. Both require a real value change, matching after-state and the matching full fact reference/old/new event payload. Every credited path names the selected choice and its authored sequence index. Unsupported operations gain no sequence credit.

The surrounding authority/replay checks bind the full committed command, decision and state before witnesses enter the report. Event actor/scope/cause and other receipt fields therefore retain their existing whole-decision validation; this binder introduces no new trust boundary. Canonical admitted references preserve the field ordering used by fact-reference comparison.

The selected Maud case proves an actual 0→5 trust adjustment and false→true cellar assignment through real SQLite and semantic replay. No-op assignments and adjustments whose observed result differs from the simple sum (including clamping) remain uncredited. General repeated-fact chains are outside this selected v042 proof; its authored choice sequences contain none. Other authored operations such as skill acquisition and topic grants remain pending. No sibling or merely offered choice is credited by the new effect matcher.

The architecture clause precedes the implementation and matches this bounded rule. The new test names a specific missed sequence witness and uses literal expected paths; it does not compute its answer from binder output. The controlled mutation shows the older checks do not catch that break.

Ponytail Review: Lean already. Ship the bounded binder. One branch reuses the current continuation, authored sequence, fact reader, receipt events and replay. No dependency, extra configuration or duplicate interpreter was added. Correctness review found no in-scope failure.

## Limits

This review proves the selected additive/assignment effect witnesses and controls above. Remaining branches/operations, final candidate/source/check pins, complete authored coverage, independent gate review and 10,000-sequence proof remain pending. Author typecheck success is retained evidence; no independent typecheck is claimed. Recorder files were untouched and nothing was published.
