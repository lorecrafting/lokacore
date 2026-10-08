# PM decision: E2 fixtures, simulator scope and E1 closure follow-ups — 2026-10-08

**PM rulings, reported to the owner on 2026-10-08.** They settle the PM questions in the
[E2 slice plan](../briefs/chapter-one/chapter-one-e2-slice-plan-2026-10-07.md) and the
[E1 closure review](../reviews/2026-10-07-e1-closure-fable-review.md) notes.

- **E2 S1 fixture names** stay `r9c_interactions_hash.json` and `r9c_interactions_ids.json`, outside
  the simulator's default `cartridge_*hash.json` corpus.
- **No standing simulator loop** for the synthetic cartridge. E2 S2–S4 run its ordered scenarios
  through the real kernel and local authority (E2 brief acceptance 2), which proves more than
  random sequences.
- **E1 closure reviewers.** E1 closure (#288) was reviewed by a fresh Opus reviewer and a Fable
  second opinion ([Opus](../reviews/2026-10-07-e1-closure-opus-review.md),
  [Fable](../reviews/2026-10-07-e1-closure-fable-review.md)), as the
  [Claude-only decision](owner-decision-claude-only-auto-merge-2026-10-07.md) allows for E1–E3
  closures. This replaces the "two fresh Opus reviewers" of the
  [polish order](owner-decision-chapter-one-polish-order-2026-10-07.md) step 1. It is not the Fable
  gate audit, which stays in release-candidate certification (step 4).
- **E1 closure nits.** Fable N1 (an `all([])` objective root holds vacuously): no "trivially true"
  disposition form; the empty conjunction is authored content and holds by the rule's letter.
  Fable N3 (in-process family gaps): no action; it fails closed for v042. Running the recorder in
  CI is Beads `loka-hs9`, which blocks release-candidate certification `loka-4xk`; a failed-run
  summary and the duplicated case-id list are `loka-wo7`.
- **Frozen v003–v041 test pins** move to Beads `loka-zuq`: retarget them to v042 after
  release-candidate certification.
