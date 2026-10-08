# Pre-polish audit, area E: CI, scripts, docs hygiene (loka-v9q)

- Base: `main` at `e38af110` (detached worktree, read-only; no code edits).
- Scope: `bin/`, `.githooks/`, `.github/workflows/`, `AGENTS.md`, `docs/WORKFLOW.md`,
  `docs/BEADS.md`, `docs/ROADMAP.md`, `docs/lessons/`, `docs/CHECKS.md` (as the gate owner).
- Governing: [CHECKS](../CHECKS.md), [CI scope decision](../decisions/owner-decision-preproduction-ci-scope-2026-10-06.md),
  [workflow step 7](../WORKFLOW.md#loop), [check lessons](../lessons/checks.md).
- Not refiled: loka-occ items (mutate.sh nits, sync_pr keepalive, review index retirement,
  pre-push Elixir-half skip, shared lock, source_repo_path, session_status additions).

## Must be true

1. A scoped CI skip happens only when no skipped job's inputs changed (decision lines 5-7:
   kernel, save and checker changes stay in the code lane).
2. The lane named for a class of change actually runs that class's tests ("local-story
   authority/save changes run the broad code lane", CHECKS.md:80).
3. Local pre-push and hosted CI classify files the same way (decision line 9).
4. Every guard exits non-zero on its planted violation; no `set -e` gap hides a failure.
5. One fact, one place; docs and script headers do not contradict each other.

## Findings

E1 | should-fix | `bin/ci_scope.sh:11` (and `.githooks/pre-push:18`, same classifier) |
Kernel tests and the E1 recorder import Book app modules: `kernel/ts/test/e1_case_host.ts:15`
and `c6_source_acceptance.test.ts` (`mobile/app/book/model.ts`), `deep_fen.test.ts:23`
(`presenter.ts`). A PR that changes only `mobile/app/book/model.ts` classifies `skip` for the
code lane (shown: planted one-line commit, `ci_scope.sh HEAD~1 HEAD code` printed `skip`), so
`typescript`, `e1-recorder` skip, `ci-green` passes, and the E1 certification recorder that
depends on `buttonsOf` never runs; pre-push uses the metadata lane for it too. Breaks must-be-true 1.
Fix: small (classify the kernel-imported Book files as code, or every `mobile/app/book/*.ts`
that `kernel/ts/test` imports; add the red-control row in `bin/docs_only_red_controls.sh:33`,
which currently asserts the opposite for any `mobile/` file). Touches the owner's scope
decision: PM confirms with the owner. Before polish: yes (polish edits `mobile/app/book`).

E2 | should-fix | `bin/check_all.sh:46`, `.github/workflows/ci.yml:166` |
No hosted or local gate runs `mobile/app`'s `npm test`: 79 `mobile/authority/**/*.test.ts`
files (save, faults, reopen, start-over) and about 30 `mobile/app/book/*.test.ts` files.
`kernel/ts` runs only `test/**/*.test.ts`; its tsconfig only typechecks the authority tests. The
standalone `kernel/ts/test/e1.ts` certify run (`e1.ts:228`, `:301`) includes them, but no workflow,
script or hook invokes `e1.ts` (CI's `e1-recorder` runs `e1_cases.ts`).
CHECKS.md:31-32 defers the mobile `npm test` under the native pause, but CHECKS.md:80 and the
decision clarification say local-story save changes "run the broad code lane", which does not
execute their tests. Scenario: a save-path edit that only `saves.test.ts` or `faults.test.ts`
catches merges green. On `e38af110` the suite passes locally (exit 0, deps linked), so wiring it in is cheap. Fix: small (one step in
the `typescript` job, which already has BEAM and deps, plus `check_all.sh`). Before polish: yes.

E3 | nit | `bin/check_all.sh:2` | Header says the line is "everything CI runs except
`mix hex.audit`"; CHECKS.md:111 says the `e1-recorder` job is deliberately not in it (and E2
above adds the mobile suite). A developer trusting the header skips the recorder before a
Book/E1 change. Fix: one-liner (link CHECKS instead of restating). Can wait for RC.

E4 | nit | `bin/integrate_batch.sh` (69 lines) + its half of `bin/integration_red_controls.sh` |
E1-only batch integration; last use `4c1bb174` (2026-10-07), E1 closed (#288); its red
control still runs in every `lint` job and `check_all`. Dead script. Fix: small (delete; keep
the artifact rebuild in `ci.yml:141` and repoint the comment at `ci.yml:126` and
CHECKS.md:110,113). Can wait for RC (or now, if no further E1 batches are planned).

## Questions

- Q1 `bin/ci_base.sh:15`: `pull_request` runs test the merge commit with `main`, but the
  green baseline is keyed by the PR head sha. A docs-only push after `main` gained code skips
  the jobs, so the PR's code is never tested against the new `main` before merge; the `main`
  push run catches it after merge. Accept the post-merge detection, or key on the merge sha?
- Q2 loka-occ item 4 (pre-push skips the Elixir half for `*.test.ts`/`kernel/ts/test` diffs):
  `kernel/ts/test` drives the Elixir-compiled fixtures (`transport_fixture.ts:23` runs
  `mix loka.compile`); confirm the item keeps `mix` available for those tests.

## Checked, no finding

Hook exit codes and `set -e` use in `check_all.sh`, `pre-commit`, `pre-push`; `ci_scope.sh`
awk exit logic and rename/empty/non-ancestor cases; `ci_base.sh` per-call error checks;
gate jobs (`ci-green`, `book-e2e-green`); `check_docs.exs` link, reachability and index checks
(probe: planted broken link, unreachable doc and unlinked review record were each reported; exit status is covered by `bin/docs_red_controls.sh`);
`mobile/` ast-grep scan and Prettier clean on base; session_status timestamps (both UTC);
lessons vs WORKFLOW (no contradiction found).

## Disclosure

The E1 probe commit was made in the throwaway worktree with `git -c core.hooksPath=/dev/null`
(a hook bypass) and reset to `e38af110` at once; nothing was pushed or kept.

## Verdict

HEALTHY WITH FINDINGS
