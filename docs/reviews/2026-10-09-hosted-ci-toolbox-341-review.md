# Review: pre-push hook, toolbox/* branches gated by hosted CI (PR #341)

- PR #341, branch `chore/hosted-ci-toolbox`, head `5b2578685f77338bd6fa3f0f2c5c9eba52115d84`. Beads loka-kgd.4.
- Governing: `br show loka-kgd.4` (owner verbatim: 'yes go ahead with the CI changes'),
  [pre-production gate](../decisions/owner-decision-preproduction-gate-2026-10-08.md),
  [Delivery lanes](../WORKFLOW.md#delivery-lanes), [Git hygiene](../WORKFLOW.md#git-hygiene),
  [Review stance](../WORKFLOW.md#review-stance). Hook change plus docs: short review, three narrow mutants.
- Verdict: **APPROVE WITH NOTES** (three should-fix, all one-line; nothing blocks the merge).

## Must be true (written before the diff)

1. Only a push whose every updated ref is `refs/heads/toolbox/*` skips; a mixed push or any other ref runs the full lane.
2. The skip prints one line naming hosted CI.
3. Red controls: a toolbox push skips and announces; another branch still runs; each control fails on its planted break.
4. Docs: WORKFLOW step 7 note, MECHANICS-TOOLBOX process line, decision record linking the 2026-10-08 gate record, owner words marked paraphrased.
5. ci.yml + book-e2e.yml on the exact head cover what the local hook ran, or the gap is named.
6. Merge only on a green run for the exact head (`--match-head-commit`).

## Proof

- (1) `.githooks/pre-push:17,32`: `other` set by any non-toolbox ref, including `refs/tags/*` and `toolbox/x:main`. Mixed push covered by `bin/integration_red_controls.sh:80-81`.
- (3) `bin/integration_red_controls.sh` at head: exit 0, no FAIL. Mutants in a detached worktree (removed):
  m1 `toolbox/*` to `toolboxx/*`: FAIL "did not announce", "checks ran" (PR claim 1 backed);
  m2 drop `other=1`: FAIL "mixed: checks skipped" plus the other lanes (claim 2 backed);
  m3 skip line `exit 0` to `exit 1`: suite green (finding S1).
- (4) diffs read per hunk; decision record item 3 says every 2026-10-08 rule stands (finding S2).
- (5) local vs hosted compared line by line (`bin/check_all.sh` against `ci.yml`, `book-e2e.yml`): finding S3.
- Empty stdin (`git push` of an up-to-date ref; git runs the hook with no lines, confirmed in a scratch repo): before, full lane; now the toolbox line and exit 0. Nothing is pushed, so no gate effect (nit N1).

## Disputed self-review findings (PM asked)

- (a) remote-ref-only match: not a bypass that matters. The PR is identified by its remote branch; a `toolbox/*` PR gets the hosted gate, and the same commits pushed to any other ref run the full hook. The hook was never a boundary (`--no-verify` exists).
- (b) `concurrency: cancel-in-progress` per ref: no break. A second dispatch on the same ref cancels the first; the cancelled run's head is stale or identical, and `--match-head-commit <sha of the green run>` ties the merge to the tested head. Caveat for the PM: dispatch once per head and read `headSha` from the green run.
- (c) hosted equivalence: not equal. `ci.yml` lint job scans `lib/loka/core kernel/ts/src` with the core rules only (`--filter '^(elixir-kernel-pure|ts-.*)$'`) and filters `ast-grep test`; `bin/check_all.sh:36,47` scan the whole tree with every rule, including the 13 `lint/rules/mobile-*.yml` rules, and run every rule's cases (CHECKS.md says so). Everything else in `check_all.sh` has a hosted equivalent (hosted adds `hex.audit` and e1-recorder). Storybook smoke lives only in `book-e2e.yml`.

## Findings

- **S1 (should-fix)** `bin/integration_red_controls.sh:77`: the toolbox control reads the hook's message and the lane file but not the push's exit. Break: the skip line ends in `exit 1` (or a failing command lands before it); every toolbox push is refused, the control stays green (mutant m3). Fix: `capped git push origin toolbox/x > "$R.out" 2>&1 || bad 'pre-push toolbox: push failed'; grep -q 'hosted CI is the gate' "$R.out" || bad ...`.
- **S2 (should-fix)** `docs/decisions/owner-decision-hosted-ci-toolbox-2026-10-09.md:8` and `docs/MECHANICS-TOOLBOX.md:127`: "book-e2e.yml when the batch touches the Book" conflicts with two rules that still stand: the 2026-10-08 record item 3 (a kernel-touching PR, which every toolbox row is, needs both workflows green) and the local smoke criterion the hook used (`bin/ci_scope.sh` storybook lane: also `mobile/packages/game-view/`, `mobile/app/stories/`, `.storybook/`, `package.json`). Scenario: a toolbox batch changes `mobile/packages/game-view/` for an offered action; the PM runs `ci.yml` only; a story play function or axe check breaks; it merges and the nightly on `main` is the first red. Fix: drop the condition, run both workflows per batch head (matches the standing kernel rule, nothing to interpret).
- **S3 (should-fix)** same two lines: name the one local-only check. Scenario: a toolbox commit violates a `mobile-*` rule in a file not staged through the pre-commit hook (fresh clone without `core.hooksPath`, or `git commit -n`); the hosted gate is green; the next non-toolbox push by anyone fails `check_all` on a violation that push did not make. Fix: one clause ("hosted CI does not run the whole-tree `ast-grep scan`; the PM runs `ast-grep scan --error . mobile/app/.storybook` on the head before merging" or accept the gap in writing).
- **N1 (nit)** `.githooks/pre-push:32`: with empty stdin (up-to-date push) the hook prints "toolbox/* branch" and exits 0 instead of the old full-lane fallback at line 31. Harmless (nothing is pushed); `[ "$seen" = 0 ] || [ "$other" = 1 ] || { ...; exit 0; }` keeps the message truthful.

## Checked, no finding

- Dirty-tree skip: owner OK'd per the PM; the decision record states it (item 1).
- `/code-review medium` result reported in the PR body; disputed items judged above.
- Decision record paraphrases and marks it; index line newest first.
