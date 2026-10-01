# Review: SM2 close-out (ROADMAP row done, iOS simulator lessons)

- PR: #80 (`sm2-closeout`)
- Commit reviewed: `53d20218f899033d24067ddf2f4192d12177e243` (CI green)
- Reviewer: Claude Opus 5.5 (independent; authored none of the work)
- Depth: short, docs only (WORKFLOW Review stance); no mutation testing
- Verdict: **APPROVE WITH NOTES**

## What must be true (written before reading the diff)

1. PR numbers map to the right slices (#77 SM2b, #78 SM2a, #79 SM2c) and link the three review records.
2. Anything still open from those reviews is either stated in the row or has a home elsewhere; the row claims nothing the records do not show.
3. Each fact in one place; no duplicated link or restated carry.
4. Each lesson changes a future decision and survives code drift (AGENTS.md "Hard-won lessons", area file).

## Findings

- 1 holds: merge commits `5b5172b` (#77 SM2b), `3ff63c7` (#78 SM2a), `8bb123a` (#79 SM2c). "Not yet tried by touch on a device" matches the SM2b record (tap navigation, Back, page turn, retry, large Dynamic Type left for the device) and SM2c ("did not exercise them on a device"). GameView gaps match the scope decision's "Real data only" bullet.
- **S1 should-fix** `docs/ROADMAP.md:51`: SM2a review Q1 (a corrupt `report` page makes in-place Start over "succeed" each time, a loop, once a milestone cartridge writes reports) has no answer and no home. Failure: the first milestone cartridge ships Start over that never repairs, and nobody planned the check. Add it beside "typed detection: R12" or record that it was dropped. (O1, the iOS error text, already sits in the R6P row: fine.)
- **N1 nit** `docs/ROADMAP.md:51`: the scope-decision link now appears twice in the row; the new sentence can end without it, since the older text links the same record.
- **N2 nit** `docs/ROADMAP.md:51`: the SM2c plan says "then an iPhone install for the owner"; the new text says only "the owner's tryout is pending". State whether the install happened, so the row does not leave it ambiguous.
- R6 row (`docs/ROADMAP.md:50`) "S6a's carries ... to the SM2 row and R12": fine as is. It is a pointer, still true, and the SM2 row now says "done by #78"; restating done there would duplicate the fact.
- Lessons (`docs/lessons/mobile.md:47-54`): both meet the bar. UIScene: changes what you do (patch locally, never commit `ios/`, which is gitignored at `mobile/app/.gitignore:3`) and names its versions, so it ages visibly rather than silently. `simctl` cannot tap: changes what a simulator screenshot may be offered as evidence for, consistent with the SM2b record's "not exercised on the simulator" list.
