# Owner decision: R6P plan — 2026-10-01

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No checker
can verify it against the chat.

The PM proposed the plan (an Opus draft, settled with the advisor, reviewed by codex Astra, which
asked for changes, then folded and re-checked by Opus) and two questions. The owner approved all of
it and named the tester:

- **Slices.** Six slices and the gate, not four: T, B, P3, P4, P5, P6, Gate R6P, in that order
  ([ROADMAP, R6P slices](../../ROADMAP.md#r6p-slices)). T and B are the kernel carries that land before
  the compiled Lantern. B is the only R6P slice that changes `kernel/ts/src/proposal.ts`, so it is
  the only one with an Astra review besides the gate.
- **`selector_cardinality`.** Graceful lookups over the cap move to the R7/R8 for chapter one row.
  The Lantern has a handful of entities and cannot reach the 1024 cap.
- **Models.** Opus developers on every R6P slice, including P5 (UI) and P6 (device): an exception to
  [WORKFLOW](../../WORKFLOW.md)'s Sonnet default, for this stage only, because both slices touch the save
  and its fault paths. Opus reviewers as usual.
- **Tester.** The owner is the human-proof tester for now ([pre-release-proof](../spec/pre-release-proof.md)
  asks for a non-developer). The gate record states the owner's earlier exposure to the game.

PM decisions in the plan, not owner decisions: the talk alias is fixed at GameView's call site; the
latest committed narration is shown again on reopen with no acknowledgement state, and
`GameViewSnapshot.narration` keeps its meaning; the observation sink is a capped table written in its
own transaction after gameplay, added to `loka-save-v1` with no version bump (the gameplay and
receipt formats do not change); the corrupt-report repair hands a corrupt report to the file-replace
path, so intact reports survive Start over (23 §11); the Lantern has its own save and lineage; the
cartridge ID is `lantern_proof`.

Effect: [ROADMAP](../../ROADMAP.md) R6P, SM2 and chapter-one rows.
