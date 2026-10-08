# Housekeeping 2026-10-08 review: PR #311

- PR: [#311](https://github.com/lorecrafting/lokacore/pull/311), branch `chore/housekeeping-2026-10-08`
- Reviewed: `b8cab27b7a2255c80514fa3dbdf740d16050418b` (hosted CI green), detached worktree
- Reviewer: fresh independent Opus; authored none of the work
- Governing: [WORKFLOW step 7](../WORKFLOW.md#loop), [Git hygiene](../WORKFLOW.md#git-hygiene), [CHECKS](../CHECKS.md), [owner-rules Process](../system/owner-rules.md), AGENTS.md Simplicity and Writing tests
- Verdict: **CHANGES REQUIRED**

## Must be true

1. (a) `check_docs` exits non-zero on a duplicated or missing index line in either README.
2. (b) A `gh pr merge` (including `--auto`) that an agent would plausibly type is blocked, but not `bin/merge_queue.sh`. Input that cannot be parsed and mentions the phrase is blocked. The hook is fast.
3. (c) The Stop hook exits 0 on every path, and its timeout is short.
4. (d) A cancelled run is rerun at most once. A second cancel, any `fail` or a `skipping` refuses. The merge happens only on `<sha>`.
5. Owner rules cite owner records; PM rulings are labelled as PM rulings; AGENTS.md drops no repo-specific rule.

## Evidence

- Suite at head: `bin/integration_red_controls.sh` exits 0 (7.9 s).
- The guard runs in 0.01 s. Results of 40 probe commands:
  - Blocked (2): spacing and tab variants, `&&`, pipes, `&`, `GH_REPO=`, `-R` and `--repo`, absolute path, `$(...)`, a newline-separated line, truncated JSON, and raw text when jq is missing.
  - Passed (0): `gh pr view`, `grep "gh pr merge"`, a commit message with the phrase inside a sentence, and the queue itself.
- Stop hook: 0.13 s. It exits 0 with a bad project directory and with `sed` missing; its timeout is 10 s.
- (a) A planted duplicate line exits 1 and a dropped decision line is reported; the clean tree exits 0.
- Mutants on the suite:
  - Red: guard fails open; global-flag group removed; reruns unlimited; `skipping` no longer refuses; cancel treated as pass at the gate; `--match-head-commit` dropped.
  - Green (survived): M3 and M6, below.
- Beads export check exits 0.

## Findings

1. **Blocker: the "refuse on fail" rule is untested when a cancel is also present.**
   - Code: `bin/merge_queue.sh:28-31` (gate) and `:34` (after the watch).
   - Mutants that stayed green:
     - M6 moves `*cancel*) rerun` above `*fail* | *skipping*` at the gate.
     - M3 drops `*fail*) ;;` from `:34`.
   - Why it matters: GitHub fail-fast cancels sibling jobs when one job fails, so fail next to cancel is the normal shape of a real failure. `gh run rerun` reruns the whole run, so a flaky real failure is rerun and can then merge.
   - Fix: add one gate case with rows `[$F,$C]` and one watch case with fail and cancel rows after the watch. Each must expect exit 1 and no `run rerun` call; an exit-code-only check misses M6.
2. **Should-fix: the guard pattern misses common shell forms** (`bin/guard_merge.sh:9`).
   - Not blocked (exit 0): `for p in 1 2; do gh pr merge $p; done`, `if …; then gh pr merge 1; fi`, `{ gh pr merge 1; }`, `! gh …`, `time gh …`, `exec gh …`, `gh pr -R o/r merge 1`.
   - A batch-merge loop is an everyday habit, not evasion. The `ponytail:` comment documents only `env`, `xargs`, `sh -c` and backticks.
   - Fix: add an optional `(do|then|else|time|exec|!|\{)` prefix to the pattern, or document these forms in the comment.
3. **Should-fix: owner-rules now takes the E1 closure rule from a PM record** (`docs/system/owner-rules.md:199-200`, `docs/WORKFLOW.md:25`).
   - The owner record still says "a second opinion from another fresh Opus reviewer" ([polish order](../decisions/owner-decision-chapter-one-polish-order-2026-10-07.md) step 1).
   - The same sentence also says "Fable only for E2 and E3", so it contradicts itself.
   - Fix: keep the owner's rule. Let the PM record state as a fact that E1 closure used Fable.
4. **Nit:** `docs/briefs/chapter-one/chapter-one-e2-slice-plan-2026-10-07.md:141` still has the local path `~/dev/lokacore-design`.
5. **Nit:** `AGENTS.md:87` says "the same questions by hand", but the questions are no longer in AGENTS.md.

## Rulings

- A commit message where `; gh pr merge` or a line-start `gh pr merge` sits inside a quoted message or heredoc is blocked (exit 2). This is acceptable: it fails safe, and the error message tells the agent what to do.
- Malformed payloads that do not contain the phrase pass. This is acceptable: they cannot be a merge.
- (c) satisfies its rule. The guard cases and queue cases each catch a different break; none overlap.
