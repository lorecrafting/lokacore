# Beads/PR drift check review

PR #294 (`chore/beads-drift-check`), exact head `75708e4c074ff7e5b7515e3f9f2aa4dac25da043`,
base `origin/main`. Independent reviewer; authored none of it.

**Verdict: APPROVE WITH NOTES**

## Must be true (from the owner-approved brief, AGENTS.md Simplicity/Writing tests, WORKFLOW.md#beads-rust, CHECKS.md)

1. Report-only: no tracker writes, hook exits 0, note when br/gh/network is missing.
2. PR number from `/pull/(\d+)` only, `#fragment` ignored; several issues may share one PR.
3. Reports in_progress + PR MERGED/CLOSED; open PR with no issue; closed issue + PR OPEN.
4. Cost: one `br list`, one `gh pr list --state open`, `gh pr view` only for in_progress issues with a PR ref.
5. Drift logic is pure (data in); red controls give literal expectations for 3 kinds + clean case.
6. PM `external_ref` values name the PR that merged each slice; no local path; `--complete` passes.

## Checks

- 1-5 hold by reading `bin/beads_pr_drift.py` and `bin/session_status.sh:15-27`.
- Live hook: exit 0, reports only `open PR #294 has no Beads issue` (expected chore noise).
  PATH without br/gh: `drift check skipped: br or gh unavailable`, exit 0. Bad GH host: same note.
- `br list --status all --json` returns `{"issues": [...], has_more: false}` with `external_ref`; default limit is unlimited.
- `bin/beads_red_controls.sh` passes. Mutants: drop MERGED, anchor regex at `$`, skip/empty
  `referenced`, look up every status: all red. Two survived (S1).
- Refs: `check_beads_export.py --complete` exit 0; no `/Users/` in the export. Every PR in the
  diff is MERGED and its title/branch names the slice (196 A1, 202 A2, 201 B1, 206 B4, 210 B6,
  209 B7, 215 B8, 214 C2, 221 D5, 223 D2; others named in `close_reason`). PR 205 commits name
  A3, B2, B3, B5, C1. E1 -> #288 (OPEN draft); brief path moved into notes. Only
  `external_ref`, `updated_at` and E1 `notes` changed.

## Findings

- **S1 should-fix** `bin/beads_red_controls.sh:84-97`: two plausible mutants of
  `bin/beads_pr_drift.py` stay green. (a) `("MERGED", "CLOSED")` -> `("MERGED",)` at line 23:
  an in_progress issue whose PR was closed unmerged is silently unreported; the brief requires
  CLOSED. (b) `issue["status"] == "closed"` -> `!= "in_progress"` at line 25: every open issue
  whose PR is OPEN is falsely reported as "closed but PR still OPEN". Fix: add a CLOSED state
  for an in_progress issue in the drift fixture and an open issue with an OPEN PR in the clean fixture.
- **nit** `bin/session_status.sh:22-25`: after `drift check incomplete: PR #N state unavailable`,
  an empty result prints `none`, which reads as "no drift" though that issue was not checked.
  The note sits directly above, so acceptable; `none found` or skipping `none` when incomplete would be exact.

## Scoped re-check: fix `0aef9be5`

**Verdict: APPROVE.** Nothing open.

- S1 (a) fixed: drift fixture adds in_progress `e` with `10 CLOSED` and literal line
  `drift: e is in_progress but PR #10 is CLOSED`; mutant `("MERGED",)` now red.
- S1 (b) fixed: clean fixture adds open `d` with `11 OPEN`; mutant `!= "in_progress"` now red.
  Unmutated `bin/beads_red_controls.sh` passes.
- Nit fixed: `bin/session_status.sh:19-25`. Stubbed br/gh: view fails -> only the incomplete
  note, no `none`; view OPEN -> `none`; view MERGED -> drift line. Exit 0 in all three.
- Direct callers unchanged and compatible: `.claude/settings.json` (SessionStart hook),
  `bin/check_all.sh` and `.github/workflows/ci.yml` (red controls).
