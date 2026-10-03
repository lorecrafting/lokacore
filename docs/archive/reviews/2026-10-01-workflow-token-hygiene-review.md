# Review: WORKFLOW token hygiene, big outputs out of every agent's context

- PR: #84, branch `workflow-token-hygiene`
- Commit reviewed: `6050af3`
- Scope: docs-only (`docs/WORKFLOW.md` Token hygiene, one bullet); short review, no mutation testing.
- Verdict: **APPROVE WITH NOTES**

## What must be true

1. The rule is actionable: what to redirect, where, what to read back.
2. It covers subagents, not only the PM.
3. It does not conflict with or duplicate AGENTS.md, `.claude/agents/developer.md`,
   `.claude/agents/reviewer.md` or the "Subagent returns" bullet.
4. It does not hide what an agent must see: a reviewer's planted-mutant failures, the diff under review.

## Findings

- **TH-1 should-fix** `docs/WORKFLOW.md:87`: "diffs" is listed among outputs that stay out of
  *every* agent's context, but `reviewer.md:53` ("Check the diff") and `developer.md:19`
  ("Self-review the diff") require reading it. Failure: a reviewer applying the rule literally
  reads only a diff's tail and misses a finding in the head. Fix: keep "diffs" on the PM
  (delegate) side, or say agents read a diff per file or hunk, not by tail.
- **TH-2 nit** `docs/WORKFLOW.md:56`, `.claude/agents/developer.md:28`: "commands actually run
  with output" now reads against "only the exit status, the failing lines and the tail".
  Failure: a developer pastes a full check log into its return. Suggest "(exit status, failing lines)".
- **TH-3 nit** `docs/WORKFLOW.md:88`: "to a file" names no place; the old text said scratchpad.
  Failure: a log written inside a worktree is swept in by `git add -A` or scanned by the checks.
  Suggest "a scratchpad file named for the slice" (matches `docs/WORKFLOW.md:110`).

## Checked, no finding

- Reviewer mutation runs: "the failing lines" keeps real test failures visible; item 4 holds.
- No duplicate of the "Subagent returns" bullet (returns vs. tool output) or of AGENTS.md.

## Fix round 1: `caebeff`

Verdict: **APPROVE**

- TH-1 verified, `docs/WORKFLOW.md:87-90`: diffs sit on the PM's delegate side; diffs a developer
  or reviewer must read are read per file or hunk, never by tail. No conflict with `reviewer.md` or `developer.md`.
- TH-2 verified, `docs/WORKFLOW.md:56` and `.claude/agents/developer.md:28` both say
  "(exit status, failing lines)"; no other "with output" remains in WORKFLOW, AGENTS.md or the agent files.
- TH-3 verified, `docs/WORKFLOW.md:88`: "a scratchpad file named for the slice", consistent with `docs/WORKFLOW.md:111`.
