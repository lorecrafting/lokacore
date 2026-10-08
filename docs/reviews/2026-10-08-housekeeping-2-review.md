# Review: housekeeping 2026-10-08 (session 2)

PR #318, branch `chore/housekeeping-2026-10-08b`, head `63d9fa92`. Fresh independent reviewer,
proportionate (docs plus one script). Governing: [WORKFLOW step 7](../WORKFLOW.md), [routing](../WORKFLOW.md#work-routing),
`.gitattributes` union indexes, [record](../decisions/owner-decision-agent-tooling-2026-10-08.md).

Must be true: `sync_pr.sh` merges (never rebases or forces), refuses any real conflict and leaves the
tree clean, rebuilds the review index as main's list plus own lines, pushes only after the docs check;
its red controls fail when each of those breaks. Explore is read-only on Haiku. Step 7 keeps #315's
arm/disarm rules. Paraphrase marked; tracker commit touches only `.beads/issues.jsonl`.

**Verdict: CHANGES REQUIRED**

Mutants on `bin/sync_pr.sh` (throwaway worktree, `bin/integration_red_controls.sh`): `-X ours` red,
docs check ignored red, no `merge --abort` red, no own-line append red; **no index rebuild green**.

- **Blocker** `bin/integration_red_controls.sh:116`: deleting the rebuild (`git show origin/main:$idx > $idx`,
  `bin/sync_pr.sh:18`) stays green. The union merge yields `- own - m1 - m2`, the script then appends
  `- own`, and `tail -n 3` still reads `- m1 - m2 - own`. That is the exact break the comment at :112 claims
  to catch. Compare the whole file (`# i - m1 - m2 - own`).
- **Should-fix** `bin/sync_pr.sh:15`: after a docs-check or push failure the local merge commit stays; a
  rerun sees origin/main in HEAD, prints "already has origin/main" and exits 0 with nothing pushed, so the
  PR sits without CI (the case the script exists to prevent). Test against `origin/<branch>`, or say
  "push by hand" in the failure messages.
- **Nit** `bin/sync_pr.sh:17`: `docs/decisions/README.md` keeps union order (branch line above main's). With
  different dates this breaks "newest first"; `check_docs` does not check order, and `.gitattributes` asks
  the PM's merge to keep it.
- **Question** `.claude/agents/Explore.md:2`: does a project agent named `Explore` override the built-in?
  Frontmatter shape, `tools: Read, Grep, Glob` and `model: haiku` are correct.

Checked, no finding: step 7 text agrees with #315 (arm after final verdict, disarm before other pushes,
re-arm note); routing rows; plugin line; record marked (paraphrased), index and owner-rules lines;
`63d9fa92` touches only `.beads/issues.jsonl`. CI was still running at review time (elixir, sim, lint pass).
