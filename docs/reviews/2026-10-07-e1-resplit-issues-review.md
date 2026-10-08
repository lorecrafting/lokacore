# Review: E1 re-split issues (PR #299)

- Branch `chore/e1-resplit-issues`, commit `013f0a6615734395362551321440763653b556bc`; tracker-only (`.beads/issues.jsonl`), no mutation testing per brief.
- Governing: [WORKFLOW.md Beads Rust](../WORKFLOW.md#beads-rust), [audit follow-ups](../decisions/owner-decision-beads-audit-followups-2026-10-06.md).
- Verdict: **APPROVE WITH NOTES**

## Must be true

1. `bin/check_beads_export.py --complete` passes. Yes (exit 0).
2. Each new row (.7 to .11) has a parent-child dependency on E1 and evidence naming `kernel/ts/test/e1_cases.ts`, PR #288 (link) and source `cad4e3a3`. Yes, all five.
3. Counts total 95 and each row's sub-counts add up: .7 5+9+5+2=21; .8 8+3+6+6=23; .9 2+3+3+4+3+3+1=19; .10 4+7+3+3+1=18; .11 8+5+1=14. Yes. They match the recorder pending list (95 paths); the 28 dialogue guard paths split 15 (.9) and 13 (.10).
4. .2, .3 and .4 are closed with the superseded reason. Yes.
5. No local paths, no `-wisp-` IDs, no titles matching `^[A-E]\d+ — `. Yes, in the diff.

## Findings

- **should-fix**, `.beads/issues.jsonl:45` (.6, still `open`): its notes say the 14 world/resource paths "await world/resource witness spec text". .11 now owns exactly those paths. Scenario: `br ready` lists both .6 and .11, and two agents witness the same 14 paths. Fix: in the .6 notes, say that the paths moved to .11 (as the .1 notes do), or close .6 once #288 merges.
- **nit**, same row: "14 world/resource paths and lantern_ale_cask" counts 15. The real split is 13 world/resource paths plus lantern_ale_cask, 14 in all (.11).

## Fix round 1 (`5e370a70`)

**APPROVE**, nothing open. The fix changes only the .6 row: status is now `in_progress` and the notes say "13 world/resource paths and lantern_ale_cask (14 in all) moved to loka-e1-r9-certification-2rz.11". This closes both the should-fix and the nit. The only open E1 children are .10 and .11, so no path is offered twice. `--complete` exits 0. The diff adds no local paths and no `-wisp-` IDs.
