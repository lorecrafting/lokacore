# Owner decision: merge on GitHub required checks — 2026-10-08

(paraphrased) Switch from the merge queue script to GitHub branch protection with required checks
and auto-merge, and keep a backdoor so the owner or PM can merge or push directly for quick
pre-production work.

## Effect

- Each workflow has one gate job, `ci-green` in `ci.yml` and `book-e2e-green` in `book-e2e.yml`;
  `main` requires both. A gate fails unless its `changes` job succeeded and no job failed or was
  cancelled, so skipped scoped jobs pass and a draft run fails ([CHECKS](../CHECKS.md)).
- After the verdict on head `<sha>`, the PM arms auto-merge pinned to that head
  ([workflow step 7](../WORKFLOW.md#loop)). A later push invalidates it. A cancelled run fails the
  gate and needs a manual rerun.
- Backdoor: branch protection does not bind admins. The owner, or the PM when the owner asks or for
  status-only commits (ROADMAP status lines, Beads export, review index lines), may push to `main`
  directly or merge as admin. Never for unreviewed code or to bypass a red check.
- The merge queue script, the merge guard hook and their stub tests are deleted.
- Supersedes the background-queue and "no `--auto`" parts of the
  [Claude-only auto-merge decision](owner-decision-claude-only-auto-merge-2026-10-07.md); the
  exact-head gate of the [draft CI decision](owner-decision-skip-ci-on-drafts-2026-10-07.md) is kept.
  Review, exact-head and owner-reserved rules are unchanged.
