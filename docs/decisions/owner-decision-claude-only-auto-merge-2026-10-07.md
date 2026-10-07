# Owner decision: Claude Code only, Beads permanent, auto-merge — 2026-10-07

The owner moved the project from Codex to Claude Code and, answering the PM's three
proposals (Opus-only reviews with Fable only for E1–E3 gates; auto-merge on green after
review; this hygiene PR now), wrote:

> yes yes and do the hygiene PR now

> also i do give you permission to merge in PRs

> oh yes we did codex specific workflow stuff, if anything that would help for claude code, or translate over to this side but optimized for how claude code and its llms works please feel free to adapt

On the tracker:

> The /board thing that we have to track slices is deprecated in favor of work that was tracked in beads.

> yes get rid of loka-board we will use beads rust instead

On Codex itself:

> dlete the 10gb codex sessions and packages, turn off the codex app.

## Effect

- Claude Code runs every role. Reviews and fix re-checks use a fresh Opus reviewer;
  Fable reviews only the E1–E3 gate closures and gate-level audits. Codex and other
  cross-vendor reviews are retired. The PM translated the Codex model routing into the
  [workflow's Claude Code routing](../WORKFLOW.md#delivery-workflow-pm-developer-reviewer).
- Beads Rust is the permanent PM tracker; the pilot's retirement clause is removed.
  A Claude Code session starts with `bin/session_status.sh`.
- `main` requires the CI jobs, so the PM queues merges with `gh pr merge --auto` once the
  reviewer approves; the owner's permission to merge PRs covers it. Review, exact-head
  and owner-reserved rules are unchanged.
