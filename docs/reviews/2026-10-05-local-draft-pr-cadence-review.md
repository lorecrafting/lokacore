# Local draft-PR cadence review — 2026-10-05

Reviewed local branch head `688908fb` against `a7330559`. Fresh independent docs review; the reviewer authored none of the change. No GitHub PR has been opened for this branch.

## Requirements checked

- The owner's one-time hosted-CI exception applies only to merged PRs #200–#204. Later merges need an exact-head independent approval, required hosted CI, and a merge commit.
- A local branch can carry the brief, base and exact head, local checks, proposed PR description, and independent review record through fixes before periodic publication.
- Roadmap completion credit follows merged source slices; planning and supporting PRs do not count as completed chapter slices.

## Verdict: CHANGES REQUIRED

1. **Should-fix — `docs/WORKFLOW.md:91`.** Step 5 still requires the developer to push after every fix. On a local draft branch, following that step publishes the branch before its independent re-review and defeats the newly adopted cadence. Make the push conditional on publication, while retaining the local fix commit and re-review path.
2. **Should-fix — `docs/WORKFLOW.md:99`.** The main merge rule says every CI job *started* on the head must finish green. If no hosted job starts during another runner outage, this condition is vacuously satisfied and conflicts with the new requirement at line 126 for every *required* hosted job to finish green. State the required-job gate in step 7 as well.

The decision scopes the exception to exactly five named PRs and explicitly restores later CI. The roadmap credits A1, B1 and A2 as 3/33, while excluding supporting #200 and planning #203–#204. Relative links pass. Ponytail review found no unnecessary machinery; the cadence uses existing branches, checks and review records.

Checks: `elixir bin/check_docs.exs` passed (507 docs, 0 broken links, 0 unreachable); `git diff --check a7330559..688908fb` passed. `mise exec` could not create its trusted-config symlink in this sandbox, so the docs check ran with the installed `elixir` directly.

## Scoped fix review — `39bcf4eb`: APPROVE

- R1 closed: step 5 now keeps fixed commits and the review record on a local draft branch; only a published branch pushes after its pre-push check.
- R2 closed: step 7 now requires every required hosted check to be present and green on the published exact head and all started jobs to complete successfully. A missing check cannot satisfy that gate.

The fix changed only the two affected workflow clauses. `git diff --check` and the docs link check pass; no open findings.

## Revised owner scope — `4ec61e50`: APPROVE

The owner clarified that each locally checked and independently approved work unit is merged with a merge commit into the integration clone's **local** `main` before periodic publication. The revised decision, owner-rules entry and workflow agree on that sequence. The workflow preserves the branch head, review record and local merge SHA as the handoff trail. It keeps the owner's checkout and remote `main` untouched during local development.

The later GitHub PR publishes accumulated history and still needs required hosted CI present and green on its exact remote head before a merge commit reaches remote `main`. The one-time hosted-CI exception remains limited to PRs #200–#204. The prior two findings remain closed; no new findings.

Checks on `4ec61e50`: `mise exec -- elixir bin/check_docs.exs` passed (507 docs, 0 broken links, 0 unreachable); `git diff --check 39bcf4eb..4ec61e50` passed. This is a docs-only scope change, so no test mutation applies.

## Plain-language wording — `fa50bceb`: APPROVE

The two changed paragraphs replace “forge” with the concrete local Git branches, merge commits and review records that preserve the trail. The local and remote merge gates remain unchanged. No findings. `git diff --check 4ec61e50..fa50bceb` and the docs link check pass.

## Integrated worktree cadence — `00fc8e19`: APPROVE

Reviewed the complete integrated docs diff against verified local `main` at `552e00ac`. The owner's worktree choice is recorded in the decision and workflow: each new slice uses its own worktree and branch, and an independent reviewer uses a different worktree. Existing clones need no conversion. The decision, workflow and owner rules agree on locally checked and reviewed units merging into integration `main`, with the merge SHA retained in the next handoff. The one-time hosted-CI exception remains limited to PRs #200–#204; every later remote merge still requires hosted checks present and green on its published exact head.

Both original workflow findings remain closed in the integrated text. This section names the exact integrated head independently of earlier temporary review-branch SHAs. `mise exec -- elixir bin/check_docs.exs` passed (508 docs, 0 broken links, 0 unreachable); `git diff --check 552e00ac..00fc8e19` passed. No findings.
