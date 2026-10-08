# Review: skip hosted CI on draft PRs

- PR #300, branch `ci/skip-draft-prs`, head reviewed `fb20785ab7a794f998b97cbd7b189cf20e95a6b5`.
- Governing: [owner decision 2026-10-07](../decisions/owner-decision-skip-ci-on-drafts-2026-10-07.md), [WORKFLOW step 7](../WORKFLOW.md), [CHECKS.md CI](../CHECKS.md).
- Verdict: **APPROVE WITH NOTES**.

## Must be true (written before the diff)

1. Every `pull_request` job in every workflow skips on a draft; push to main unchanged.
2. Marking ready starts the same job set main runs today.
3. A manual run of a draft branch runs the full set.
4. The queue never merges a draft, a failing head, or a head other than `<sha>`.

## Evidence

- Workflows: only `ci.yml` and `book-e2e.yml` have `pull_request`; `mobile*.yml` are dispatch-only. YAML parses (PyYAML). Gating:
  ci `changes` (if draft != true), `lint` (if draft != true, no needs), `elixir`/`typescript`/`sim` (needs `changes`); book-e2e `changes` (if), `browser` (needs `changes`). Job names equal main's. `push: branches: [main]` unchanged.
- Live: on `fb20785a` the draft runs 37714062981 (ci) and 37714062874 (book-e2e) concluded `skipped`, all 7 jobs skipped including `lint`; after the `ready_for_review` event, runs 37714097321/37714097347 ran all 7 jobs green.
- Dispatch: `github.event.pull_request` is null, `null != true` is true, so `changes` and `lint` run; `HEAD` falls back to `github.sha`; `bin/ci_base.sh` searches by commit only. Works by reasoning; not run live.
- Queue (WORKFLOW.md:123-125) run with a stub `gh` under sh, bash, zsh: ready+green merges; draft and empty `isDraft` exit 1 with no `checks` call; failing checks exit 1, pending exit 8, no merge; head `old,old,abc` polls 3 times then merges `--match-head-commit abc`. `;` ends only the `until` loop; the `[ ] && checks && merge` chain is all-or-nothing.

## Findings

1. nit, `.github/workflows/ci.yml:33`: comment still says "lint always runs"; on a draft it skips. A reader trusts the comment over CHECKS.md:92.
2. should-fix, `docs/WORKFLOW.md:120-125`: the command does not by itself guarantee that it never merges an all-skipped head; only the step 7 order prevents it. Scenario: a PR is marked ready with no later push, so `<sha>` is the head the draft run already skipped (as on `fb20785a`). The queue starts before the `ready_for_review` run registers. `isDraft` is false, `gh pr checks` sees only skipped jobs and exits 0, and the merge lands without CI. Stub: `isDraft=false` with checks exit 0 merges (the ready-green row). No backstop: `main` has no branch protection and no rulesets (API 404 / `[]`). A blanket "no skipped jobs" rule would be wrong, because scope skips are legitimate. `changes` (and `lint`) skip only on a draft, so requiring `changes` to pass on `<sha>` separates a draft skip from a scope skip. The PM picks the fix.

Docs: CHECKS.md:92 and :96 are accurate; each fact sits once per role (decision, owner-rules index, CHECKS mechanics, WORKFLOW gate).
