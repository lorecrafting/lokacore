# Review: Housekeeping 2026-10-08c (PR #322, loka-ezt)

- PR: [#322](https://github.com/lorecrafting/lokacore/pull/322), exact head `b08cc0f6`, base main `9acaf2b5`.
- Reviewer: fresh independent (Opus). Proportionate stance ([WORKFLOW Review stance](../WORKFLOW.md)): docs short, scripts tested.
- Verdict: **APPROVE WITH NOTES**

## Must be true (from `br show loka-ezt`, items 1-11)

1. One self-review pass `/code-review medium`; no remaining separate `/ponytail-review` self-review; reviewer checks the PR reports it; decision record.
2. Reviewers never `--no-verify`. 4. `git branch -f review-<N> HEAD` in reviewer.md and WORKFLOW. 5. `sync_pr.sh` pushes without `-q`.
3. `bin/mutate.sh`: save, apply, test, restore from copy, red/green, one table, non-zero when apply fails or restore leaves a diff; narrow first, full only for survivors.
4. `run_in_background`, no poll loops, ~220k handoff; full-suite sweeps only at RC/E3; >10 min runs go to the PM/owner first (WORKFLOW, developer, reviewer, lessons/checks, record).
5. WORKFLOW retro section (<=5 evidence items, every handoff, gate pattern retro, Beads usage, owner approves); gate checklist line.
6. `session_status.sh`: open count + ids, "Before you clear" line, missed-retro note, never fails startup.

## Checks

- Diff vs main: only the 14 PR files; merge `b08cc0f6` second parent is `9acaf2b5`; Beads export `c974b2a1` has no `/Users` or non-empty `source_repo_path`.
- Greps: no `/ponytail-review` self-review instruction left in AGENTS.md, `.claude/agents`, WORKFLOW; no plain `git branch review-`.
- `bin/integration_red_controls.sh` green at head (11 s). Planted, each red: restore line deleted; apply made a no-op; `< /dev/null` dropped from the full command; `rc=1` dropped on APPLY-FAIL; missed-retro compare flipped (`tail`->`head`); closed issues counted as open; "Before you clear" line deleted.
- `session_status.sh` with no `br`/`gh` on PATH: exit 0, "queue unavailable" note, reminder printed. Real repo: 2 open ids listed, no retro note (newest issue after last merge).
- PR body reports the `/code-review medium` result.

## Findings

- nit `bin/mutate.sh:20-21`: a two-field line (new text forgotten) runs as a deletion mutant without warning; run `a.txt<TAB>x=1` printed `red-full a.txt x=1 -> `. Only a third TAB marks a deliberate deletion.
- nit `.claude/agents/reviewer.md:15`: the "(an off-by-one, a swapped order, a skipped check)" examples now follow "the mutated module", so they read as describing the module.
- question `bin/mutate.sh:33-34`: the restore check compares the file with its own saved copy, so only a failed `cp` trips it; a test command that edits another tracked file goes unreported. Is "restore leaves any diff" meant as `git diff --quiet`?

## Open items

- Item 8 carried: the PR body says the checklist is only on #321's branch, but #321 has merged, so `docs/briefs/chapter-one/chapter-one-e2-gate-checklist-2026-10-08.md:34` is on main and can go in the next batch.
- Item 3 (PM chore): `review-320` ref still local.
