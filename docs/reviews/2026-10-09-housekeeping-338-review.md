# Review: Housekeeping, red controls by PID, after_merge pulls (PR #338)

- PR #338, branch `chore/housekeeping-2026-10-09b`, head `c08c2d23`. Beads loka-rar, loka-jjq, loka-koe, loka-8wt, loka-ydy (each Proposal is the spec; brief in loka-rar notes).
- Governing: [Git hygiene](../WORKFLOW.md#git-hygiene), [Token hygiene](../WORKFLOW.md#token-hygiene), [Review stance](../WORKFLOW.md#review-stance), [AGENTS.md Writing tests](../../AGENTS.md#writing-tests-every-change-every-agent).
- Verdict: **APPROVE WITH NOTES** (one should-fix in the harness, two nits).

## Must be true

1. loka-koe: a checkout running an old `bin/after_merge.sh` (the #336 failure) runs the current copy; an export dirtied by a concurrent `br` write after the commit (the #337 failure) is committed before the push. Refusals still change nothing. One test with a red control for each.
2. The re-exec cannot loop; the second Beads commit commits only `.beads/issues.jsonl`.
3. loka-rar: developer.md, reviewer.md and WORKFLOW say planted breaks and red controls stop only own PIDs; the stubs carry a unique marker.
4. loka-jjq: WORKFLOW token hygiene caps check-running agents at two. loka-8wt: web-preview says owner servers start only via the scripts. loka-ydy: step 2 says the brief is in Beads before the spawn.
5. WORKFLOW "Live polish session" (lines 234-249) is untouched; `bin/check_docs.exs` passes.

## Proof

- (1) Narrowing judged sound: #336 failed because the old copy lacked the cherry fix, a script change; a behind checkout whose script is unchanged pulls main at `bin/after_merge.sh:58` and runs identical code, so the saving holds. Mutants in a detached worktree, harness `sh bin/integration_red_controls.sh` (baseline exit 0):
  - M1 drop the `--ff-only` merge (re-exec the old copy): `FAIL after_merge stale-script: exit 9`.
  - M2 second commit tests the index (`--cached`) not the worktree: `FAIL after_merge concurrent-write: exit 1, want 0`.
  - M3 stale check compares `bin/review_index.sh`: `FAIL after_merge stale-script: exit 9`.
  Both PR-body red-control claims rerun and hold.
- (2) `AFTER_MERGE_REEXEC=1` is set on the exec'd process and the block is skipped; a successful ff makes `HEAD == origin/main`, so the diff test cannot re-fire. `git commit -qm ... -- $j` is a pathspec commit (index ignored for other paths), one straight-line statement.
- (3) `bin/integration_red_controls.sh:271,283` already plant `pkill -f loka-stub`; the three doc edits are in the diff.
- (4) WORKFLOW:64, :256, :338-339; web-preview.md:70. No PM checklist file exists; step 2 is the right home.
- (5) Hunks at WORKFLOW 64, 253, 335 only; `check_docs.exs`: 401 docs, 0 broken.

## Findings

1. **should-fix**, `bin/integration_red_controls.sh:177`: `STALE=1 amk` persists `STALE` after the call on macOS `/bin/sh` (bash 3.2 in POSIX mode; dash does not). The concurrent-write case at `:181` then plants the stale `exit 9` copy and commits the real script on main, so on the owner's M1 it exercises re-exec plus export-commit, never the plain #337 shape; CI (dash) runs the other shape. Seen in M1: `FAIL after_merge concurrent-write: exit 9`, and a probe printed `STALE=1` at line 181. Fix: `unset STALE` after line 177 (or clear it at the end of `amk`).
2. **nit**, `bin/after_merge.sh:10-11`: the header still says every refusal happens before any change; a stale checkout now fast-forwards `main` before the MERGED check (unmerged PR from a stale checkout: main moves, then `die`). Harmless, but the comment or the die wording should say so.
3. **nit**, PR body: `/code-review medium` did not run on this diff; run it on the branch in the fix round ([reviewer.md](../../.claude/agents/reviewer.md)).
