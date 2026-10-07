# Owner decision: Claude Code only, Beads permanent, auto-merge — 2026-10-07

The owner moved the project from Codex to Claude Code. All quotes are paraphrased.

- Replying to the PM's three proposals (Opus-only reviews with Fable only for E1–E3 gates;
  auto-merge on green after review; this hygiene PR now): yes to all three, and the PM has
  permission to merge PRs.
- Adapt any useful Codex-specific workflow to Claude Code, optimized for how Claude Code and
  its models work.
- The `/board` slice tracker is deprecated in favor of Beads Rust; remove `loka-board`.
- Delete the Codex sessions and packages and turn off the Codex app.

## Effect

- Claude Code runs every role. Reviews and fix re-checks use a fresh Opus reviewer;
  Fable reviews only the E1–E3 gate closures and gate-level audits. Codex and other
  cross-vendor reviews are retired. The PM translated the Codex model routing into the
  [workflow's Claude Code routing](../WORKFLOW.md#delivery-workflow-pm-developer-reviewer).
- Beads Rust is the permanent PM tracker; the pilot's retirement clause is removed.
  A Claude Code session starts with `bin/session_status.sh`.
- Auto-merge: once the reviewer approves, the PM queues the merge in a background shell
  (`gh pr checks --watch` then `gh pr merge --match-head-commit`), so nobody waits on hosted
  CI and CI stays the gate; the owner's permission to merge PRs covers it. GitHub's `--auto`
  is not used: `main` has no required checks and `browser` does not run on every PR. Review, exact-head
  and owner-reserved rules are unchanged.
