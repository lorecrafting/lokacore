# Live Chapter 1 board — independent review

- Local source head: `ebf153f94b098da9cb3ec9cd09c875eac70ee9a3`.
- Base: `0caf15c7`.
- Initial verdict: **CHANGES REQUIRED**.
- Final verdict: **APPROVE** at `67a81244770b16664c0600a89cefd1d1c9850c7e`.
- Governing requirements: [live board](../live-board.md), [local workflow](../WORKFLOW.md#local-draft-pr-cadence), [privacy rules](../../AGENTS.md#hard-won-lessons).

Before inspecting the diff, the required behavior was: display the real completion
plan and roadmap; distinguish reported phases from process liveness and approval;
retain measured check times and unknowns; identify publication facts honestly;
redact private paths and identifiers and escape activity markup. Reporting while
watching must preserve the live dashboard. The workflow gates remain authoritative.

## Findings

1. **LB-1 — blocker — `bin/board:41`.** The plan parser requires the entire
   outcome to be bold. Actual rows close bold after the heading and then provide
   outcome prose before the next table separator. `snapshot` on local `main`
   returns zero rows for the 33-row plan. The existing test passes because its
   synthetic outcome is fully bold. Parse the real row shape and exercise it.
2. **LB-2 — should-fix — `bin/board:174`.** Every snapshot and report writes the
   same `.new` file. A `--note` command racing `--watch` can replace that file
   first, causing the watcher to exit with `FileNotFoundError`. A controlled Git
   fixture with 72 concurrent reports and 24 workers produced four such failures.
   Use a unique temporary file in the output directory before atomic replacement.
3. **LB-3 — should-fix — `bin/board:83`.** The documented integration clone's
   `origin` is another local checkout; `upstream` points to GitHub. The publication
   section compares `origin/main` and labels its difference remote/local commits,
   so unpublished local changes can appear as the publication baseline. Identify
   and label the intended hosted tracking ref; unavailable publication facts must
   remain unknown. Preserve the no-fetch behavior.
4. **LB-4 — should-fix — `bin/board:17`.** The path redactor handles a few
   absolute prefixes but leaves repo-relative scratch/worktree paths unchanged.
   An activity containing `tmp/loka-live-board-review` is persisted and displayed
   verbatim. This is the path form used by the board's own documented workflow.
   Cover relative scratch/worktree and tilde-home paths in the privacy check.

## Verification

- Focused suite: `mise exec -- python3 bin/test_board.py`, with a writable scratch
  mise state directory: **2 tests pass**.
- Actual local-main inputs: **0 candidates**, while the completion regex correctly
  reads the four completed slice IDs. No completion-regex finding.
- Independent mutants: bypassing redaction fails the privacy test; classifying
  every candidate complete fails the Git-facts test. Restored source is unchanged.
- Controlled concurrent CLI reproduction: **4/72 nonzero exits**, all with
  `FileNotFoundError` from the shared temporary HTML file.
- `git diff --check 0caf15c7..HEAD`: passes.
- HTML escaping, explicit unknown check times and last-reported agent activity
  are implemented consistently. Canonical shared operational reports were not changed.
- Ponytail Review, complexity only: **Lean already. Ship.** No extra dependency,
  speculative abstraction or removable layer found. Correctness findings remain open.

All four findings are open. This review does not approve integration or publication.

## Scoped fix round 1

- Exact source head: `819d664facead9a7976e190a3dca617da72c831b`.
- Verdict: **CHANGES REQUIRED**; LB-1, LB-3 and LB-4 closed; LB-2 remains open.
- The actual plan produces **33 candidates / four complete**. The publication
  comparison prefers the hosted tracking ref and labels a filesystem fallback as
  a local mirror with publication unknown. Relative scratch and tilde paths are
  redacted. Three focused tests pass; independently reverting each of those fixes
  makes its relevant test fail.
- Unique output temporary files resolve the original rename collision. However,
  `main` still renders an ordinary `--note` snapshot with `watch=False` to the
  watcher's output. A controlled running-watch/report scenario has a refresh tag
  before the report and none afterward, while the watcher remains alive. If the
  browser reloads that snapshot, it stops refreshing. The report command must
  preserve the watch output's refresh behavior.

## Scoped fix round 2

- Exact source head: `67a81244770b16664c0600a89cefd1d1c9850c7e`.
- Verdict: **APPROVE**; LB-2 closed. **No open findings.**
- An ordinary report now appends its operational note and returns without writing
  HTML. A running watcher retains its refresh tag and picks up the new note on its
  next refresh; standalone snapshot regeneration is documented explicitly.
- Four focused tests pass, including the controlled running-watcher/report case.
  Independently removing the report-only return fails that test. Reinstating the
  shared temporary filename fails the concurrent output test. Both mutations ran
  only in scratch copies; source remained unchanged.
- Scoped check covered the changed report branch, its output caller and the
  watcher/report documentation. The original phase, approval and publication
  limits remain in force. Ponytail Review: no complexity findings.
