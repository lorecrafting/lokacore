# Review: #47-#50 ledger, S8, R5 carries, GameView need 12, cross-vendor wording (PR #51)

- PR: #51, branch `pm-docs-s7-ledger`, commit reviewed `a0114eb`
- Reviewer: Opus 5.5 (docs-only slice: short review, no mutation testing)
- Verdict: **APPROVE WITH NOTES**

## What must be true

1. Each new `docs/dev-evidence.jsonl` line has the existing `agent.work` shape, one per
   (pull_request, role, instance), tokens `unknown` when not reported, never 0. The lines
   cover exactly the agents that ran: #47 and #48 pm + reviewer; #49 pm, developer, Opus
   reviewer, Astra reviewer (instance 2); #50 pm, developer, Opus reviewer, Sol 5.6 reviewer
   (model `sol`, instance 2). The registries test stays green.
2. The ROADMAP R5 row marks S7 done and adds S8, and the count is 10 + 1. The early R7/R8
   carries are what the #49 and #50 records deferred.
3. The WORKFLOW cross-vendor wording stays within the Astra owner decision: cross-vendor
   review only for foundational freezes, the PM proposes it and the owner relays it.
4. Room-view need 12 states #50 Q2.
5. `bin/check_docs.exs` passes.

## Checks

- Ledger: 12 lines with the same keys and key order as the earlier lines. The roles, models
  and instances are as listed in 1. The pm and cross-vendor lines are `unknown`, and the
  others have observed values. `mix test test/loka/core/registries_test.exs`: 16 passed.
- ROADMAP R5 slices: S1, S2, S2b, S3, S4, S5, S6a, S6b, S7 and S8 make 10, plus the
  simulation slice. Carries:
  - Keys that break on a failed force: the S7 record lists it as deferred and allowed by the
    brief.
  - Locked containers with an optional door-command target: #50 Q1, recorded as a follow-up.
  - A policy leaf reading resources: #49 S1 option (a). It was fixed by ruling (d), and the
    record says "R7's healing and potions will need it".
  - Positions and their regeneration bonuses: spec 00 lists Positions as R7, and the HP/MA/MV
    owner decision says "once positions exist". This is consistent.
- Need 12 matches Q2: an open door looks doorless, so touch cannot offer `close`. "ExitView
  reason only when blocked" is accurate.
- WORKFLOW: the process is unchanged. The PM still judges the slice foundational, and the
  owner runs the review and pastes the answer. Only the model is widened, and the S7 record
  (line 169) shows the owner doing exactly that.
- `elixir bin/check_docs.exs`: 133 docs, 0 broken links, 0 unreachable.

## Findings

No blockers, no should-fix.

**N1 (nit): WORKFLOW still names Astra where it now means any cross-vendor reviewer.**
- `docs/WORKFLOW.md:29` says "not the implementation of a contract Astra already reviewed".
  Read literally, a contract that Sol reviewed (barrier@1 on #50) could get a second
  cross-vendor review when it is implemented.
- `docs/WORKFLOW.md:75` says "Astra relays".

Fix: say "a cross-vendor reviewer" in both places. For the widened model, link the S7 record,
not a bare "#50". No owner decision records "another vendor's model"; the record of the owner
running Sol is the only source.

**N2 (nit): locked containers move to early R7/R8, but spec 00 still lists them as R5.**
`docs/spec/00-first-cartridge-design.md:365` puts "Containers with locks and capacity" at R5,
and `docs/ROADMAP.md:52` now carries them. Failure: Gate R5 checks 00 §4.1's R5 rows and
reports the row as a gap, or a developer building S8 "loose ends" builds it anyway. Fix: note
the deferral in the ROADMAP R5 row (or in the Gate R5 brief), or retag the 00 row.

**Q1 (question): where does S8 `scan` come from?** `docs/ROADMAP.md:50` adds "S8 `scan` and
loose ends" without linking a source. No owner decision or review record in the repo mentions
`scan`, unlike the other slices, which cite owner decisions. If it came from the owner in
chat, a decision line would let the S8 reviewer check the brief against it.

**Q2 (question): the early R7/R8 count stays at 5 with three carries added.** Do the carries
fit inside the five slices, or should the count grow?
