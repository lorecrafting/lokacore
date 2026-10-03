# Owner decision: when the developer runs `/code-review`; the PM keeps the advisor — 2026-10-02

Relayed by the PM (Claude Code), **(paraphrased)**: the owner agreed to the PM's proposal after asking
whether `/code-review` and the `advisor` tool earn their cost next to the subagent reviewers.

- **`/code-review medium` (developer self-review):** run it only on a diff that changes code or bulk-edits
  docs (for example a relink or a move), and always on a named target (the branch), never
  on whatever the working directory holds. Skip it on a tiny diff and on docs-only notes; the developer
  still does the correctness questions by hand. Evidence (2026-10-02): it found two real bugs in the R6P
  save fixes (#116) and a relink script's damage in compaction PR 2 (#119), found nothing on tiny diffs, and
  once reviewed the wrong diff (#118).
- **`advisor` (PM):** kept, called only at real decision points (before a brief or plan, when a review
  verdict needs a ruling, before declaring a slice done). Each call changed a PM decision that session.
- **Reviewers unchanged:** a fresh Opus reviewer plus codex, as the [workflow](../WORKFLOW.md) says.

Effect: [WORKFLOW](../WORKFLOW.md) step 3 and [the developer definition](../../.claude/agents/developer.md).
