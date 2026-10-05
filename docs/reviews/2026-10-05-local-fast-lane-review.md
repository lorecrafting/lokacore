# Fast provisional local integration review — 2026-10-05

Reviewed local branch `docs/local-fast-lane`, exact head `61873d32`, against local `main` at `e028dbd3`. Fresh independent docs/process reviewer; authored none of the change. No hosted PR or merge performed.

## Requirements checked

- [The new owner decision](../decisions/owner-decision-local-provisional-integration-2026-10-05.md) permits provisional local source merges after focused checks/self-review, with fresh independent review and required second opinions running asynchronously.
- Preserve original-branch fixes, attached review records and unresolved findings; completion waits for a complete player outcome and closed findings.
- [The workflow](../WORKFLOW.md) retains full checks/red controls on the accumulated publication head and required hosted CI on the exact remote merge head.
- [AGENTS.md](../../AGENTS.md) requires each new owner decision to appear in the decision index and owner-rules summary.

## Verdict: CHANGES REQUIRED

1. **LFL-1 — should-fix — `docs/system/owner-rules.md:168`.** The active owner-rules summary still says to merge independently approved units into local `main` and links only the earlier cadence. A developer following this normative summary must wait for review or stop on its disagreement with the new workflow, defeating provisional integration. Update this entry to reference the new decision and distinguish provisional local integration from reviewed completion and remote merge.
2. **LFL-2 — should-fix — `docs/WORKFLOW.md:26`.** The Codex second-opinion procedure still starts only when CI is green and requires a PR. A local save/protocol slice has neither hosted CI nor a PR, so following this clause postpones its required opinion until publication instead of running it alongside the fresh reviewer. Apply the provisional lane's focused-evidence alternative and local branch/base/exact-head handoff to this procedure as well.

No further findings in review-record attachment, original-branch fixes, completion credit or the exact-head hosted merge gate. Step 7 still requires required checks present and green and uses `--match-head-commit`. Delaying broad checks is authorized; this review does not require them before a provisional merge.

Ponytail review: no unnecessary machinery; existing branches, worktrees, hooks and records suffice. Docs-only scope: no test mutation required.

Checks: `mise exec -- elixir bin/check_docs.exs` passed (518 docs, zero broken links or unreachable docs); `git diff --check e028dbd3..61873d32` passed. Mise used writable temporary state because its default trusted-config state is outside the sandbox. Normal pre-commit hook verification is recorded by the review-only commit.
