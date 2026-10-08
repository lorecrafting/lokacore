# Owner decision: agent models and tooling — 2026-10-08

(paraphrased) Use the cheaper model where the work is mechanical, keep briefs small, and allow plugin
changes mid-session.

## Effect

- PM mechanical chores (index rebuilds, CI watching, the housekeeping PR) and docs-only slices use
  Sonnet per the [routing table](../WORKFLOW.md#work-routing), not Opus.
- Brief drafters paste `ast-grep outline` signatures of the files a developer must touch, not
  whole files.
- Plugin changes are allowed mid-session; only `CLAUDE.md` stays frozen. A plugin change costs one
  prompt-cache rebuild.
- Haiku where it fits: [`.claude/agents/Explore.md`](../../.claude/agents/Explore.md) overrides the
  built-in read-only Explore agent with `model: haiku` and no Edit or Write; the built-in otherwise
  inherits the main model ([sub-agents docs](https://code.claude.com/docs/en/sub-agents)).
  Brief drafters send search, citation re-anchoring and consumer inventories to it and keep only
  decisions. `CLAUDE_CODE_SUBAGENT_MODEL` is not set globally.
- After each merge to `main` the PM runs `bin/sync_pr.sh <branch>` for every open PR: a PR that
  conflicts with `main` gets no hosted CI, so auto-merge would sit silently. The script merges
  `origin/main` (never rebases), rebuilds the review index as main's list plus the branch's own
  lines, runs the docs check and pushes; it refuses a conflict outside the union-merged indexes
  ([CHECKS](../CHECKS.md)).
- Batch to run less CI (paraphrased): a reviewer commits its record locally in a detached worktree and
  hands back the sha, with no standalone record push; sequential or dependent slices share one draft
  branch by default, ready once, with the per-PR Hosted lane only for a slice that must merge alone;
  after several close merges, `bin/sync_pr.sh` runs once per open PR after the last.
