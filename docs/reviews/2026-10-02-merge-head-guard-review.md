# Review: WORKFLOW step 7 merges only the CI-green head

PR #126 (`workflow-merge-head-guard`), commit reviewed `e6224ee`. Docs-only; short review per
WORKFLOW "Review stance", no mutation testing.

**Verdict: APPROVE WITH NOTES**

## What must be true

1. The merge is tied to the exact head that CI passed and the reviewer saw; a later push fails the merge.
2. The `gh` command does what the text says, given this repo's settings.
3. Every legitimate post-verdict commit in steps 5 to 7 is classified: PM's own (CI only) or back to the reviewer.
4. No conflict or duplicate with AGENTS.md or another doc.

## Checks

- (2) `gh pr merge --help`: `--match-head-commit SHA  Commit SHA that the pull request head must match to allow merge`. `main` has no branch protection (API 404) and `allow_auto_merge` is false, so `gh` merges directly and does not fall into auto-merge or a merge queue; the guard holds. Not run.
- (4) Only other merge rule is AGENTS.md:140 (merge commits, never squash); consistent, no duplicate.
- Over-engineering: none; four lines.

## Findings

- **F-1 should-fix, `docs/WORKFLOW.md:92-93`.** "Commits after the verdict that are not the PM's own (a `main` merge or a review-record append) send the PR back" parses two ways: the parenthetical can be read as examples of the commits that send the PR back, the opposite of the intent. Read as the list of the PM's own commits, it is incomplete: on PR #120 the PM's post-verdict commit `6ebebe1` changed `docs/ROADMAP.md` as well as appending codex answers, and an index-line conflict fix (step 5) is also the PM's. Scenario: a PM resumed from the state file reads the list literally and sends PR #120 back to the reviewer for a ROADMAP row, or reads it the other way and sends back its own `main` merge. Suggested: "The PM's own commits after the verdict (a `main` merge in `../lokacore-pm`, a codex answer appended verbatim, a ROADMAP or index line) need only green CI on the new head; any other commit after the verdict sends the PR back to the reviewer."
- **Q-1.** All commits carry the same git author, so "the PM's own" is known only from the PM's session; fine while one PM session runs, worth a word only if a second PM ever pushes.

## Fix round 1 re-check (`f480849`)

- F-1 fixed: `docs/WORKFLOW.md:92-94` now names the PM's own post-verdict commits (`main` merge, codex answer verbatim, ROADMAP or index line) as needing only green CI on the new head, and sends every other commit back to the reviewer. It reads only one way, and it covers `6ebebe1` on PR #120. It omits "in `../lokacore-pm`", which step 5 already states. Only `docs/WORKFLOW.md` changed.

**Verdict: APPROVE**
