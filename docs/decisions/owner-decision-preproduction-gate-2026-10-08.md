# Owner decision: pre-production merge gate — 2026-10-08

Asked whether review should run in parallel with hosted CI rather than after it, the owner said:

> whatever you think is faster

Asked whether a single-player game needs online CI on every merge, the owner accepted the PM's
recommendation below:

> okay lets make the change

## Effect

1. The merge gate in pre-production is the local pre-push hook (the full `bin/check_all.sh`
   lane) plus one fresh reviewer on the pushed head. The reviewer starts right after the push;
   nobody waits for hosted CI.
2. Hosted CI (`ci.yml`, `book-e2e.yml`) runs nightly on `main` (10:00 UTC) and by
   `workflow_dispatch`, with no pull request or push triggers. Every such run runs every job; the
   gate jobs `ci-green` and `book-e2e-green` stay as each run's one verdict.
3. A hosted run is still required before merging a PR that touches save, protocol or kernel code
   (`kernel/`, `lib/loka/core/`, `protocol/`, `mobile/authority/local-story/`), and at the release
   candidate and E3: the PM runs `gh workflow run <workflow> --ref <branch>` for both workflows
   and merges only on green.
4. A red nightly is the next session's first job: `bin/session_status.sh` prints the latest
   scheduled run of each workflow on `main`.
5. PRs and review records stay. The PM merges with a merge commit (`gh pr merge --merge`, or
   `--admin` only while GitHub still requires checks); auto-merge arming is gone. The PM changes
   branch protection after this lands.

Supersedes the [required-checks merge decision](owner-decision-required-checks-merge-2026-10-08.md)
and the CI-green-before-review part of [workflow step 4](../WORKFLOW.md#loop). Review, exact-head
and owner-reserved rules are unchanged.
