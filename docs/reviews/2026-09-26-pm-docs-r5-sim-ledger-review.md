# Review: PM docs, #51-#53 ledger and Gate R5 carries (PR #54)

- PR: #54, branch `pm-docs-r5-sim-ledger`
- Commit reviewed: `9942dc5`
- Depth: docs only, short review (WORKFLOW, Review stance); no mutation testing
- Verdict: **APPROVE**

## What must be true

1. The new `docs/dev-evidence.jsonl` lines have the existing `agent.work` shape and one line
   per agent instance that worked on #51, #52 and #53.
2. The Gate R5 carries in the ROADMAP R5 row are what #53 left undone: its PR description's
   "Carried checks" and the review record's open nit.
3. The early R7/R8 additions are what the S7 review (#50) recorded as rejected for now.
4. No carry is stated in two places.

## Check

1. Met. All 10 lines parse and carry the same top-level keys (`data`, `event`, `format`,
   `ids`, `store`) and data keys (`instance`, `model`, `pr_disposition`, `role`, `tokens`)
   as the lines before them; PM tokens `unknown` as for #50. #53 lists developer instances 1
   and 2 (the second after the PM restart) and reviewers Opus (1) and Sol 5.6 (2, tokens
   unknown), matching the review record. No line for #51-#53 existed before.
2. Met. Full `delta_preconditions_hold` (review record, A2 and fix round 1), linear
   `containment_acyclic` and budget faults naming the budget (#53 description, "Carried
   checks"), and the `SHOWN` own-key guard test (review record N3, `invariants.ts:152`).
3. Met. One-way and bent barrier passages and the keyless locked door rejection match
   `2026-09-26-r5-s7-review.md` (fix notes, last paragraph).
4. Met. Outside `docs/reviews/`, the carries appear only in these two ROADMAP rows. The
   Connection text in `contracts.gen.md` states the current rule, not the carry.

No findings.
