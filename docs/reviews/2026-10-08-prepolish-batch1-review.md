# Review: pre-polish batch 1 (process, scripts, CI)

- Branch: local `chore/pre-polish`, range `e38af110..79fb1aed`, reviewed at `79fb1aed` (no PR yet).
- Scope: BRIEF loka-occ items 1-12 (item 3 ruled: index retired; item 13 reverted), loka-wuf,
  loka-7r9, loka-7vv. Governing: [WORKFLOW](../WORKFLOW.md) steps 2-7, [Git hygiene](../WORKFLOW.md),
  [CHECKS](../CHECKS.md), [CI scope decision](../decisions/owner-decision-preproduction-ci-scope-2026-10-06.md).
- Verdict: **APPROVE WITH NOTES**.

## Must be true (written before the diff)

1. The pre-push Elixir skip drops only what no Elixir check reads; `kernel/ts/test` peers and cartridge paths stay full.
2. pre-push, `check_all.sh` and CI agree: mobile Book/app `.ts`/`.tsx` run the code lane; the classifier fails closed.
3. `mobile/app` `npm test` runs in `check_all.sh` and the CI typescript job.
4. The lock covers `check_all.sh` and pre-push without deadlock (pre-push `exec`s it) and recovers from a dead holder.
5. `after_merge.sh` refuses before any destructive step.
6. The review index is gone; `check_docs` finds records by listing and checks names; the decisions index check stays.
7. Every new script behavior has a red control that goes red when broken.
8. Each fact is stated in one place; no stale index or `integrate_batch.sh` references remain in live docs.

## Evidence

- `docs_only_red_controls.sh`, `integration_red_controls.sh`, `docs_red_controls.sh`, `check_docs.exs`: all exit 0.
- Reviewer mutants (each restored). Red: lock EXIT trap removed; classifier error read as skip
  (`ci_scope.sh:20`); elixir lane skips all of `kernel/ts/test/`; `after_merge.sh:27` dirty-worktree
  check removed; pre-push full-to-tests downgrade (`.githooks/pre-push:19`); review-name check disabled.
  **Green (survived):** the `[ -z "${1-}" ]` guard on `check_all.sh:69` removed.
- Elixir skip: no ExUnit test or `bin/*.exs` reads a `*.test.ts`; the peers import no test file; `features.exs` still runs under `--no-mix-test`.
- Claims rerun: `deer.test.ts:461-474` (gate checklist :34) holds; `c6_source_acceptance.test.ts:11`, `e1_case_host.ts:15` and `deep_fen.test.ts:23` import Book model/presenter.
- Item 13: the net `sync_pr.sh` diff has no keepalive, so it is reverted. `/code-review medium`: commit 61157fdc (there is no PR body yet).
- `after_merge.sh:33` refuses when both sides changed the export. This is correct: `beads_after_git.py:27` skips the import when the DB is dirty.

## Findings

1. should-fix `bin/check_all.sh:69`: no red control covers the `[ -z "${1-}" ]` guard (the mutant survived). If the guard is lost, a `*.test.ts`-only push that runs `--no-mix-test` records tree T. A later full-lane push of T then exits at pre-push:25 without running `mix test`. Add one row: `--no-mix-test` on a clean tree writes no `loka-checked-tree`.
2. should-fix `bin/ci_scope.sh:15` vs `docs/CHECKS.md:81-84`, `docs/system/owner-rules.md` and the decision amendment. The docs say "every mobile `.ts`/`.tsx` runs the code lane", but `mobile/app/tests/*.ts` (e2e specs, `steps.ts`) skip it. A PR that changes only `tests/steps.ts` to 400 lines skips `check_ts_size.mjs`: it runs only in the typescript job (`ci.yml:172`), and pre-push takes `--metadata`. Make the code and the docs agree. Per the ruling, that means `tests/*.ts` runs the code lane.
3. should-fix `bin/after_merge.sh:48`: the remote branch is deleted with no check. Line 28 fetches only `main`, and line 30 checks only local refs. A commit pushed to `origin/<branch>` from another clone after the merge is deleted without a warning. Fetch the branch and refuse unless `origin/<branch>` is in `origin/main`.
4. nit `bin/ci_scope.sh:15`: `/\.(ttf|txt|sksl)$/` matches no tracked file, because all of them are under `mobile/app/book/`. The `.sksl` and fonts examples at CHECKS.md:81 never skip.
5. nit `bin/check_all.sh:4`: "or Book-only push" is out of date; Book changes now run the full line.
6. nit `docs/system/book-ui.md:17`: "are indexed in reviews" (known; the PM batches it).
7. question `docs/decisions/owner-decision-process-tightening-2026-10-08.md:53`: this paraphrases the owner as "Delete the review index", but the loka-ybg owner note reads "generate docs/reviews/README.md from record files (keep the one-line verdict)". Which owner message supports the deletion?
8. question `docs/system/owner-rules.md`: commit 90e6f9e9 left this file to the parallel docs/system branch, and 79fb1aed edits it again. Is a conflict expected?
9. question `bin/after_merge.sh:36-42`: the red control stubs `br`. That a dirty export survives the real post-merge import (`jsonl_newer`, run against the checked-out export) rests on the 2026-10-08 manual check.

Open: watch the first hosted typescript run of `mobile/app npm ci && npm test` against the 15-minute timeout.

## Fix round 1 re-check (`d30d7765..cf132ee9`, reviewed at `cf132ee9`)

Verdict: **APPROVE WITH NOTES**. `docs_only_red_controls.sh`, `integration_red_controls.sh`,
`docs_red_controls.sh` and `check_docs.exs` exit 0. Reviewer mutants, each red and restored:
the `check_all.sh:69` guard removed; `review_index.sh --check` made a no-op; the stale-index
problem dropped in `check_docs.exs`; the `origin/<branch>` ancestor check in `after_merge.sh` made `true`.

- F1 resolved: a new harness case checks that `--no-mix-test` records no tree and a full pass does (the mutant goes red).
- F2 resolved: `ci_scope.sh:15` now skips only `mobile/app/plugins/` and `app.json`; the `tests/steps.ts` row runs. The docs, decision amendment and owner-rules agree.
- F3 resolved: `after_merge.sh:29-34` fetches the branch and refuses before any change; the remote-ahead case leaves HEAD, `br` and the remote branch untouched.
- F4 and F5 resolved: the dead clause is gone; `check_all.sh:4` is reworded. F6 resolved: `book-ui.md:17`.
- Q7 resolved: the index is generated, as the owner approved. Callers checked: `sync_pr.sh` regenerates only when `docs/reviews/README.md` is the sole conflict. `after_merge.sh` regenerates after the pull, and its refusal of untracked files keeps an untracked draft record out of the index.
- Q8 and Q9: still open for the PM.

New finding:

1. should-fix `bin/review_index.sh:26`: the index shows each record's first verdict, which is usually round 1. Merged, approved work therefore reads **CHANGES REQUIRED**. That happens on 26 lines of the generated README (for example `2026-10-08-forged-guards-review.md` and `2026-10-08-e1-recorder-in-ci-review.md`). The owner asked for the record's verdict, and the index is the only place it is summarized. Fix: take the last verdict word (`tail -1`), or the last line containing "Verdict"; keep the red-control line assertion.
