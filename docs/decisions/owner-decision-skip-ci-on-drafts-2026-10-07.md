# Skip hosted CI on draft PRs (owner decision, 2026-10-07)

(paraphrased)

- In pre-production, hosted CI does not run on draft PRs, so the many intermediate pushes to a long-lived draft (such as E1's PR #288) stop spending Actions time.
- CI runs when the PR is marked ready for review and on every push after that. A manual run of a draft stays possible.
- The merge gate is unchanged: a PR merges only after every required job is green on its exact head.
- Related preference, same day: batch PRs and pushes rather than one CI run per small change.
