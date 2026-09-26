# Review: review-lever owner decision, R5 re-estimate, #36/#37 ledger (PR #38)

PR #38 (docs only), commit reviewed `ee90fa1`. Reviewer: Opus, fresh. Mutation testing
skipped (docs/config only).

**Verdict: APPROVE WITH NOTES.**

## What must be true

1. The decision record states the owner quote verbatim and says it is unverifiable; the PM
   summary numbers match `docs/dev-evidence.jsonl`.
2. WORKFLOW's reviewer policy matches the decision (Opus default, one review plus a narrow
   fix check; Fable/Astra for foundational freezes) and does not contradict the Astra rule.
3. The ROADMAP re-estimate's slice count matches the slice table; its arithmetic holds.
4. The new ledger lines match the existing line format and pass the dev-evidence test.
5. The reviews index entry for S2b records the actual fix commit and verdict.

## Checks

- Ledger sums (observed only): #34 = 2,636,240 (2.64M), #35 = 1,080,780 (1.08M). Match the
  decision and ROADMAP. "About 0.35M planned" matches 8.5-9.2M / 26 slices.
- Slices left after S2b: R5 S3-S7 (5) + simulation (1) + R6 (6) + early R7/R8 (5) + R6P (4)
  = 21. Matches.
- New ledger lines: same key order and shape as #35's; `mix test
  test/loka/core/registries_test.exs` 16 passed.
- S2b index entry: `8843927` re-reviewed fix `8aef59f` with APPROVE. Matches.
- Owner quote present verbatim with the standard unverifiability note.
- contracts.md "should name": wording only, no rule change.

## Findings

- **nit** `docs/ROADMAP.md:63` (and the PM summary in
  `docs/decisions/owner-decision-review-lever-2026-09-25.md:9`): "about 23 million at
  S1-S2's review style" is 21 x S2's 1.08M, not the S1-S2 mean (1.86M x 21 = about 39M).
  Likewise 14-17M holds only if the six foundational slices cost about S2's 1.08M: at the
  S1-S2 mean, 6 x 1.86M + 15 x 0.48M (#37's observed Opus-only cost) = about 18.4M. A reader
  taking "S1-S2" literally under-reads both figures. Say "at S2's rate" in the ROADMAP (the
  decision's summary is a record of what was proposed; leave it).
