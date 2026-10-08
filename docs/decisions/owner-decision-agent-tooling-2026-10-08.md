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
- After the last of several close merges to `main` the PM runs `bin/sync_pr.sh <branch>` once per open PR: a PR that
  conflicts with `main` gets no hosted CI, so auto-merge would sit silently. The script merges
  `origin/main` (never rebases), regenerates the review index on a conflict there
  (`bin/review_index.sh`, [process tightening](owner-decision-process-tightening-2026-10-08.md)),
  runs the docs check and pushes; it refuses any other conflict ([CHECKS](../CHECKS.md)).
- Batch to run less CI (paraphrased): a reviewer commits its record locally in a detached worktree and
  hands back the sha (kept as local branch `review-<N>`, deleted by the PM after the merge), with no standalone record push; sequential or dependent slices share one draft
  branch by default, ready once, with the per-PR Hosted lane only for a slice that must merge alone;
  after several close merges, `bin/sync_pr.sh` runs once per open PR after the last.
- Fable for the pre-polish area audits (owner 2026-10-08, paraphrased: yes to the Fable quota use):
  a one-off departure from Fable-only-at-gates; areas A kernel, B save, C protocol/Elixir and D Book UI
  on Fable, E CI/scripts/docs on Opus; records `docs/reviews/2026-10-08-prepolish-audit-*.md` (loka-v9q).
