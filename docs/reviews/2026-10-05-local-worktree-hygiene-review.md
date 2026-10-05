# Local worktree hygiene — independent review

Reviewed local draft branch `docs/local-worktree-hygiene` at `5ff04a50` against local `main` at `ec3ab73d`. Docs-only review; no mutation test applies.

## Requirements checked

The adopted [local draft-PR decision](../decisions/owner-decision-local-draft-pr-cadence-2026-10-05.md) requires separate worktrees, a full local check and fresh review before a merge commit into local `main`. The review record and merge history must survive in that local history. Later publication still requires hosted checks before remote `main` merges. Existing hosted PRs keep their hosted review and merge flow.

## Verdict: CHANGES REQUIRED

- **LWH-1, should-fix — `docs/WORKFLOW.md:193`.** A reviewer following the adjacent detached-worktree instruction can commit the local review record, remove that worktree, and leave the commit off the slice branch. The integration merge then omits the record, contrary to the owner decision. State how the review-only commit is attached to the slice branch before the reviewer worktree is removed, such as a reviewer branch that the PM cherry-picks or a controlled update of the slice branch.

The local versus hosted CI and merge distinction is otherwise consistent with the adopted decision. The new wording preserves the hosted reviewer push flow for existing PRs and keeps older clones intact. `mise exec -- elixir bin/check_docs.exs` passed (510 docs, no broken links or unreachable files); `git diff --check ec3ab73d 5ff04a50` passed.

## Scoped fix re-review — `cf0c926d`

**APPROVE.** LWH-1 is closed. The PM now cherry-picks the review-only commit onto the slice branch before its local integration merge and removes the separate reviewer worktree afterward. The hosted PR push flow remains explicit. `mise exec -- elixir bin/check_docs.exs` passed (510 docs, no broken links or unreachable files), and `git diff --check 5ff04a50 cf0c926d` passed. No open findings.
