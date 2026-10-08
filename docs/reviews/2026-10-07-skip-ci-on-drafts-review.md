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

## Fix round 1: `482416e3` — APPROVE WITH NOTES

Scope: `482416e3` only (WORKFLOW.md:122-129 queue, ci.yml:33 comment).

- Nit 1 closed: ci.yml:33 now says lint runs unless the PR is a draft.
- Should-fix 2 closed. The queue text was extracted from WORKFLOW.md, the lines were joined as rendered, and it was run under sh, bash and zsh. The stub `gh` applies the doc's own `-q` filter with real `jq`. Results: draft rows (both `changes` and `lint` SKIPPED) stop, rc 1, no watch. Empty, then QUEUED/IN_PROGRESS, then mixed, then SUCCESS: 4 polls, then watch and merge. `changes` SKIPPED+SUCCESS (ready run half-registered) stops. FAILURE stops. CANCELLED stops. Unknown `EXPECTED` stops. Normal green merges. Green `changes` with a failing watch: no merge. Real `gh` 2.101 `--json name,state` on PR 300 returns uppercase states (`IN_PROGRESS`, `SUCCESS`), and the filter printed `SUCCESS`.
- Precedence: the `until` condition ends at `do`, and its status is the `case`. The trailing `[ ] && watch && merge` runs only after the loop and is all-or-nothing.
- Open item (pending names from memory): **no false merge.** Only the exact string `SUCCESS` merges, so any state that is missing from the list or misnamed stops without a merge. An endless loop happens only on a listed pending state or an empty string.
- nit, `docs/WORKFLOW.md:125`: an empty `s` counts as pending, so a persistent `gh` error after the head wait (expired auth, outage) polls every 5 s forever without merging. The stub ran 925 polls before it was killed. This fails safe, and a wrong `<N>` already hangs the head wait the same way. Optional: select gh's computed `bucket` (`pass`/`pending`/...) instead of a hand-listed `state` set; that removes the from-memory list.
- Question, not new: the loop proceeds once any `changes` row exists. If `book-e2e` registers after `ci`, the watch could pass before `browser` appears. This race existed before this round.

## Fix round 2: `04c5f0ae` — APPROVE

Scope: `04c5f0ae` only (WORKFLOW.md:122-130 queue and prose).

- Nit closed: the queue reads gh's `bucket`. `gh pr checks --help` (2.101) lists exactly `pass`, `fail`, `pending`, `skipping` and `cancel`, so no state names come from memory. Live PR 300 prints `pass,pass`.
- Race question closed by the PM decision (both `changes` rows must read `pass,pass`). The doc command was extracted and run under sh, bash and zsh with a stub `gh` and real `jq`, capped by a 3 s alarm:
  - book-e2e registers late (ci pass, then pass+pending, then pass+pass in reversed order): 3 polls, then merge.
  - book-e2e never appears: waits, no merge (about 180 polls until the alarm).
  - One row skipping: stops, rc 1. Both rows skipping (draft): stops. Fail: stops. Cancel next to pending: stops.
  - All green in either row order, with `lint` between them: merges. Green `changes` with a failing watch: no merge.
  - Persistent `gh` error: polls without merging until killed.
- Order: the pass case needs both rows `pass`, so `pass,pass` is the same in any order. Every mixed order either waits (`pass,pending` / `pending,pass`) or stops on a substring match. No sort is needed.
- Precedence: unchanged from round 1. The `case` status ends the `until` condition, and `[ ] && watch && merge` runs once, all or nothing.
- Persistent `gh` error polling forever: acceptable. It never merges, it runs in a background shell the PM watches, and the head wait before it has the same property.
- Question (fails safe): a third `changes` row (for example a manual dispatch run on the same head, if gh does not deduplicate across events) gives `pass,pass,pass`, and the queue waits forever without merging. Not observed live.

No open findings.
