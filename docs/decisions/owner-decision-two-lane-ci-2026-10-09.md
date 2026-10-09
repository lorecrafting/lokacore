# Owner decision: two-lane CI, hosted gate for every branch — 2026-10-09

Shown the Fable audit of the two-lane workflow (loka-kgd.5: speed of development first, M1 load
second, safety proportionate to pre-production), the owner approved all of it (paraphrased: yes to
all eight recommendations and the drop list, plus auto-compaction for subagents and a per-agent
effort rule).

## Effect

1. **Hosted CI is the merge gate for every branch.** `ci.yml` and `book-e2e.yml` run on every push
   to a non-`main` branch, nightly on `main` and by hand; a superseded head's run is cancelled. A PR
   merges only on a green run of both workflows for the exact head
   (`gh pr merge --merge --match-head-commit <sha>`), after the reviewer verdict.
2. **No local pre-push checks.** The pre-push hook, its lanes (`bin/ci_scope.sh`), the check lock
   (`bin/check_lock.sh`) and the two-check-runner cap are gone; the pre-commit hook stays.
3. **Faster workflows.** `ci.yml` splits the TypeScript job into `kernel` and `mobile`, caches npm by
   lockfile and runs `e1-recorder` only nightly or on a `full` dispatch (`ci-green` accepts it
   skipped). `book-e2e.yml` runs `e2e` and `storybook` in parallel.
4. **The M1 runs focused checks only.** No agent runs the full `npm test`, the Storybook smoke,
   `test:e2e` or `bin/check_all.sh` locally; a developer runs the tests its diff touches, pushes,
   watches the hosted runs (`gh run watch`) and quotes the verdict.
5. **Review records only for contract slices.** Polish and toolbox reviews are PR comments: no
   `docs/reviews` record, index regeneration or `review-<N>` cherry-pick. Slices that change save,
   protocol or kernel contracts keep the record.
6. **Agents by load, not by count.** The PM spawns a new agent only while `uptime` load is under 8,
   up to three or four agents at once.
7. **Per-agent effort and compaction.** The PM sets each spawn's effort: low for Sonnet nits, high for
   reviewers and Fable design, default otherwise. `developer`, `reviewer` and `designer` set
   `autoCompactWindow: 200000`; the 220k handoff rule stays as the fallback.

Dropped rules: the two-runner cap, the check lock, the pre-push lanes, "run `bin/check_all.sh` once
and quote it", the save/protocol/kernel-only hosted-run exception, "merge `main` before a manual run"
(now: merge `main` once before marking the PR ready), `e1-recorder` on non-nightly runs, review
records for polish and toolbox PRs.

Supersedes items 1 to 3 of the [2026-10-08 pre-production gate](owner-decision-preproduction-gate-2026-10-08.md)
(its nightly, admin and review rules stand) and the
[hosted CI for toolbox branches record](owner-decision-hosted-ci-toolbox-2026-10-09.md), whose gate
now applies to every branch.
